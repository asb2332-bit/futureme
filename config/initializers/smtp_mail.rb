if !Rails.env.test? && ENV["FUTUREME_SMTP_HOST"].present?
  ActionMailer::Base.delivery_method = :smtp
  ActionMailer::Base.smtp_settings = {
    address: ENV["FUTUREME_SMTP_HOST"],
    port: ENV.fetch("FUTUREME_SMTP_PORT", "587").to_i,
    user_name: ENV["FUTUREME_SMTP_USER"],
    password: ENV["FUTUREME_SMTP_PASSWORD"],
    authentication: :plain,
    enable_starttls_auto: true
  }
elsif Rails.env.development?
  ActionMailer::Base.delivery_method = :file
end
