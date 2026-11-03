require 'rails_helper'

RSpec.describe Capsule, type: :model do
  subject(:capsule) { described_class.new(title: 'Graduation', message: 'We made it!', unlock_at: 1.day.from_now) }

  it 'is valid with a title, message, and future unlock time' do
    expect(capsule).to be_valid
  end

  it 'requires every core field' do
    capsule.title = capsule.message = capsule.unlock_at = nil

    expect(capsule).not_to be_valid
    expect(capsule.errors).to include(:title, :message, :unlock_at)
  end

  it 'rejects an unlock time in the past on creation' do
    capsule.unlock_at = 1.minute.ago

    expect(capsule).not_to be_valid
    expect(capsule.errors[:unlock_at]).to include('must be in the future')
  end

  it 'starts with empty design data' do
    capsule.save!

    expect(capsule.reload.design).to eq({})
  end

  it 'stores poster design data as JSON' do
    design = {
      'theme' => { 'background_color' => '#E3E7DF', 'font' => 'sans', 'icon' => '⏳' },
      'title_block' => { 'x' => 8, 'y' => 8, 'width' => 84, 'height' => 16, 'rotation' => 0 },
      'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private note' }]
    }

    capsule.update!(design: design)

    expect(capsule.reload.design).to eq(design)
  end

  describe '#locked?' do
    it 'is true before the unlock time' do
      expect(capsule.locked?).to be(true)
    end

    it 'is false once the unlock time has passed' do
      capsule.unlock_at = 1.minute.ago

      expect(capsule.locked?).to be(false)
    end
  end

  describe '#unlocked?' do
    it 'is false before the unlock time' do
      expect(capsule.unlocked?).to be(false)
    end

    it 'is true once the unlock time has passed' do
      capsule.unlock_at = 1.minute.ago

      expect(capsule.unlocked?).to be(true)
    end
  end
end
