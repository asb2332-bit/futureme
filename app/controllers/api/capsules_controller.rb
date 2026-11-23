class Api::CapsulesController < ApplicationController
  rescue_from ActionController::ParameterMissing, ActionDispatch::Http::Parameters::ParseError, with: :invalid_capsule_request

  before_action :set_calendar_cache_control, only: :calendar
  before_action :require_login

  before_action :set_capsule, only: %i[show update destroy calendar]

  def index
    capsules = current_user.capsules.preload(images_attachments: :blob, audio_attachments: :blob, video_attachments: :blob).order(created_at: :desc)

    capsules_as_json = capsules.map do |capsule|
      capsule_json(capsule)
    end

    render json: capsules_as_json
  end

  def create
    if current_user.capsules.count >= 5
      return render json: { errors: { base: ["You can only create up to 5 capsules."] } }, status: :unprocessable_entity
    end

    submitted_data = capsule_params
    emails = recipient_emails(submitted_data)
    return if performed?
    image_signed_ids = submitted_data.delete(:image_signed_ids)
    submitted_data.delete(:removed_attachment_ids)
    audio_signed_ids = signed_ids(submitted_data, :audio)
    video_signed_ids = signed_ids(submitted_data, :video)
    @capsule = current_user.capsules.new(submitted_data)
    @capsule.images.attach(image_signed_ids) if image_signed_ids.present?
    @capsule.audio.attach(audio_signed_ids) if audio_signed_ids.any?
    @capsule.video.attach(video_signed_ids) if video_signed_ids.any?
    Array(emails).each { |email| @capsule.recipients.build(email: email) }

    if @capsule.save
      deliver_recipient_notifications(@capsule)
      begin
        CapsuleMailer.sealed(@capsule).deliver_now!
      rescue StandardError => error
        Rails.logger.error("Capsule confirmation email failed for capsule #{@capsule.id}: #{error.class}")
      end
      capsule_data = capsule_json(@capsule)
      capsule_url = api_capsule_url(@capsule)

      render json: capsule_data, status: :created, location: capsule_url
    else
      validation_errors = @capsule.errors.to_hash(full_messages: true)

      render json: { errors: validation_errors }, status: :unprocessable_entity
    end
  end

  def show
    editing = params[:editing] == "true"
    return head :not_found if editing && @capsule.user_id != current_user.id
    capsule_data = capsule_json(@capsule, include_message: editing || @capsule.unlocked?)
    capsule_data[:owner] = @capsule.user_id == current_user.id
    capsule_data[:recipient_emails] = @capsule.recipients.pluck(:email) if editing
    if editing
      capsule_data[:media_attachments] = %i[images audio video].to_h do |name|
        [name, @capsule.public_send(name).attachments.includes(:blob).order(:id).map { |attachment| { id: attachment.id, size: attachment.blob.byte_size, url: rails_blob_url(attachment.blob) } }]
      end
      capsule_data[:media_byte_size] = capsule_data[:media_attachments].values.flatten.sum { |attachment| attachment[:size] }
    end

    render json: capsule_data
  end

  def calendar
    remind_before = params.fetch(:remind_before, '0')
    private_title = params.fetch(:private_title, 'false')
    unless remind_before.is_a?(String) && CapsuleCalendar::REMINDER_MINUTES.map(&:to_s).include?(remind_before)
      return render json: { error: 'Choose a supported reminder time.' }, status: :unprocessable_entity
    end
    unless %w[true false].include?(private_title)
      return render json: { error: 'Choose whether to hide the capsule title.' }, status: :unprocessable_entity
    end

    generated_at = Time.current
    if @capsule.unlock_at - remind_before.to_i.minutes <= generated_at
      return render json: { error: 'That reminder time has already passed. Choose a later reminder time.' }, status: :unprocessable_entity
    end

    capsule_link = URI.join(root_url, "capsule.html?id=#{@capsule.id}").to_s
    reminder = CapsuleCalendar.new(@capsule, url: capsule_link, generated_at: generated_at,
      remind_before: remind_before.to_i, private_title: private_title == 'true')
    send_data reminder.to_ical,
      type: "text/calendar; charset=utf-8",
      disposition: "attachment",
      filename: "futureme-capsule-#{@capsule.id}.ics"
  end

  def update
    submitted_data = capsule_params
    emails = recipient_emails(submitted_data)
    return if performed?
    uploads = {
      images: Array(submitted_data.delete(:image_signed_ids)),
      audio: signed_ids(submitted_data, :audio),
      video: signed_ids(submitted_data, :video)
    }
    removed_ids = Array(submitted_data.delete(:removed_attachment_ids)).map(&:to_s)
    attachments = %i[images audio video].to_h { |name| [name, @capsule.public_send(name).attachments.includes(:blob).order(:id).to_a] }
    unless (removed_ids - attachments.values.flatten.map { |attachment| attachment.id.to_s }).empty?
      return render json: { errors: { base: ["Invalid attachment"] } }, status: :unprocessable_entity
    end

    @capsule.assign_attributes(submitted_data)
    attachments.each do |name, existing|
      retained = existing.reject { |attachment| removed_ids.include?(attachment.id.to_s) }.map(&:blob)
      @capsule.public_send("#{name}=", retained + uploads[name]) if retained.size != existing.size || uploads[name].any?
    end

    saved = @capsule.class.transaction do
      if @capsule.save
        unless emails.nil?
          @capsule.recipients.where.not(email: emails).destroy_all
          existing = @capsule.recipients.pluck(:email)
          @capsule.recipients.create!((emails - existing).map { |email| { email: email } })
        end
        true
      end
    end
    if saved
      deliver_recipient_notifications(@capsule) unless emails.nil?
      render json: capsule_json(@capsule, include_message: true)
    else
      render json: { errors: @capsule.errors.to_hash(full_messages: true) }, status: :unprocessable_entity
    end
  end

  def destroy
    media = @capsule.images.blobs.to_a + @capsule.audio.blobs.to_a + @capsule.video.blobs.to_a
    @capsule.destroy!
    media.each(&:purge)
    head :no_content
  end

  private

  def set_calendar_cache_control
    response.headers['Cache-Control'] = 'private, no-store'
  end

  def set_capsule
    capsule_id = params[:id]
    @capsule = current_user.capsules.find_by(id: capsule_id)
    if !@capsule && action_name == "show"
      @capsule = Capsule.joins(:recipients).where(capsule_recipients: { email: current_user.email_address, id: Array(session[:verified_capsule_recipient_ids]) }).find_by(id: capsule_id)
    end
    return if @capsule
    if action_name == "calendar"
      render json: { error: "Capsule not found." }, status: :not_found
    else
      raise ActiveRecord::RecordNotFound
    end
  end

  def capsule_params
    submitted_capsule = params.require(:capsule)

    raise ActionController::ParameterMissing, :capsule unless submitted_capsule.is_a?(ActionController::Parameters)

    attributes = submitted_capsule.except(:design).permit(:title, :message, :unlock_at, :audio_signed_id, :video_signed_id,
      image_signed_ids: [], audio_signed_ids: [], video_signed_ids: [], removed_attachment_ids: [], remote_image_urls: [], recipient_emails: []).to_h
    if submitted_capsule.key?(:design)
      design = submitted_capsule[:design]
      attributes[:design] = design.is_a?(ActionController::Parameters) ? design.to_unsafe_h : design
    end
    urls = attributes.delete(:remote_image_urls)
    if urls.present?
      design = attributes.fetch(:design) { @capsule&.design || {} }
      attributes[:design] = design.merge("remote_image_urls" => urls) if design.is_a?(Hash)
    end
    attributes
  end

  def invalid_capsule_request(error)
    message = error.is_a?(ActionDispatch::Http::Parameters::ParseError) ? "Request body must be valid JSON." : "Capsule must be a JSON object."
    render json: { errors: { capsule: [message] } }, status: :bad_request
  end

  def recipient_emails(data)
    return nil unless data.key?(:recipient_emails)
    emails = data.delete(:recipient_emails).map { |email| email.to_s.strip.downcase }.uniq
    if emails.size > 20 || emails.any? { |email| email.length > 254 || !URI::MailTo::EMAIL_REGEXP.match?(email) }
      render json: { errors: { recipient_emails: ["Enter valid recipient email addresses (maximum 20)."] } }, status: :unprocessable_entity
      return nil
    end
    emails
  end

  def deliver_recipient_notifications(capsule)
    capsule.recipients.find_each do |recipient|
      recipient.deliver_pending!
    rescue StandardError => error
      Rails.logger.error("Recipient notification failed for recipient #{recipient.id}: #{error.class}")
    end
  end

  def signed_ids(data, name)
    Array(data.delete("#{name}_signed_ids")) + Array(data.delete("#{name}_signed_id"))
  end

  def capsule_json(capsule, include_message: false)
    unlocked = capsule.unlocked?
    poster = PosterDesign.new(capsule.design)
    design = poster.public_data
    media = {}
    contents = nil
    if unlocked || capsule.user_id == current_user.id
      blocks = poster.sealed_data
      media = %i[images audio video].to_h do |name|
        attachments = capsule.public_send(name).attachments
        attachments = attachments.includes(:blob) unless attachments.loaded?
        [name, attachments.sort_by(&:id).map { |file| rails_blob_url(file.blob) }]
      end
      remote_images = poster.remote_image_urls
      media[:images] = remote_images + media[:images]
      contents = contents_summary(blocks, media)
      if include_message
        design["sealed_blocks"] = blocks
        design["remote_image_urls"] = remote_images if remote_images.any?
      end
    end

    {
      id: capsule.id,
      title: capsule.title,
      unlock_at: capsule.unlock_at,
      created_at: capsule.created_at,
      locked: !unlocked,
      message: include_message ? capsule.message : nil,
      contents: contents,
      image_urls: include_message ? media[:images] : [],
      audio_url: include_message ? media[:audio] : nil,
      video_url: include_message ? media[:video] : nil,
      design: design
    }
  end

  def contents_summary(blocks, media)
    urls = { "image" => media[:images].dup, "audio" => media[:audio].dup, "video" => media[:video].dup }
    notes = 0
    blocks.each do |block|
      type = block["type"] || block["media_type"]
      type ||= "image" if block.key?("image_url") || block.key?("image_index")
      if urls.key?(type)
        url = block["url"] || block["image_url"]
        urls[type] << url if url
      elsif block["text"].present?
        notes += 1
      end
    end
    counts = urls.transform_values { |values| values.uniq { |url| url.delete_prefix(request.base_url + "/").delete_prefix("/") }.size }
    { notes: notes, photos: counts["image"], audio: counts["audio"], videos: counts["video"] }
  end
end
