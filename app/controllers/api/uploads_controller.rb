class Api::UploadsController < ApplicationController
  before_action :require_login

  def create
    file, declared_kind = uploaded_file_and_kind
    return render_error("Choose a file to upload") unless file.is_a?(ActionDispatch::Http::UploadedFile)

    max_bytes = declared_kind ? Capsule::MAX_MEDIA_SIZE : MediaUpload::MAX_BYTES
    return render_size_error(declared_kind) if file.size > max_bytes

    content_type = MediaUpload.detect_content_type(file.tempfile, file.original_filename)
    kind = upload_kind(content_type)
    return render_type_error(declared_kind) unless kind && (!declared_kind || kind == declared_kind)

    blob = ActiveStorage::Blob.create_and_upload!(
      io: file.tempfile,
      filename: file.original_filename,
      content_type: content_type,
      identify: false
    )

    render json: { signed_id: blob.signed_id, kind: kind, filename: blob.filename.to_s }, status: :created
  end

  private

  def uploaded_file_and_kind
    return [params[:image], "image"] if params[:image]
    return [params[:audio], "audio"] if params[:audio]
    return [params[:video], "video"] if params[:video]

    [params[:file], nil]
  end

  def upload_kind(content_type)
    MediaUpload.kind_for(content_type) || ("video" if content_type.to_s.start_with?("video/"))
  end

  def render_type_error(kind)
    if kind
      render json: { errors: { kind => ["must be a #{kind}"] } }, status: :unprocessable_entity
    else
      render_error(MediaUpload::TYPE_NOT_SUPPORTED)
    end
  end

  def render_size_error(kind)
    if kind
      render json: { errors: { kind => ["must be 2 MB or smaller"] } }, status: :unprocessable_entity
    else
      render_error(MediaUpload::TOO_LARGE)
    end
  end

  def render_error(message)
    render json: { error: message }, status: :unprocessable_entity
  end
end
