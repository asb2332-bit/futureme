class Api::CapsulesController < ApplicationController
  before_action :require_login

  before_action :set_capsule, only: %i[show update destroy]

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
    submitted_data.delete(:removed_attachment_ids)
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
    editing = params[:editing] == "true"
    capsule_data = capsule_json(@capsule, include_message: editing || @capsule.unlocked?)
    if editing
      capsule_data[:media_attachments] = %i[images audio video].to_h do |name|
        [name, @capsule.public_send(name).attachments.includes(:blob).order(:id).map { |attachment| { id: attachment.id, size: attachment.blob.byte_size, url: rails_blob_url(attachment.blob) } }]
      end
      capsule_data[:media_byte_size] = capsule_data[:media_attachments].values.flatten.sum { |attachment| attachment[:size] }
    end

    render json: capsule_data
  end

  def update
    submitted_data = capsule_params
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
    @capsule = current_user.capsules.find(capsule_id)
  end

  def capsule_params
    submitted_capsule = params.require(:capsule)

    submitted_capsule.permit(:title, :message, :unlock_at, :audio_signed_id, :video_signed_id,
      image_signed_ids: [], audio_signed_ids: [], video_signed_ids: [], removed_attachment_ids: [], remote_image_urls: [], design: {})
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
      image_urls = Array(capsule.design["remote_image_urls"]) + capsule.images.attachments.includes(:blob).order(:id).map { |attachment| rails_blob_url(attachment.blob) }
      audio_url = capsule.audio.attachments.includes(:blob).order(:id).map { |attachment| rails_blob_url(attachment.blob) }
      video_url = capsule.video.attachments.includes(:blob).order(:id).map { |attachment| rails_blob_url(attachment.blob) }
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
