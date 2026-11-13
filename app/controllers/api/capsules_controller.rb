class Api::CapsulesController < ApplicationController
  before_action :require_login
  before_action :set_capsule, only: %i[show open update destroy]

  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "Capsule not found" }, status: :not_found
  end

  def index
    capsules = current_user.capsules.order(created_at: :desc)

    render json: capsules.map { |capsule| capsule_json(capsule) }
  end

  def create
    if current_user.capsules.count >= 5
      return render json: { errors: { base: ["You can only create up to 5 capsules."] } }, status: :unprocessable_entity
    end

    submitted_data = capsule_params
    attachments = extract_attachments(submitted_data)
    @capsule = current_user.capsules.new(submitted_data)
    attach_files(@capsule, attachments)

    if @capsule.save
      render json: capsule_json(@capsule), status: :created, location: api_capsule_url(@capsule)
    else
      render json: { errors: @capsule.errors.to_hash(full_messages: true) }, status: :unprocessable_entity
    end
  end

  def show
    reveal_for_editing = params[:editing] == "true"
    render json: capsule_json(@capsule, include_message: reveal_for_editing || @capsule.opened?)
  end

  # Reaching the unlock time makes the capsule ready; this action breaks its seal once.
  def open
    if @capsule.open!
      render json: capsule_json(@capsule, include_message: true)
    else
      render json: { error: "This capsule is locked" }, status: :forbidden
    end
  end

  def update
    submitted_data = capsule_params
    attachments = extract_attachments(submitted_data, existing_design: @capsule.design)
    @capsule.assign_attributes(submitted_data)
    attach_files(@capsule, attachments)

    if @capsule.save
      render json: capsule_json(@capsule, include_message: true)
    else
      render json: { errors: @capsule.errors.to_hash(full_messages: true) }, status: :unprocessable_entity
    end
  end

  def destroy
    blobs = @capsule.media.blobs.to_a + @capsule.images.blobs.to_a +
      @capsule.audio.blobs.to_a + @capsule.video.blobs.to_a
    @capsule.destroy!
    blobs.uniq(&:id).each(&:purge)
    head :no_content
  end

  private

  def set_capsule
    @capsule = current_user.capsules.find(params[:id])
  end

  def capsule_params
    params.require(:capsule).permit(
      :title, :message, :unlock_at, :audio_signed_id, :video_signed_id,
      image_signed_ids: [], audio_signed_ids: [], video_signed_ids: [],
      remote_image_urls: [], design: {}
    )
  end

  def extract_attachments(data, existing_design: {})
    attachments = {
      images: Array(data.delete(:image_signed_ids)),
      audio: signed_ids(data, :audio),
      video: signed_ids(data, :video)
    }
    remote_image_urls = data.delete(:remote_image_urls)
    submitted_design = data[:design]&.to_h
    if remote_image_urls.present?
      data[:design] = (submitted_design || existing_design).merge("remote_image_urls" => remote_image_urls)
    elsif submitted_design && existing_design["remote_image_urls"].present?
      data[:design] = submitted_design.reverse_merge("remote_image_urls" => existing_design["remote_image_urls"])
    end
    attachments
  end

  def signed_ids(data, name)
    Array(data.delete("#{name}_signed_ids")) + Array(data.delete("#{name}_signed_id"))
  end

  def attach_files(capsule, attachments)
    capsule.images.attach(attachments[:images]) if attachments[:images].any?
    capsule.audio.attach(attachments[:audio]) if attachments[:audio].any?
    capsule.video.attach(attachments[:video]) if attachments[:video].any?
  end

  # Until the owner explicitly breaks the seal (or requests editing data), no message,
  # sealed block, media id, or media URL is returned.
  def capsule_json(capsule, include_message: false)
    design = public_design(capsule.design)
    image_urls = []
    audio_url = nil
    video_url = nil

    if include_message
      design["sealed_blocks"] = capsule.sealed_blocks_with_media_urls do |blob|
        rails_blob_path(blob, disposition: "inline", only_path: true)
      end
      image_urls = Array(capsule.design["remote_image_urls"]) +
        capsule.images.blobs.map { |image| rails_blob_url(image) }
      audio_url = capsule.audio.blobs.map { |audio| rails_blob_url(audio) }
      video_url = capsule.video.blobs.map { |video| rails_blob_url(video) }
    end

    {
      id: capsule.id,
      title: capsule.title,
      unlock_at: capsule.unlock_at,
      created_at: capsule.created_at,
      locked: capsule.locked?,
      opened: capsule.opened?,
      opened_at: capsule.opened? ? capsule.opened_at : nil,
      message: include_message ? capsule.message : nil,
      contents: capsule.contents,
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
      "icon_block" => design.fetch("icon_block", {}),
      "audio_block" => design.fetch("audio_block", nil),
      "video_block" => design.fetch("video_block", nil),
      "hidden_blocks" => design.fetch("hidden_blocks", [])
    }
  end
end
