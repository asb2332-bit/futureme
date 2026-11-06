require 'rails_helper'
require 'rake'

RSpec.describe 'futureme:purge_unattached_uploads' do
  before(:all) { Rails.application.load_tasks unless Rake::Task.task_defined?('futureme:purge_unattached_uploads') }

  let(:task) { Rake::Task['futureme:purge_unattached_uploads'] }

  def blob(created_at)
    ActiveStorage::Blob.create_and_upload!(io: StringIO.new(MediaHelpers::PNG_BYTES), filename: 'x.png', content_type: 'image/png').tap do |b|
      b.update_columns(created_at: created_at)
    end
  end

  it 'purges unattached uploads older than a day and keeps everything else' do
    old_orphan = blob(2.days.ago)
    new_orphan = blob(1.hour.ago)
    sealed = blob(2.days.ago)
    Capsule.create!(title: 'T', message: 'M', unlock_at: 1.day.from_now).media.attach(sealed)

    expect { task.execute }.to output("Purged 1 unattached upload.\n").to_stdout

    expect(ActiveStorage::Blob.exists?(old_orphan.id)).to be(false)
    expect(ActiveStorage::Blob.exists?(new_orphan.id)).to be(true)
    expect(ActiveStorage::Blob.exists?(sealed.id)).to be(true)
  end
end
