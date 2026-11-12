class DirectUploadsController < ActiveStorage::DirectUploadsController
  before_action :require_login

  def create
    unless params.dig(:blob, :content_type).to_s.match?(%r{\A(image|audio|video)/})
      return render json: { error: "Unsupported file type. Attach images, audio, or video." }, status: :unprocessable_entity
    end
    super
  end

  private

  def require_login
    render json: { error: "Please log in." }, status: :unauthorized unless User.exists?(id: session[:user_id])
  end
end
