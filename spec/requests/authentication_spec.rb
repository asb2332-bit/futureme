require 'rails_helper'
require 'digest/md5'

RSpec.describe 'Authentication and authorization', type: :request do
  let(:password) { 'a-secure-password' }
  let(:user) { User.create!(email_address: 'owner@example.com', password: password) }

  def login(account = user)
    post '/login', params: { email_address: account.email_address, password: password }
  end

  it 'registers a normalized email and ignores submitted admin roles' do
    post '/signup', params: { user: { email_address: ' NEW@Example.com ', password: password,
      password_confirmation: password, role: 'admin', google_uid: 'forged' } }
    expect(response).to redirect_to(root_path)
    account = User.find_by!(email_address: 'new@example.com')
    expect(account.role).to eq('user')
    expect(account.google_uid).to be_nil
    expect(account.password_digest).not_to eq(password)
  end

  it 'rejects mismatched passwords' do
    post '/signup', params: { user: { email_address: 'new@example.com', password: password, password_confirmation: 'different' } }
    expect(response).to have_http_status(:unprocessable_entity)
    expect(User.count).to eq(0)
  end

  it 'rejects duplicate emails regardless of case' do
    user
    post '/signup', params: { user: { email_address: 'OWNER@example.com', password: password } }
    expect(response).to have_http_status(:unprocessable_entity)
    expect(User.count).to eq(1)
  end

  it 'logs in and clears access on logout' do
    login
    get '/api/session'
    expect(JSON.parse(response.body).dig('user', 'email_address')).to eq(user.email_address)
    post '/logout'
    get '/api/capsules'
    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects incorrect credentials without signing in' do
    post '/login', params: { email_address: user.email_address, password: 'wrong' }
    expect(response).to have_http_status(:unprocessable_entity)
    get '/api/capsules'
    expect(response).to have_http_status(:unauthorized)
  end

  it 'requires login for direct image uploads' do
    post '/rails/active_storage/direct_uploads'

    expect(response).to have_http_status(:unauthorized)
  end

  it 'creates a signed direct upload for a logged-in user' do
    login

    post '/rails/active_storage/direct_uploads', params: { blob: { filename: 'memory.jpg', byte_size: 5,
      checksum: Digest::MD5.base64digest('image'), content_type: 'image/jpeg' } }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to include('signed_id', 'direct_upload')
  end

  it 'requires login for reading and creating capsules' do
    get '/api/capsules'
    expect(response).to have_http_status(:unauthorized)
    post '/api/capsules', params: { capsule: { title: 'test' } }
    expect(response).to have_http_status(:unauthorized)
  end

  it 'prevents reading another user capsule, including for an admin' do
    other = User.create!(email_address: 'other@example.com', password: password)
    capsule = other.capsules.create!(title: 'Secret', message: 'Private', unlock_at: 1.day.from_now)
    user.update!(role: 'admin')
    login
    get '/api/capsules'
    expect(JSON.parse(response.body)).to eq([])
    get "/api/capsules/#{capsule.id}"
    expect(response).to have_http_status(:not_found)
  end

  it 'sets ownership on the server' do
    login
    post '/api/capsules', params: { capsule: { title: 'Mine', message: 'Hello', unlock_at: 1.day.from_now, user_id: 999 } }, as: :json
    expect(response).to have_http_status(:created)
    expect(Capsule.last.user).to eq(user)
  end

  it 'reserves the admin overview for admins' do
    get '/admin'
    expect(response).to redirect_to(login_path)
    login
    get '/admin'
    expect(response).to have_http_status(:forbidden)
    user.update!(role: 'admin')
    get '/admin'
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('Account overview')
  end

  it 'rejects forged Google callbacks' do
    get '/auth/google_oauth2/callback'
    expect(response).to have_http_status(:redirect)
    get '/api/session'
    expect(JSON.parse(response.body)['user']).to be_nil
  end

  it 'enforces CSRF for password login and capsule creation' do
    login
    old = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true
    post '/api/capsules', params: { capsule: { title: 'Forged' } }, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    post '/login', params: { email_address: user.email_address, password: password }
    expect(response).to have_http_status(:unprocessable_entity)
  ensure
    ActionController::Base.allow_forgery_protection = old
  end
end
