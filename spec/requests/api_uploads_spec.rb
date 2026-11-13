require 'rails_helper'

RSpec.describe 'Uploads API', type: :request do
  let(:user) { User.create!(email_address: 'legacy-upload@example.com', password: 'a-secure-password') }

  before do
    post login_path, params: { email_address: user.email_address, password: 'a-secure-password' }
  end

  def response_body
    JSON.parse(response.body)
  end

  it 'stores a photo and returns its signed id, kind and filename' do
    expect {
      post api_uploads_path, params: { file: photo_upload }
    }.to change(ActiveStorage::Blob, :count).by(1)

    expect(response).to have_http_status(:created)
    expect(response_body).to include('kind' => 'image', 'filename' => 'grad.png')
    expect(ActiveStorage::Blob.find_signed(response_body.fetch('signed_id')).content_type).to eq('image/png')
  end

  it 'stores a voice note as audio' do
    post api_uploads_path, params: { file: voice_upload }

    expect(response).to have_http_status(:created)
    expect(response_body).to include('kind' => 'audio', 'filename' => 'voice_note.wav')
  end

  it 'rejects an unsupported file type without storing it' do
    expect {
      post api_uploads_path, params: { file: exe_upload }
    }.not_to change(ActiveStorage::Blob, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body).to eq('error' => 'File type not supported')
  end

  it 'rejects a HEIC photo' do
    heic = [24].pack('N') + 'ftypheic' + [0].pack('N') + 'mif1heic' + ("\x00" * 16)

    expect {
      post api_uploads_path, params: { file: uploaded(heic, 'IMG_0001.heic', 'image/heic') }
    }.not_to change(ActiveStorage::Blob, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body).to eq('error' => 'File type not supported')
  end

  it 'rejects a file whose name claims a photo but whose bytes are not one' do
    post api_uploads_path, params: { file: uploaded("just text\n", 'evil.jpg', 'image/jpeg') }

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body).to eq('error' => 'File type not supported')
  end

  it 'rejects a file over 25 MB without storing it' do
    allow_any_instance_of(ActionDispatch::Http::UploadedFile).to receive(:size).and_return(25.megabytes + 1)

    expect {
      post api_uploads_path, params: { file: photo_upload }
    }.not_to change(ActiveStorage::Blob, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body).to eq('error' => 'File must be under 25 MB')
  end

  it 'accepts a file of exactly 25 MB' do
    allow_any_instance_of(ActionDispatch::Http::UploadedFile).to receive(:size).and_return(25.megabytes)

    post api_uploads_path, params: { file: photo_upload }

    expect(response).to have_http_status(:created)
  end

  it 'asks for a file when none is sent' do
    post api_uploads_path

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body).to eq('error' => 'Choose a file to upload')
  end
end
