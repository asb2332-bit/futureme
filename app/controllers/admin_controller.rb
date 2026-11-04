class AdminController < ApplicationController
  before_action :require_login
  before_action :require_admin

  def index
    @users = User.order(:email_address).limit(100)
    @user_count = User.count
    @capsule_count = Capsule.count
  end

  private

  def require_admin
    render plain: "You do not have permission to view this page.", status: :forbidden unless current_user&.admin?
  end
end
