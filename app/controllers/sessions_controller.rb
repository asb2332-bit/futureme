class SessionsController < ApplicationController
  def new; end

  def create
    user = User.find_by(email_address: params[:email_address].to_s.strip.downcase)
    if user&.password_digest.present? && user.authenticate(params[:password].to_s)
      sign_in(user)
      redirect_to root_path, notice: "Welcome back!"
    else
      flash.now[:alert] = "Invalid email or password."
      render :new, status: :unprocessable_entity
    end
  end

  def destroy
    reset_session
    redirect_to login_path, notice: "You have logged out.", status: :see_other
  end
end
