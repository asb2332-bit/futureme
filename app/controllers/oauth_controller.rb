class OauthController < ApplicationController
  def create
    user = User.from_google(request.env["omniauth.auth"])
    sign_in(user)
    redirect_to root_path, notice: "Signed in with Google."
  rescue ArgumentError, ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique
    redirect_to login_path, alert: "Google sign-in could not be completed. If you already registered with this email, use your password."
  end

  def failure
    redirect_to login_path, alert: "Google sign-in was cancelled or failed. Please try again."
  end
end
