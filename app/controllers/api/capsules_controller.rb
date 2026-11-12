class Api::CapsulesController < ApplicationController
  before_action :require_login

  before_action :set_capsule, only: %i[show update destroy]

  def index
    capsules = accessible_capsules.order(created_at: :desc)

    capsules_as_json = capsules.map do |capsule|
      capsule_json(capsule)
    end

    render json: capsules_as_json
  end

  def create
    if current_user.capsules.count >= 5
      return render json: { errors: { base: ["You can only create up to 5 capsules."] } }, status: :unprocessable_entity
    end

    return render json: { error: "Unsupported file type. Attach images, audio, or video." }, status: :unprocessable_entity if params[:capsule]&.key?(:document_signed_ids)
    submitted_data = capsule_params
    image_signed_ids = submitted_data.delete(:image_signed_ids)
    audio_signed_ids = signed_ids(submitted_data, :audio)
    video_signed_ids = signed_ids(submitted_data, :video)
    remote_image_urls = submitted_data.delete(:remote_image_urls)
    submitted_data[:design] = (submitted_data[:design]&.to_h || {}).merge("remote_image_urls" => remote_image_urls) if remote_image_urls.present?
    @capsule = current_user.capsules.new(submitted_data)
    return unless assign_editors
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

  def update
    @capsule.with_lock do
      version = params.dig(:capsule, :lock_version)
      if (version.present? && version.to_s != @capsule.lock_version.to_s) || (version.blank? && @capsule.editors.exists?)
        return render json: { error: "Another editor may have saved changes. Reload before editing again." }, status: :conflict
      end
      update_capsule
      raise ActiveRecord::Rollback unless response.successful?
    end
  end

  private def update_capsule
    return render json: { error: "Unsupported file type. Attach images, audio, or video." }, status: :unprocessable_entity if params[:capsule]&.key?(:document_signed_ids)
    submitted_data = capsule_params
    audio_signed_ids = signed_ids(submitted_data, :audio)
    video_signed_ids = signed_ids(submitted_data, :video)
    return unless assign_editors
    if submitted_data[:draft] && !@capsule.draft?
      return render json: { error: "A sealed capsule cannot become a draft." }, status: :unprocessable_entity
    end
    new_images = submitted_data.delete(:image_signed_ids)
    @capsule.assign_attributes(submitted_data)
    @capsule.images.attach(new_images) if new_images.present?
    @capsule.audio.attach(audio_signed_ids) if audio_signed_ids.any?
    @capsule.video.attach(video_signed_ids) if video_signed_ids.any?

    @capsule.updated_at = Time.current
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

  def set_capsule
    capsule_id = params[:id]
    scope = action_name == "destroy" ? current_user.capsules : accessible_capsules
    @capsule = scope.find(capsule_id)
  end

  def accessible_capsules
    current_user.capsules.or(Capsule.where(id: CapsuleEditor.where(user: current_user).select(:capsule_id)))
  end

  def assign_editors
    return true unless params[:capsule].key?(:editor_emails)
    unless @capsule.user == current_user
      render json: { error: "Only the owner can change editors." }, status: :forbidden
      return false
    end
    emails = Array(params[:capsule][:editor_emails]).map { |value| value.to_s.strip.downcase }.reject(&:blank?).uniq - [current_user.email_address]
    editors = User.where(email_address: emails).to_a
    unless editors.size == emails.size
      render json: { error: "Each editor needs an existing FutureMe account." }, status: :unprocessable_entity
      return false
    end
    @capsule.editors = editors
    true
  end

  def capsule_params
    submitted_capsule = params.require(:capsule)

    submitted_capsule.permit(:draft, :title, :message, :unlock_at, :audio_signed_id, :video_signed_id,
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
      draft: capsule.draft?,
      owner: capsule.user_id == current_user.id,
      lock_version: capsule.lock_version,
      editor_emails: capsule.user_id == current_user.id ? capsule.editors.map(&:email_address) : [],
      title: capsule.title,
      unlock_at: capsule.unlock_at,
      created_at: capsule.created_at,
      locked: !unlocked,
      message: message,
      documents: include_message ? capsule.documents.blobs.map { |blob| { name: blob.filename.to_s, size: blob.byte_size, url: rails_blob_url(blob, disposition: "attachment") } } : [],
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
