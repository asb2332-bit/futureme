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
    expect(response_body.dig('errors', 'base')).to include('You can create up to 5 capsules.')
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

  it 'returns every audio and video URL only after a capsule unlocks' do
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now)
    2.times { |i| capsule.audio.attach(io: StringIO.new("audio #{i}"), filename: 'memory.mp3', content_type: 'audio/mpeg') }
    2.times { |i| capsule.video.attach(io: StringIO.new("video #{i}"), filename: 'memory.mp4', content_type: 'video/mp4') }
    capsule.update!(unlock_at: 1.minute.ago)

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

  it 'returns image URLs only after a capsule unlocks' do
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now)
    capsule.images.attach(io: StringIO.new('image'), filename: 'memory.jpg', content_type: 'image/jpeg')
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsule_path(capsule)

    expect(response_body.fetch('image_urls')).to contain_exactly(a_string_including('/rails/active_storage/blobs/'))
  end

  it 'returns remote image links only after a capsule unlocks' do
    image_url = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now,
      design: { 'remote_image_urls' => [image_url] })
    capsule.update!(unlock_at: 1.minute.ago)

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

  it 'does not return sealed content in the capsule list' do
    design = { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] }
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design)
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsules_path

    expect(response_body.first).to include('locked' => false, 'message' => nil)
    expect(response_body.first.fetch('design')).not_to have_key('sealed_blocks')
  end

  it 'returns sealed content of an unlocked capsule' do
    design = { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] }
    capsule = user.capsules.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design)
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsule_path(capsule)

    expect(response_body).to include('locked' => false, 'message' => 'Surprise!')
    expect(response_body.fetch('design').fetch('sealed_blocks')).to eq(design['sealed_blocks'])
  end
end
