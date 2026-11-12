class Api::UploadsController < ApplicationController
  before_action :require_login

  def create
    unless %i[image audio video].any? { |kind| params[kind].respond_to?(:content_type) }
      return render json: { errors: { file: ["Unsupported file type. Attach images, audio, or video."] } }, status: :unprocessable_entity
    end
    file = params[:image] || params[:audio] || params[:video] || params.require(:image)
    type = params[:audio] ? "audio" : params[:video] ? "video" : "image"
    detected_type = Marcel::MimeType.for(file.tempfile, name: file.original_filename, declared_type: file.content_type)
    unless detected_type.start_with?("#{type}/") && file.content_type&.start_with?("#{type}/")
      render json: { errors: { type => ["must be a #{type}"] } }, status: :unprocessable_entity
      return
    end
    if file.size > Capsule::MAX_MEDIA_SIZE
      render json: { errors: { type => ["must be 2 MB or smaller"] } }, status: :unprocessable_entity
      return
    end

    blob = ActiveStorage::Blob.create_and_upload!(io: file, filename: file.original_filename, content_type: file.content_type)
    render json: { signed_id: blob.signed_id }, status: :created
  end
end
