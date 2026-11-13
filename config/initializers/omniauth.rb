Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2, ENV.fetch("GOOGLE_CLIENT_ID", ""), ENV.fetch("GOOGLE_CLIENT_SECRET", ""),
    scope: "email,profile", prompt: "select_account"
end
OmniAuth.config.allowed_request_methods = [:post]
OmniAuth.config.on_failure = ->(env) { OmniAuth::FailureEndpoint.new(env).redirect_to_failure }
