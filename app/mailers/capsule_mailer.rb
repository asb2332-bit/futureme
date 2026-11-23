class CapsuleMailer < ApplicationMailer
  def sealed(capsule)
    @capsule = capsule
    mail(to: capsule.user.email_address, subject: "Your FutureMe capsule has been sealed")
  end

  def recipient_sealed(recipient)
    @capsule = recipient.capsule
    @link = capsule_link(recipient)
    mail(to: recipient.email, subject: "A FutureMe capsule is waiting for you")
  end

  def recipient_unlocked(recipient)
    @link = capsule_link(recipient)
    mail(to: recipient.email, subject: "Your FutureMe capsule is ready to open")
  end

  private

  def capsule_link(recipient)
    base = ENV["FUTUREME_PUBLIC_URL"].presence || (Rails.env.production? ? nil : "http://localhost:3000")
    uri = URI.parse(base.to_s)
    raise ArgumentError, "Set FUTUREME_PUBLIC_URL to your app origin" unless uri.host.present? && (uri.scheme == "https" || (!Rails.env.production? && uri.scheme == "http")) && uri.userinfo.nil? && ["", "/"].include?(uri.path) && !uri.query && !uri.fragment
    "#{base.chomp('/')}#{Rails.application.routes.url_helpers.capsule_invitation_link_path(recipient.signed_id(purpose: :capsule_share))}"
  end
end
