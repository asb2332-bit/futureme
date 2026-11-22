class ApplicationMailer < ActionMailer::Base
  default from: -> { ENV.fetch("FUTUREME_MAIL_FROM", "no-reply@example.com") }
  layout "mailer"
end
