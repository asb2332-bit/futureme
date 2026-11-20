class CapsuleInvitationsController < ApplicationController
  before_action :require_login, only: :create

  def create
    capsule = current_user.capsules.find_by(id: params[:capsule_id], draft: true)
    return render json: { error: "Only the owner can share a saved draft." }, status: :not_found unless capsule

    if !Rails.env.development? && !Rails.env.test? && %w[FUTUREME_PUBLIC_URL FUTUREME_MAIL_FROM FUTUREME_SMTP_HOST].any? { |key| ENV[key].blank? }
      return render json: { error: "Email delivery has not been configured." }, status: :service_unavailable
    end

    invitation = CapsuleInvitation.new(capsule: capsule, email: params[:email].to_s)
    if invitation.email == current_user.email_address
      return render json: { error: "Enter your teammate’s email address." }, status: :unprocessable_entity
    end
    unless invitation.save
      return render json: { error: "Enter a valid email address." }, status: :unprocessable_entity
    end

    token = invitation.signed_id(purpose: CapsuleInvitation::PURPOSE, expires_in: 7.days)
    base = ENV.fetch("FUTUREME_PUBLIC_URL", request.base_url).delete_suffix("/")
    CapsuleInvitationMailer.invite(invitation, "#{base}#{capsule_invitation_path(token)}").deliver_now!
    render json: { message: Rails.env.development? && ActionMailer::Base.delivery_method == :file ?
      "Invitation saved to the local mail preview." : "Invitation sent." }, status: :created
  rescue Net::SMTPError, IOError, SocketError, SystemCallError, Timeout::Error => error
    Rails.logger.warn("Capsule invitation delivery failed: #{error.class}")
    render json: { error: "Couldn’t send the invitation. Please try again." }, status: :bad_gateway
  end

  def show
    load_invitation
    return render :unavailable, status: :gone unless @invitation

    unless current_user
      session[:capsule_invitation] = params[:token]
      return redirect_to login_path, notice: "Sign in with the email address that received the invitation."
    end
    return render :wrong_account, status: :forbidden unless invited_account?

    redirect_to editor_path if @invitation.capsule.editors.exists?(id: current_user.id)
  end

  def accept
    load_invitation
    return render :unavailable, status: :gone unless @invitation
    return redirect_to capsule_invitation_path(params[:token]) unless current_user
    return render :wrong_account, status: :forbidden unless invited_account?

    capsule = @invitation.capsule
    joined = capsule.with_lock do
      next false unless capsule.draft?
      next true if capsule.editors.exists?(id: current_user.id)

      @invitation.reload
      next false if @invitation.accepted_at?

      capsule.capsule_editors.create!(user: current_user)
      @invitation.update!(accepted_at: Time.current)
      capsule.touch
      true
    end
    return render :unavailable, status: :gone unless joined

    redirect_to editor_path, status: :see_other
  end

  private

  def load_invitation
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "strict-origin"
    @invitation = CapsuleInvitation.find_signed(params[:token], purpose: CapsuleInvitation::PURPOSE)
    @invitation = nil unless @invitation&.capsule&.draft?
  end

  def invited_account?
    current_user.email_address == @invitation.email
  end

  def editor_path
    "/create.html?id=#{@invitation.capsule_id}"
  end
end
