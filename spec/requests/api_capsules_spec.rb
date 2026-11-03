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

  it 'returns sealed content of an unlocked capsule' do
    design = { 'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }] }
    capsule = Capsule.create!(title: 'Birthday', message: 'Surprise!', unlock_at: 1.day.from_now, design: design)
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsule_path(capsule)

    expect(response_body).to include('locked' => false, 'message' => 'Surprise!')
    expect(response_body.fetch('design').fetch('sealed_blocks')).to eq(design['sealed_blocks'])
  end
end
