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

  it 'rejects media exceeding the 2 MB capsule limit' do
    capsule.images.attach(io: StringIO.new('x' * 1.1.megabytes), filename: 'first.png', content_type: 'image/png')
    capsule.audio.attach(io: StringIO.new('y' * 1.1.megabytes), filename: 'second.mp3', content_type: 'audio/mpeg')

    expect(capsule).not_to be_valid
    expect(capsule.errors[:base]).to include('uploaded media must be 2 MB or smaller in total')
  end

  it 'accepts image, audio, and video files totaling exactly 2 MB' do
    files = Rails.root.join('spec/fixtures/files')
    capsule.images.attach(io: File.open(files.join('capsule-at-limit.png')), filename: 'capsule-at-limit.png', content_type: 'image/png')
    capsule.audio.attach(io: File.open(files.join('capsule-at-limit.mp3')), filename: 'capsule-at-limit.mp3', content_type: 'audio/mpeg')
    capsule.video.attach(io: File.open(files.join('capsule-at-limit.mp4')), filename: 'capsule-at-limit.mp4', content_type: 'video/mp4')

    expect(capsule).to be_valid
    expect(capsule.images.blobs.first.byte_size + capsule.audio.blobs.first.byte_size + capsule.video.blobs.first.byte_size).to eq(2.megabytes)
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

  describe '#open!' do
    it 'does nothing while locked' do
      capsule.save!

      expect(capsule.open!).to be(false)
      expect(capsule.reload.opened_at).to be_nil
      expect(capsule).not_to be_opened
    end

    it 'records the first opening once unlocked' do
      capsule.save!
      capsule.update!(unlock_at: 1.minute.ago)

      expect(capsule).not_to be_opened
      expect(capsule.open!).to be(true)
      first = capsule.reload.opened_at

      travel 1.hour do
        capsule.open!
      end

      expect(capsule.reload.opened_at).to eq(first)
      expect(capsule).to be_opened
    end
  end
end
