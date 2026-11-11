require 'rails_helper'

RSpec.describe 'Uploads API', type: :request do
  include ActiveSupport::Testing::TimeHelpers
  let(:user) { User.create!(email_address: 'owner@example.com', password: 'a-secure-password') }
  let(:image) { Rack::Test::UploadedFile.new(Rails.root.join('spec/fixtures/files/capsule.png'), 'image/png') }

  it 'requires login' do
    post api_uploads_path, params: { image: image }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'keeps a PDF attached through sealing and exposes it when the capsule opens' do
    post login_path, params: { email_address: user.email_address, password: 'a-secure-password' }
    pdf = Rack::Test::UploadedFile.new(StringIO.new("%PDF-1.4 sample"), 'application/pdf', original_filename: 'notes.pdf')
    post api_uploads_path, params: { document: pdf }
    expect(response).to have_http_status(:created)
    signed_id = response.parsed_body.fetch('signed_id')
    post api_capsules_path, params: { capsule: { title: 'Later', message: 'Notes', unlock_at: 1.minute.from_now,
      document_signed_ids: [signed_id] } }, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body.fetch('documents')).to be_empty
    capsule = Capsule.find(response.parsed_body.fetch('id'))
    travel_to(2.minutes.from_now) do
      get api_capsule_path(capsule)
      expect(response.parsed_body.fetch('documents').first).to include('name' => 'notes.pdf')
      expect(capsule.documents.first.download).to start_with('%PDF')
    end
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

  it 'rejects a file that exceeds the capsule limit before uploading it' do
    video = Rack::Test::UploadedFile.new(Rails.root.join('spec/fixtures/files/over-limit.mp4'), 'video/mp4')
    post login_path, params: { email_address: user.email_address, password: 'a-secure-password' }

    expect { post api_uploads_path, params: { video: video } }.not_to change(ActiveStorage::Blob, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body).dig('errors', 'video')).to include('must be 2 MB or smaller')
  end
end
