class DirectUploadsController < ActiveStorage::DirectUploadsController
  before_action :require_login

  private

  def require_login
    render json: { error: "Please log in." }, status: :unauthorized unless User.exists?(id: session[:user_id])
  end
end
