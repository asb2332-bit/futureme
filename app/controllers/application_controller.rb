class ApplicationController < ActionController::Base
  helper_method :current_user, :google_login_enabled?

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def google_login_enabled?
    ENV["GOOGLE_CLIENT_ID"].present? && ENV["GOOGLE_CLIENT_SECRET"].present?
  end

  def require_login
    return if current_user
    if request.path.start_with?("/api/")
      render json: { error: "Please log in." }, status: :unauthorized
    else
      redirect_to login_path, alert: "Please log in."
    end
  end

  def sign_in(user)
    shared_token = session[:shared_capsule_token]
    reset_session
    session[:user_id] = user.id
    shared_token.present? && CapsuleRecipient.find_signed(shared_token, purpose: :capsule_share) ? capsule_invitation_link_path(shared_token) : root_path
  end
end
