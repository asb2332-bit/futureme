class RegistrationsController < ApplicationController
  def new
    return redirect_to(root_path) if current_user

    @user = User.new
  end

  def create
    @user = User.new(params.require(:user).permit(:email_address, :password, :password_confirmation))
    if @user.save
      redirect_to sign_in(@user), notice: "Your account is ready."
    else
      render :new, status: :unprocessable_entity
    end
  end
end
