require 'rails_helper'
require 'stringio'

RSpec.describe 'Capsules API', type: :request do
  let(:user) { User.create!(email_address: 'owner@example.com', password: 'a-secure-password') }
  before { post login_path, params: { email_address: user.email_address, password: 'a-secure-password' } }

  def response_body
    JSON.parse(response.body)
  end

  it 'lists every capsule owned by the signed-in user' do
    user.capsules.create!(title: 'First', message: 'One', unlock_at: 1.day.from_now)
    user.capsules.create!(title: 'Second', message: 'Two', unlock_at: 2.days.from_now)
    other_user = User.create!(email_address: 'other@example.com', password: 'a-secure-password')
    other_user.capsules.create!(title: 'Private', message: 'Hidden', unlock_at: 1.day.from_now)

    get api_capsules_path

    expect(response).to have_http_status(:ok)
    expect(response_body.map { |capsule| capsule.fetch('title') }).to contain_exactly('First', 'Second')
  end

  it 'rejects a sixth capsule for the signed-in user' do
    5.times do |index|
      user.capsules.create!(title: "Capsule #{index}", message: "Message #{index}", unlock_at: 1.day.from_now)
    end

    expect {
      post api_capsules_path, params: { capsule: { title: 'Sixth', message: 'One too many', unlock_at: 1.day.from_now } }, as: :json
    }.not_to change(Capsule, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body.dig('errors', 'base')).to include('You can only create up to 5 capsules.')
  end

  it 'creates a locked capsule without exposing its message' do
    expect {
      post api_capsules_path, params: { capsule: { title: 'Graduation', message: 'Proud of you!', unlock_at: 1.day.from_now } }, as: :json
    }.to change(Capsule, :count).by(1)

    expect(response).to have_http_status(:created)
    expect(response_body).to include('title' => 'Graduation', 'locked' => true, 'message' => nil)
  end

  it 'saves public and sealed poster design data' do
    design = {
      'theme' => { 'background_color' => '#E3E7DF', 'accent_color' => '#202923', 'font' => 'sans', 'icon' => '⏳' },
      'title_block' => { 'x' => 8, 'y' => 8 },
      'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }]
    }

    post api_capsules_path, params: { capsule: { title: 'Graduation', message: 'Proud of you!', unlock_at: 1.day.from_now, design: design } }, as: :json

    expect(Capsule.last.design).to eq(design)
    expect(response_body.fetch('design')).to include('theme' => design['theme'], 'title_block' => design['title_block'])
    expect(response_body.fetch('design')).not_to have_key('sealed_blocks')
  end

  it 'attaches signed images without exposing a locked capsule image URL' do
    image = ActiveStorage::Blob.create_and_upload!(io: StringIO.new('image'), filename: 'memory.jpg', content_type: 'image/jpeg')

    post api_capsules_path, params: { capsule: { title: 'Graduation', message: 'Proud of you!', unlock_at: 1.day.from_now,
      image_signed_ids: [image.signed_id] } }, as: :json

    expect(response).to have_http_status(:created)
    expect(Capsule.last.images.blobs).to contain_exactly(image)
    expect(response_body.fetch('image_urls')).to eq([])
  end

  it 'stores HTTPS image links without exposing them while locked' do
    image_url = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'

    post api_capsules_path, params: { capsule: { title: 'Graduation', message: 'Proud of you!', unlock_at: 1.day.from_now,
      remote_image_urls: [image_url] } }, as: :json

    expect(response).to have_http_status(:created)
    expect(Capsule.last.design.fetch('remote_image_urls')).to eq([image_url])
    expect(response_body.fetch('image_urls')).to eq([])
  end

  it 'rejects non-HTTPS image links' do
    post api_capsules_path, params: { capsule: { title: 'Graduation', message: 'Proud of you!', unlock_at: 1.day.from_now,
      remote_image_urls: ['http://example.com/image.jpg'] } }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body.dig('errors', 'design')).to include('Design remote image URLs must use HTTPS')
  end

  it 'rejects non-image signed uploads' do
    file = ActiveStorage::Blob.create_and_upload!(io: StringIO.new('file'), filename: 'memory.txt', content_type: 'text/plain')

    post api_capsules_path, params: { capsule: { title: 'Graduation', message: 'Proud of you!', unlock_at: 1.day.from_now,
      image_signed_ids: [file.signed_id] } }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body.dig('errors', 'images')).to include('Images must be an image')
  end

  it 'attaches multiple signed audio and video files without exposing them while locked' do
    audio = 2.times.map { |i| ActiveStorage::Blob.create_and_upload!(io: StringIO.new("audio #{i}"), filename: 'memory.mp3', content_type: 'audio/mpeg') }
    video = 2.times.map { |i| ActiveStorage::Blob.create_and_upload!(io: StringIO.new("video #{i}"), filename: 'memory.mp4', content_type: 'video/mp4') }

    post api_capsules_path, params: { capsule: { title: 'Graduation', message: 'Proud of you!', unlock_at: 1.day.from_now,
      audio_signed_ids: audio.map(&:signed_id), video_signed_ids: video.map(&:signed_id) } }, as: :json

    expect(response).to have_http_status(:created)
    expect(Capsule.last.audio.blobs).to match_array(audio)
    expect(Capsule.last.video.blobs).to match_array(video)
    expect(response_body.fetch('audio_url')).to be_nil
    expect(response_body.fetch('video_url')).to be_nil
  end

  it 'returns every audio and video URL only after the seal is broken' do
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now)
    2.times { |i| capsule.audio.attach(io: StringIO.new("audio #{i}"), filename: 'memory.mp3', content_type: 'audio/mpeg') }
    2.times { |i| capsule.video.attach(io: StringIO.new("video #{i}"), filename: 'memory.mp4', content_type: 'video/mp4') }
    capsule.update!(unlock_at: 1.minute.ago)

    post open_api_capsule_path(capsule)
    get api_capsule_path(capsule)

    expect(response_body.fetch('audio_url')).to all(include('/rails/active_storage/blobs/'))
    expect(response_body.fetch('video_url')).to all(include('/rails/active_storage/blobs/'))
    expect(response_body.fetch('audio_url')).to have_attributes(length: 2)
    expect(response_body.fetch('video_url')).to have_attributes(length: 2)
  end

  it 'adds multiple audio and video files when an unlocked capsule is edited' do
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now)
    capsule.update!(unlock_at: 1.minute.ago)
    audio = 2.times.map { |i| ActiveStorage::Blob.create_and_upload!(io: StringIO.new("audio #{i}"), filename: 'memory.mp3', content_type: 'audio/mpeg') }
    video = 2.times.map { |i| ActiveStorage::Blob.create_and_upload!(io: StringIO.new("video #{i}"), filename: 'memory.mp4', content_type: 'video/mp4') }

    patch api_capsule_path(capsule), params: { capsule: { title: capsule.title, message: capsule.message, unlock_at: capsule.unlock_at,
      audio_signed_ids: audio.map(&:signed_id), video_signed_ids: video.map(&:signed_id) } }, as: :json

    expect(response).to have_http_status(:ok)
    expect(capsule.reload.audio.blobs).to match_array(audio)
    expect(capsule.video.blobs).to match_array(video)
  end

  it 'returns image URLs only after the seal is broken' do
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now)
    capsule.images.attach(io: StringIO.new('image'), filename: 'memory.jpg', content_type: 'image/jpeg')
    capsule.update!(unlock_at: 1.minute.ago)

    post open_api_capsule_path(capsule)
    get api_capsule_path(capsule)

    expect(response_body.fetch('image_urls')).to contain_exactly(a_string_including('/rails/active_storage/blobs/'))
  end

  it 'returns remote image links only after the seal is broken' do
    image_url = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now,
      design: { 'remote_image_urls' => [image_url] })
    capsule.update!(unlock_at: 1.minute.ago)

    post open_api_capsule_path(capsule)
    get api_capsule_path(capsule)

    expect(response_body.fetch('image_urls')).to contain_exactly(image_url)
  end

  it 'deletes a capsule and its stored media' do
    capsule = user.capsules.create!(title: 'Delete me', message: 'Private', unlock_at: 1.day.from_now)
    capsule.images.attach(io: StringIO.new('image'), filename: 'memory.jpg', content_type: 'image/jpeg')
    capsule.audio.attach(io: StringIO.new('audio'), filename: 'memory.mp3', content_type: 'audio/mpeg')

    image_blob = capsule.images.blobs.first
    audio_blob = capsule.audio.blobs.first
    expect { delete api_capsule_path(capsule), as: :json }.to change(Capsule, :count).by(-1)

    expect(response).to have_http_status(:no_content)
    expect { image_blob.reload }.to raise_error(ActiveRecord::RecordNotFound)
    expect { audio_blob.reload }.to raise_error(ActiveRecord::RecordNotFound)
  end

  it 'returns validation errors for an invalid capsule' do
    post api_capsules_path, params: { capsule: { title: '', message: '', unlock_at: '' } }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body.fetch('errors')).to include('title', 'message', 'unlock_at')
  end

  it 'hides the message of a locked capsule' do
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now)

    get api_capsule_path(capsule)

    expect(response_body).to include('locked' => true, 'message' => nil)
  end

  it 'returns a locked capsule’s sealed content to its owner for editing' do
    design = { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] }
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design)
    capsule.audio.attach(io: StringIO.new('audio'), filename: 'memory.mp3', content_type: 'audio/mpeg')

    get api_capsule_path(capsule), params: { editing: true }

    expect(response_body).to include('locked' => true, 'message' => 'Surprise!')
    expect(response_body.dig('design', 'sealed_blocks')).to eq(design['sealed_blocks'])
    expect(response_body.fetch('audio_url')).to contain_exactly(a_string_including('/rails/active_storage/blobs/'))
  end

  it 'preserves existing media and canvas blocks when a locked capsule is saved again' do
    design = { 'sealed_blocks' => [{ 'id' => 'audio-0', 'media_type' => 'audio', 'media_index' => 0 }] }
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design)
    capsule.images.attach(io: StringIO.new('image'), filename: 'memory.png', content_type: 'image/png')
    capsule.audio.attach(io: StringIO.new('audio'), filename: 'memory.mp3', content_type: 'audio/mpeg')

    patch api_capsule_path(capsule), params: { capsule: { title: capsule.title, message: capsule.message,
      unlock_at: capsule.unlock_at, design: design } }, as: :json

    expect(response).to have_http_status(:ok)
    expect(capsule.reload.images).to be_attached
    expect(capsule.audio).to be_attached
    expect(capsule.design).to eq(design)
  end

  it 'does not return sealed content in the capsule list' do
    design = { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] }
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design)
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsules_path

    expect(response_body.first).to include('locked' => false, 'message' => nil)
    expect(response_body.first.fetch('design')).not_to have_key('sealed_blocks')
  end

  describe 'breaking the seal' do
    let(:design) { { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] } }
    let(:capsule) { user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design) }

    it 'keeps an unlocked capsule closed until someone opens it' do
      capsule.update!(unlock_at: 1.minute.ago)

      get api_capsule_path(capsule)

      expect(response_body).to include('locked' => false, 'opened' => false, 'opened_at' => nil, 'message' => nil)
      expect(response_body.fetch('design')).not_to have_key('sealed_blocks')
    end

    it 'refuses to open a locked capsule' do
      post open_api_capsule_path(capsule)

      expect(response).to have_http_status(:forbidden)
      expect(response_body).to eq('error' => 'This capsule is locked')
      expect(capsule.reload.opened_at).to be_nil
    end

    it 'opens an unlocked capsule and returns its sealed content' do
      capsule.update!(unlock_at: 1.minute.ago)

      post open_api_capsule_path(capsule)

      expect(response).to have_http_status(:ok)
      expect(response_body).to include('locked' => false, 'opened' => true, 'message' => 'Surprise!')
      expect(response_body.fetch('design').fetch('sealed_blocks')).to eq(design['sealed_blocks'])
    end

    it 'stays open afterwards and keeps the first opening time' do
      capsule.update!(unlock_at: 1.minute.ago)
      post open_api_capsule_path(capsule)
      first_opened_at = capsule.reload.opened_at

      travel 1.hour do
        post open_api_capsule_path(capsule)
      end
      get api_capsule_path(capsule)

      expect(capsule.reload.opened_at).to eq(first_opened_at)
      expect(response_body).to include('opened' => true, 'message' => 'Surprise!')
    end

    it 'returns a JSON 404 when opening a capsule that does not exist' do
      post open_api_capsule_path(id: 999_999)

      expect(response).to have_http_status(:not_found)
    end
  end
end

RSpec.describe 'Capsules API with media', type: :request do
  let(:user) { User.create!(email_address: 'media-owner@example.com', password: 'a-secure-password') }
  before { post login_path, params: { email_address: user.email_address, password: 'a-secure-password' } }

  def response_body
    JSON.parse(response.body)
  end

  def media_design(photo_id, voice_id)
    {
      'theme' => { 'background_color' => '#E3E7DF', 'accent_color' => '#202923', 'font' => 'sans', 'icon' => '⏳' },
      'sealed_blocks' => [
        { 'id' => 'note-1', 'type' => 'text', 'text' => 'Private note', 'x' => 10, 'y' => 80, 'width' => 40, 'height' => 10, 'rotation' => 0 },
        { 'id' => 'photo-1', 'type' => 'image', 'media_id' => photo_id, 'x' => 50, 'y' => 50, 'width' => 40, 'height' => 30, 'rotation' => 3 },
        { 'id' => 'voice-1', 'type' => 'audio', 'media_id' => voice_id, 'x' => 8, 'y' => 72, 'width' => 46, 'height' => 10, 'rotation' => 0 }
      ]
    }
  end

  def create_capsule_with_media
    design = media_design(upload_signed_id(photo_upload), upload_signed_id(voice_upload))
    post api_capsules_path, params: { capsule: { title: 'Grad day', message: 'Proud of you', unlock_at: 1.day.from_now, design: design } }, as: :json
    expect(response).to have_http_status(:created)
    Capsule.find(response_body.fetch('id'))
  end

  def expect_no_media_references
    keys = all_json_keys(response_body)

    expect(keys).not_to include('url', 'media_id', 'signed_id')
    expect(response.body).not_to include('/rails/active_storage')
  end

  it 'attaches the uploaded files when a capsule is created' do
    capsule = create_capsule_with_media

    expect(capsule.media.map(&:content_type)).to contain_exactly('image/png', 'audio/x-wav')
  end

  it 'never exposes media in the create response of a locked capsule' do
    create_capsule_with_media

    expect_no_media_references
  end

  it 'never exposes media when showing a locked capsule' do
    capsule = create_capsule_with_media

    get api_capsule_path(capsule)

    expect(response_body).to include('locked' => true, 'message' => nil)
    expect_no_media_references
  end

  it 'never exposes media in the capsule list, even once unlocked' do
    capsule = create_capsule_with_media

    get api_capsules_path
    expect_no_media_references

    capsule.update!(unlock_at: 1.minute.ago)
    get api_capsules_path
    expect_no_media_references
  end

  it 'summarizes what is inside without revealing it while locked' do
    capsule = create_capsule_with_media

    get api_capsule_path(capsule)

    expect(response_body.fetch('contents')).to eq('notes' => 1, 'photos' => 1, 'audio' => 1)
  end

  it 'never exposes media of an unlocked capsule whose seal is unbroken' do
    capsule = create_capsule_with_media
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsule_path(capsule)

    expect(response_body).to include('locked' => false, 'opened' => false)
    expect_no_media_references
  end

  it 'never exposes media when opening a locked capsule is refused' do
    capsule = create_capsule_with_media

    post open_api_capsule_path(capsule)

    expect(response).to have_http_status(:forbidden)
    expect_no_media_references
  end

  it 'adds a working url to each media block once the seal is broken' do
    capsule = create_capsule_with_media
    capsule.update!(unlock_at: 1.minute.ago)

    post open_api_capsule_path(capsule)

    blocks = response_body.fetch('design').fetch('sealed_blocks').index_by { |block| block['id'] }
    expect(blocks['note-1']).not_to have_key('url')
    expect(blocks['photo-1']['url']).to start_with('/rails/active_storage/')
    expect(blocks['voice-1']['url']).to start_with('/rails/active_storage/')
    expect(response_body.fetch('contents')).to eq('notes' => 1, 'photos' => 1, 'audio' => 1)

    get blocks['photo-1']['url']
    follow_redirect!
    expect(response.body.b).to eq(MediaHelpers::PNG_BYTES)
  end

  it 'rejects a media block with an invalid id' do
    design = media_design('not-a-real-signed-id', upload_signed_id(voice_upload))

    expect {
      post api_capsules_path, params: { capsule: { title: 'Grad day', message: 'Hi', unlock_at: 1.day.from_now, design: design } }, as: :json
    }.not_to change(Capsule, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body.fetch('errors')).to eq('media' => ['Media is invalid'])
  end

  it 'rejects a photo block that points at a voice note' do
    voice_id = upload_signed_id(voice_upload)
    design = media_design(voice_id, voice_id)

    post api_capsules_path, params: { capsule: { title: 'Grad day', message: 'Hi', unlock_at: 1.day.from_now, design: design } }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body.fetch('errors')).to include('media')
  end

  it 'rejects a blob that skipped the upload checks' do
    blob = ActiveStorage::Blob.create_and_upload!(io: StringIO.new('MZ'), filename: 'setup.exe', content_type: 'application/x-msdownload')
    design = media_design(blob.signed_id, upload_signed_id(voice_upload))

    post api_capsules_path, params: { capsule: { title: 'Grad day', message: 'Hi', unlock_at: 1.day.from_now, design: design } }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'returns a JSON 404 for a capsule that does not exist' do
    get api_capsule_path(id: 999_999)

    expect(response).to have_http_status(:not_found)
    expect(response_body).to eq('error' => 'Capsule not found')
  end
end
