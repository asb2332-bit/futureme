require 'spec_helper'
require_relative '../../app/models/poster_design'

RSpec.describe PosterDesign do
  let(:geometry) { { 'x' => 8, 'y' => 12.5, 'width' => 84, 'height' => 16, 'rotation' => -30 } }
  let(:theme) do
    { 'background_color' => '#E3E7DF', 'accent_color' => '#202923', 'font' => 'sans', 'icon' => '⏳' }
  end
  let(:full_design) do
    {
      'theme' => theme,
      'title_block' => geometry,
      'message_block' => geometry.merge('y' => 40),
      'icon_block' => geometry.merge('width' => 10),
      'sealed_blocks' => [geometry.merge('id' => 'note-1', 'text' => 'Private note')]
    }
  end

  it 'accepts the complete editor design and keeps sealed notes separate' do
    design = described_class.new(full_design)

    expect(design.validation_errors).to be_empty
    expect(design.public_data).to eq(full_design.reject { |key, _| key == 'sealed_blocks' })
    expect(design.sealed_data).to eq(full_design.fetch('sealed_blocks'))
  end

  it 'accepts empty and partial designs without filling stored data' do
    [{}, { theme: { font: 'serif', icon: '' }, title_block: { x: 8 }, sealed_blocks: [{ id: 'note-1', text: 'Private' }] }].each do |data|
      expect(described_class.new(data).validation_errors).to be_empty
    end

    expect(described_class.new({}).public_data).to eq(
      'theme' => {}, 'title_block' => {}, 'message_block' => {}, 'icon_block' => {}
    )
  end

  it 'accepts finite rotations and independent geometry without imposing a new layout rule' do
    design = { title_block: { x: 100, y: 0, width: 100, height: 0.1, rotation: 1080.5 } }

    expect(described_class.new(design).validation_errors).to be_empty
  end

  it 'normalizes symbol keys without mutating or retaining the input strings' do
    input = { theme: { icon: '✦' }, sealed_blocks: [{ text: 'Secret' }] }
    design = described_class.new(input)
    input[:theme][:icon].replace('Changed')

    expect(input.keys).to eq([:theme, :sealed_blocks])
    expect(design.public_data.fetch('theme')).to eq('icon' => '✦')
    expect(design.sealed_data).to eq([{ 'text' => 'Secret' }])
  end

  it 'rejects non-object roots and serializes them safely' do
    [nil, [], 'bad', false, 42].each do |data|
      design = described_class.new(data)

      expect(design.validation_errors).to eq(['must be an object'])
      expect(design.public_data.values).to all(eq({}))
      expect(design.sealed_data).to eq([])
    end
  end

  it 'rejects malformed theme, geometry, and sealed-note containers' do
    { 'theme' => [], 'title_block' => nil, 'message_block' => 'bad', 'icon_block' => 1, 'sealed_blocks' => {} }.each do |key, value|
      expect(described_class.new(key => value).validation_errors.join).to include(key)
    end
  end

  it 'rejects unsupported fields at every level' do
    data = {
      'private_text' => 'Root secret',
      'theme' => { 'private_text' => 'Theme secret' },
      'message_block' => { 'text' => 'Message secret' },
      'sealed_blocks' => [{ 'text' => 'Private note', 'extra' => 'Extra secret' }]
    }

    expect(described_class.new(data).validation_errors).to contain_exactly(
      'design contains unsupported fields: private_text',
      'theme contains unsupported fields: private_text',
      'message_block contains unsupported fields: text',
      'sealed_blocks[0] contains unsupported fields: extra'
    )
  end

  it 'rejects invalid theme values' do
    values = { 'background_color' => 'red', 'accent_color' => '#123', 'font' => 'unknown', 'icon' => [] }

    values.each do |field, value|
      expect(described_class.new('theme' => { field => value }).validation_errors.join).to include("theme.#{field}")
    end
  end

  it 'rejects invalid numbers and bounds in public and sealed geometry' do
    invalid = { 'x' => [-1, 101, '8', nil, Float::NAN], 'y' => [Float::INFINITY], 'width' => [0, -1, 101], 'height' => [0], 'rotation' => [Float::INFINITY, 10**400, true] }

    invalid.each do |field, values|
      values.each do |value|
        expect(described_class.new('title_block' => { field => value }).validation_errors.join).to include("title_block.#{field}")
        expect(described_class.new('sealed_blocks' => [{ field => value }]).validation_errors.join).to include("sealed_blocks[0].#{field}")
      end
    end
  end

  it 'rejects malformed notes, non-string text, and blank or duplicate IDs' do
    notes = [nil, 'bad', { 'id' => ' ' }, { 'text' => [] }, { 'id' => 'same' }, { 'id' => 'same' }]
    errors = described_class.new('sealed_blocks' => notes).validation_errors

    expect(errors).to contain_exactly(
      'sealed_blocks[0] must be an object',
      'sealed_blocks[1] must be an object',
      'sealed_blocks[2].id must be a non-empty string',
      'sealed_blocks[3].text must be a string',
      'sealed_blocks[5].id must be unique'
    )
  end

  it 'does not expose unexpected legacy text in public poster data' do
    legacy = full_design.merge(
      'theme' => theme.merge('private_text' => 'Secret theme text'),
      'title_block' => geometry.merge('nested' => { 'message' => 'Secret nested text' }),
      'message_block' => { 'x' => 8, 'text' => 'Secret message text' },
      'icon_block' => { 'text' => 'Secret icon text', 'rotation' => 'bad' }
    )

    expect(described_class.new(legacy).public_data).to eq(
      'theme' => theme, 'title_block' => geometry, 'message_block' => { 'x' => 8 }, 'icon_block' => {}
    )
  end

  it 'safely filters malformed legacy fields and notes without losing valid text' do
    legacy = {
      'theme' => { 'font' => 'bad', 'icon' => '✦', 'background_color' => [] },
      'title_block' => ['bad'],
      'message_block' => { 'width' => -1, 'x' => 5 },
      'sealed_blocks' => [nil, 'bad', {}, { 'text' => false }, { 'id' => 'note-1', 'text' => 'Keep me', 'width' => 0, 'rotation' => 45, 'extra' => 'Discard me' }]
    }
    design = described_class.new(legacy)

    expect(design.public_data).to eq('theme' => { 'icon' => '✦' }, 'title_block' => {}, 'message_block' => { 'x' => 5 }, 'icon_block' => {})
    expect(design.sealed_data).to eq([{ 'id' => 'note-1', 'text' => 'Keep me', 'rotation' => 45 }])
    expect(described_class.new('sealed_blocks' => 'bad').sealed_data).to eq([])
  end
end
