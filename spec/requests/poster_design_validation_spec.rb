require 'rails_helper'

RSpec.describe 'Poster design validation', type: :request do
  let(:attributes) do
    { title: 'A future memory', message: 'Private main message', unlock_at: 1.day.from_now }
  end
  let(:layout) { { 'x' => 8, 'y' => 10, 'width' => 72, 'height' => 16, 'rotation' => -12 } }
  let(:design) do
    {
      'theme' => { 'background_color' => '#202923', 'accent_color' => '#F5E8C8', 'font' => 'serif', 'icon' => '✦' },
      'title_block' => layout,
      'message_block' => layout.merge('y' => 36, 'height' => 38),
      'icon_block' => layout.merge('x' => 82, 'y' => 8, 'width' => 10, 'height' => 12),
      'sealed_blocks' => [layout.merge('id' => 'note-1', 'text' => 'Private extra note')]
    }
  end

  def response_body
    JSON.parse(response.body)
  end

  def expect_json_error(status, field)
    expect(response).to have_http_status(status)
    expect(response.media_type).to eq('application/json')
    expect(response_body.fetch('errors').fetch(field)).to be_an(Array)
    expect(response_body.fetch('errors').fetch(field)).not_to be_empty
  end

  [
    {},
    { capsule: nil },
    { capsule: 'not an object' },
    { capsule: [] },
    { capsule: [{ title: 'A nested capsule' }] }
  ].each do |payload|
    it "returns a structured bad-request error for #{payload.inspect}" do
      expect {
        post api_capsules_path, params: payload, as: :json
      }.not_to change(Capsule, :count)

      expect_json_error(400, 'capsule')
    end
  end

  it 'returns a JSON error for a malformed JSON request body' do
    expect {
      post api_capsules_path,
        params: '{"capsule":',
        headers: { 'CONTENT_TYPE' => 'application/json', 'ACCEPT' => 'application/json' }
    }.not_to change(Capsule, :count)

    expect(response).to have_http_status(400)
    expect(response.media_type).to eq('application/json')
    expect(response_body.fetch('errors')).to be_a(Hash)
    expect(response_body.fetch('errors')).not_to be_empty
  end

  {
    'a null design' => nil,
    'a scalar design' => 'private data',
    'an array design' => [],
    'an array theme' => { 'theme' => [] },
    'a scalar layout' => { 'message_block' => 'private data' },
    'an object in place of sealed notes' => { 'sealed_blocks' => { 'text' => 'Private extra note' } },
    'a nonnumeric coordinate' => { 'title_block' => { 'x' => 'left' } },
    'a zero width' => { 'title_block' => { 'width' => 0 } },
    'a coordinate outside the poster' => { 'icon_block' => { 'x' => 101 } },
    'an unsupported font' => { 'theme' => { 'font' => 'unknown-font' } },
    'a private field in the public theme' => { 'theme' => { 'private_text' => 'Private extra note' } },
    'text in a public layout' => { 'message_block' => { 'text' => 'Private extra note' } },
    'an unknown top-level field' => { 'private_message' => 'Private extra note' }
  }.each do |description, invalid_design|
    it "rejects #{description} without saving a capsule" do
      expect {
        post api_capsules_path, params: { capsule: attributes.merge(design: invalid_design) }, as: :json
      }.not_to change(Capsule, :count)

      expect_json_error(422, 'design')
    end
  end

  it 'allows an omitted design and partial supported poster fields' do
    post api_capsules_path, params: { capsule: attributes }, as: :json

    expect(response).to have_http_status(:created)
    expect(Capsule.last.design).to eq({})

    partial_design = { 'title_block' => { 'x' => 8 }, 'sealed_blocks' => [{ 'text' => 'An unfinished note' }] }
    post api_capsules_path, params: { capsule: attributes.merge(design: partial_design) }, as: :json

    expect(response).to have_http_status(:created)
    expect(Capsule.last.design).to eq(partial_design)
  end

  it 'preserves a complete editor design and reveals its text only after unlocking' do
    post api_capsules_path, params: { capsule: attributes.merge(design: design) }, as: :json

    expect(response).to have_http_status(:created)
    expect(response_body.fetch('design')).to eq(design.except('sealed_blocks'))
    expect(response_body.fetch('message')).to be_nil
    expect(response.body).not_to include('Private main message', 'Private extra note')
    capsule = Capsule.find(response_body.fetch('id'))
    expect(capsule.design).to eq(design)

    get api_capsule_path(capsule)

    expect(response).to have_http_status(:ok)
    expect(response_body.fetch('design')).to eq(design.except('sealed_blocks'))
    expect(response.body).not_to include('Private main message', 'Private extra note')

    capsule.update!(unlock_at: 1.minute.ago)
    get api_capsule_path(capsule)

    expect(response).to have_http_status(:ok)
    expect(response_body).to include('locked' => false, 'message' => 'Private main message')
    expect(response_body.fetch('design')).to eq(design)

    get api_capsules_path

    expect(response).to have_http_status(:ok)
    expect(response_body.first.fetch('design')).to eq(design.except('sealed_blocks'))
    expect(response.body).not_to include('Private main message', 'Private extra note')
  end

  it 'removes private extra fields from legacy public layouts while keeping valid geometry' do
    capsule = Capsule.create!(attributes)
    capsule.update_columns(design: {
      'theme' => design.fetch('theme').merge('private_text' => 'Legacy secret'),
      'title_block' => layout.merge('text' => 'Legacy secret'),
      'message_block' => layout.merge('content' => { 'text' => 'Legacy secret' }),
      'icon_block' => layout.merge('text' => 'Legacy secret'),
      'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private extra note' }]
    })

    [api_capsule_path(capsule), api_capsules_path].each do |path|
      get path

      expect(response).to have_http_status(:ok)
      data = response_body.is_a?(Array) ? response_body.first : response_body
      expect(data.fetch('design')).to eq(
        'theme' => design.fetch('theme'),
        'title_block' => layout,
        'message_block' => layout,
        'icon_block' => layout
      )
      expect(response.body).not_to include('Legacy secret', 'Private main message', 'Private extra note')
    end
  end

  [[], 'invalid stored design'].each do |invalid_design|
    it "keeps legacy #{invalid_design.inspect} design data from breaking list or detail responses" do
      capsule = Capsule.create!(attributes)
      capsule.update_columns(design: invalid_design, unlock_at: 1.minute.ago)

      get api_capsules_path

      expect(response).to have_http_status(:ok)
      expect(response_body.first.fetch('design')).to eq(
        'theme' => {}, 'title_block' => {}, 'message_block' => {}, 'icon_block' => {}
      )
      expect(response_body.first.fetch('message')).to be_nil

      get api_capsule_path(capsule)

      expect(response).to have_http_status(:ok)
      expect(response_body.fetch('design').fetch('sealed_blocks')).to eq([])
      expect(response_body.fetch('message')).to eq('Private main message')
    end
  end

  [{ 'text' => 'Legacy note' }, 'Legacy note'].each do |invalid_notes|
    it "returns an empty note list for legacy #{invalid_notes.inspect} sealed blocks" do
      capsule = Capsule.create!(attributes)
      capsule.update_columns(design: { 'sealed_blocks' => invalid_notes }, unlock_at: 1.minute.ago)

      get api_capsule_path(capsule)

      expect(response).to have_http_status(:ok)
      expect(response_body.fetch('design').fetch('sealed_blocks')).to eq([])
    end
  end

  it 'skips malformed legacy notes and strips unsupported fields from readable notes' do
    note = layout.merge('id' => 'note-1', 'text' => 'A readable private note')
    capsule = Capsule.create!(attributes)
    capsule.update_columns(
      design: { 'sealed_blocks' => [nil, 'broken', { 'text' => 123 }, note.merge('internal' => 'Do not expose')] },
      unlock_at: 1.minute.ago
    )

    get api_capsule_path(capsule)

    expect(response).to have_http_status(:ok)
    expect(response_body.fetch('design').fetch('sealed_blocks')).to eq([note])
    expect(response.body).not_to include('Do not expose')
  end
end
