require 'rails_helper'

RSpec.describe User, '.from_google' do
  let(:auth) { OmniAuth::AuthHash.new(provider: 'google_oauth2', uid: '123', info: { email: 'google@example.com' }, extra: { raw_info: { email_verified: true } }) }

  it 'creates a regular user and reuses the same Google identity' do
    user = User.from_google(auth)
    expect(user.role).to eq('user')
    expect(user.password_digest).to be_nil
    expect(User.from_google(auth)).to eq(user)
    expect(User.count).to eq(1)
  end

  it 'rejects an unverified Google email' do
    auth.extra.raw_info.email_verified = false
    expect { User.from_google(auth) }.to raise_error(ArgumentError)
  end

  it 'does not silently link to an existing password account' do
    User.create!(email_address: auth.info.email, password: 'a-secure-password', role: 'admin')
    expect { User.from_google(auth) }.to raise_error(ArgumentError)
    expect(User.first.google_uid).to be_nil
  end
end
