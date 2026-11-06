require 'rails_helper'

RSpec.describe 'Capsules API', type: :request do
  def response_body
    JSON.parse(response.body)
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

  it 'returns validation errors for an invalid capsule' do
    post api_capsules_path, params: { capsule: { title: '', message: '', unlock_at: '' } }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response_body.fetch('errors')).to include('title', 'message', 'unlock_at')
  end

  it 'hides the message of a locked capsule' do
    capsule = Capsule.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now)

    get api_capsule_path(capsule)

    expect(response_body).to include('locked' => true, 'message' => nil)
  end

  it 'does not return sealed content in the capsule list' do
    design = { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] }
    capsule = Capsule.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design)
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsules_path

    expect(response_body.first).to include('locked' => false, 'message' => nil)
    expect(response_body.first.fetch('design')).not_to have_key('sealed_blocks')
  end

  describe 'breaking the seal' do
    let(:design) { { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] } }
    let(:capsule) { Capsule.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design) }

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
