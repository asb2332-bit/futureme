class Api::CapsulesController < ApplicationController
  before_action :set_calendar_cache_control, only: :calendar
  before_action :require_login

  before_action :set_capsule, only: %i[show update destroy calendar]

  def index
    capsules = current_user.capsules.order(created_at: :desc)

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
    image_signed_ids = submitted_data.delete(:image_signed_ids)
    audio_signed_ids = signed_ids(submitted_data, :audio)
    video_signed_ids = signed_ids(submitted_data, :video)
    remote_image_urls = submitted_data.delete(:remote_image_urls)
    submitted_data[:design] = (submitted_data[:design]&.to_h || {}).merge("remote_image_urls" => remote_image_urls) if remote_image_urls.present?
    @capsule = current_user.capsules.new(submitted_data)
    @capsule.images.attach(image_signed_ids) if image_signed_ids.present?
    @capsule.audio.attach(audio_signed_ids) if audio_signed_ids.any?
    @capsule.video.attach(video_signed_ids) if video_signed_ids.any?

    if @capsule.save
      capsule_data = capsule_json(@capsule)
      capsule_url = api_capsule_url(@capsule)

      render json: capsule_data, status: :created, location: capsule_url
    else
      validation_errors = @capsule.errors.to_hash(full_messages: true)

      render json: { errors: validation_errors }, status: :unprocessable_entity
    end
  end

  def show
    capsule_data = capsule_json(@capsule, include_message: params[:editing] == "true" || @capsule.unlocked?)

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
    audio_signed_ids = signed_ids(submitted_data, :audio)
    video_signed_ids = signed_ids(submitted_data, :video)
    @capsule.assign_attributes(submitted_data.except(:image_signed_ids))
    @capsule.audio.attach(audio_signed_ids) if audio_signed_ids.any?
    @capsule.video.attach(video_signed_ids) if video_signed_ids.any?

    if @capsule.save
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
    @capsule = current_user.capsules.find(capsule_id)
  rescue ActiveRecord::RecordNotFound
    raise unless action_name == 'calendar'

    render json: { error: 'Capsule not found.' }, status: :not_found
  end

  def capsule_params
    submitted_capsule = params.require(:capsule)

    submitted_capsule.permit(:title, :message, :unlock_at, :audio_signed_id, :video_signed_id,
      image_signed_ids: [], audio_signed_ids: [], video_signed_ids: [], remote_image_urls: [], design: {})
  end

  def signed_ids(data, name)
    Array(data.delete("#{name}_signed_ids")) + Array(data.delete("#{name}_signed_id"))
  end

  def capsule_json(capsule, include_message: false)
    unlocked = capsule.unlocked?
    design = public_design(capsule.design)
    message = nil
    image_urls = []
    audio_url = nil
    video_url = nil

    if include_message
      message = capsule.message
      design["sealed_blocks"] = capsule.design.fetch("sealed_blocks", [])
      image_urls = Array(capsule.design["remote_image_urls"]) + capsule.images.blobs.map { |image| rails_blob_url(image) }
      audio_url = capsule.audio.blobs.map { |audio| rails_blob_url(audio) }
      video_url = capsule.video.blobs.map { |video| rails_blob_url(video) }
    end

    {
      id: capsule.id,
      title: capsule.title,
      unlock_at: capsule.unlock_at,
      created_at: capsule.created_at,
      locked: !unlocked,
      message: message,
      image_urls: image_urls,
      audio_url: audio_url,
      video_url: video_url,
      design: design
    }
  end

  def public_design(design)
    {
      "theme" => design.fetch("theme", {}),
      "title_block" => design.fetch("title_block", {}),
      "message_block" => design.fetch("message_block", {}),
      "audio_block" => design.fetch("audio_block", nil),
      "video_block" => design.fetch("video_block", nil),
      "hidden_blocks" => design.fetch("hidden_blocks", [])
    }
  end
end
