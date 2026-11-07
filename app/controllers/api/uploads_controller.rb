class Api::UploadsController < ApplicationController
  before_action :require_login

  def create
    file = params[:image] || params[:audio] || params[:video] || params.require(:image)
    type = params[:audio] ? "audio" : params[:video] ? "video" : "image"
    if !file.content_type&.start_with?("#{type}/")
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
