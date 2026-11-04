# Dummy configuration only in the Cucumber process; no real Google requests.
ENV['GOOGLE_CLIENT_ID'] = 'cucumber-client'
ENV['GOOGLE_CLIENT_SECRET'] = 'cucumber-secret'
After do
  OmniAuth.config.test_mode = false
  OmniAuth.config.mock_auth[:google_oauth2] = nil
end
