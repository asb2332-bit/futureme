if ENV["FUTUREME_SMTP_HOST"].present?
  ActionMailer::Base.smtp_settings = {
    address: ENV.fetch("FUTUREME_SMTP_HOST"),
    port: ENV.fetch("FUTUREME_SMTP_PORT", "587").to_i,
    user_name: ENV["FUTUREME_SMTP_USER"],
    password: ENV["FUTUREME_SMTP_PASSWORD"],
    authentication: ENV["FUTUREME_SMTP_USER"].present? ? :plain : nil,
    enable_starttls_auto: true
  }
elsif Rails.env.development?
  ActionMailer::Base.delivery_method = :file
end
