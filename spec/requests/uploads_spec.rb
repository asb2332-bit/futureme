require 'rails_helper'

RSpec.describe 'Uploads API', type: :request do
  let(:user) { User.create!(email_address: 'owner@example.com', password: 'a-secure-password') }
  let(:image) { Rack::Test::UploadedFile.new(Rails.root.join('spec/fixtures/files/capsule.png'), 'image/png') }

  it 'requires login' do
    post api_uploads_path, params: { image: image }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'uploads audio and returns its signed ID' do
    audio = Rack::Test::UploadedFile.new(Rails.root.join('spec/fixtures/files/capsule.mp3'), 'audio/mpeg')
    post login_path, params: { email_address: user.email_address, password: 'a-secure-password' }
    post api_uploads_path, params: { audio: audio }

    expect(response).to have_http_status(:created)
    blob = ActiveStorage::Blob.find_signed(JSON.parse(response.body).fetch('signed_id'))
    expect(blob.content_type).to eq('audio/mpeg')
  end

  it 'uploads an image and returns its signed ID' do
    post login_path, params: { email_address: user.email_address, password: 'a-secure-password' }
    post api_uploads_path, params: { image: image }

    expect(response).to have_http_status(:created)
    blob = ActiveStorage::Blob.find_signed(JSON.parse(response.body).fetch('signed_id'))
    expect(blob.content_type).to eq('image/png')
  end
end
