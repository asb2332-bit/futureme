class SharedCapsulesController < ApplicationController
  def show
    recipient = CapsuleRecipient.find_signed(params[:id], purpose: :capsule_share)
    raise ActiveRecord::RecordNotFound unless recipient
    unless current_user
      session[:shared_capsule_token] = params[:id]
      return redirect_to login_path
    end
    raise ActiveRecord::RecordNotFound unless recipient.email == current_user.email_address
    session[:verified_capsule_recipient_ids] = (Array(session[:verified_capsule_recipient_ids]) | [recipient.id])
    redirect_to "/capsule.html?id=#{recipient.capsule_id}"
  end
end
