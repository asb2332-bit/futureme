class CapsuleInvitationMailer < ApplicationMailer
  def invite(invitation, url)
    mail(to: invitation.email, from: ENV.fetch("FUTUREME_MAIL_FROM", "futureme@example.com"),
      subject: "You’re invited to edit a FutureMe capsule") do |format|
      format.text do
        render plain: "You’ve been invited to help create a FutureMe capsule.\n\n" \
          "Open the invitation and sign in with this email address to join the draft. The link expires in 7 days.\n\n#{url}\n"
      end
    end
  end
end
