class Api::UploadsController < ApplicationController
  # ponytail: public unauthenticated API like Api::CapsulesController. Uploads that are never
  # sealed into a capsule are removed by `bin/rails futureme:purge_unattached_uploads`.
  skip_forgery_protection

  def create
    file = params[:file]
    return render_error("Choose a file to upload") unless file.is_a?(ActionDispatch::Http::UploadedFile)

    content_type = MediaUpload.detect_content_type(file.tempfile, file.original_filename)
    kind = MediaUpload.kind_for(content_type)
    return render_error(MediaUpload::TYPE_NOT_SUPPORTED) unless kind
    return render_error(MediaUpload::TOO_LARGE) if file.size > MediaUpload::MAX_BYTES

    blob = ActiveStorage::Blob.create_and_upload!(
      io: file.tempfile,
      filename: file.original_filename,
      content_type: content_type,
      identify: false
    )

    render json: { signed_id: blob.signed_id, kind: kind, filename: blob.filename.to_s }, status: :created
  end

  private

  def render_error(message)
    render json: { error: message }, status: :unprocessable_entity
  end
end
