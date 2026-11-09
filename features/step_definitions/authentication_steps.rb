Given('an account exists with email {string}') do |email|
  @account = User.create!(email_address: email, password: 'a-secure-password')
end

When('I log in with email {string} and password {string}') do |email, password|
  visit '/login'
  fill_in 'Email', with: email
  fill_in 'Password', with: password
  click_button 'Log in'
end

Given('I am a registered user who is logged in') do
  step 'an account exists with email "member@example.com"'
  step 'I log in with email "member@example.com" and password "a-secure-password"'
  step 'I see "member@example.com"'
end

When('I register with email {string} and password {string}') do |email, password|
  visit '/signup'
  fill_in 'Email', with: email
  fill_in 'Password (at least 12 characters)', with: password
  fill_in 'Confirm password', with: password
  click_button 'Create account'
  @account_email = email
end

Then('my account has the user role') do
  expect(User.find_by!(email_address: @account_email).role).to eq('user')
end

When('I log out') do
  click_button 'Log out'
end

Given('I am logged in as an admin') do
  step 'an account exists with email "admin@example.com"'
  @account.update!(role: 'admin')
  step 'I log in with email "admin@example.com" and password "a-secure-password"'
  step 'I see "admin@example.com"'
end

When('I visit the admin overview') do
  visit '/admin'
end

Given('Google accepts my sign-in as {string}') do |email|
  @account_email = email
  OmniAuth.config.test_mode = true
  OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
    provider: 'google_oauth2', uid: 'google-test-user', info: { email: email },
    extra: { raw_info: { email_verified: true } }
  )
end

Given('Google sign-in is cancelled') do
  OmniAuth.config.test_mode = true
  OmniAuth.config.mock_auth[:google_oauth2] = :access_denied
end

When('I sign in with Google') do
  visit '/login'
  click_button 'Continue with Google'
end
