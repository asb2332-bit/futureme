require 'rails_helper'

RSpec.describe 'Capsule icon layout', type: :request do
  let(:icon_layout) { { 'x' => 24, 'y' => 62, 'width' => 20, 'height' => 18, 'rotation' => -30 } }
  let(:sealed_blocks) { [{ 'id' => 'note-1', 'text' => 'A private poster note' }] }
  let(:attributes) do
    {
      title: 'A custom poster',
      message: 'A private message',
      unlock_at: 1.day.from_now,
      design: { 'icon_block' => icon_layout, 'sealed_blocks' => sealed_blocks }
    }
  end
  let(:capsule) { Capsule.create!(attributes) }

  def response_body
    JSON.parse(response.body)
  end

  def expect_public_layout(data)
    expect(data.fetch('design').fetch('icon_block')).to eq(icon_layout)
    expect(data.fetch('design')).not_to have_key('sealed_blocks')
    expect(data.fetch('message')).to be_nil
  end

  it 'returns the customized icon layout when a capsule is created' do
    post api_capsules_path, params: { capsule: attributes }, as: :json

    expect(response).to have_http_status(:created)
    expect_public_layout(response_body)
    expect(Capsule.last.design.fetch('icon_block')).to eq(icon_layout)
  end

  it 'includes the icon layout in the list without revealing unlocked content' do
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsules_path

    expect(response).to have_http_status(:ok)
    expect_public_layout(response_body.first)
    expect(response_body.first.fetch('locked')).to be(false)
  end

  it 'preserves the icon layout while a capsule is locked' do
    get api_capsule_path(capsule)

    expect(response).to have_http_status(:ok)
    expect_public_layout(response_body)
    expect(response_body.fetch('locked')).to be(true)
  end

  it 'preserves the icon layout alongside revealed content after unlocking' do
    capsule.update!(unlock_at: 1.minute.ago)

    get api_capsule_path(capsule)

    expect(response).to have_http_status(:ok)
    expect(response_body).to include('locked' => false, 'message' => attributes.fetch(:message))
    expect(response_body.fetch('design')).to include('icon_block' => icon_layout, 'sealed_blocks' => sealed_blocks)
  end
end
