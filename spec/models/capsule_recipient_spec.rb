require 'rails_helper'
require 'rake'

RSpec.describe CapsuleRecipient do
  it 'retries failed mail and sends an unlock notice only after the unlock time' do
    user = User.create!(email_address: 'owner@example.com', password: 'secure-password-123')
    capsule = user.capsules.create!(title: 'Title', message: 'Private', unlock_at: 1.day.from_now)
    recipient = capsule.recipients.create!(email: 'friend@example.com')
    ActionMailer::Base.deliveries.clear
    allow(CapsuleMailer).to receive(:recipient_sealed).and_raise(IOError)
    expect { recipient.deliver_pending! }.to raise_error(IOError)
    expect(recipient.reload.sealed_sent_at).to be_nil
    allow(CapsuleMailer).to receive(:recipient_sealed).and_call_original

    Rails.application.load_tasks unless Rake::Task.task_defined?('capsules:notify_recipients')
    task = Rake::Task['capsules:notify_recipients']
    task.reenable
    task.invoke
    expect(ActionMailer::Base.deliveries.size).to eq(1)
    expect(recipient.reload.unlocked_sent_at).to be_nil
    capsule.update!(unlock_at: 1.minute.ago)
    2.times { task.reenable; task.invoke }
    expect(ActionMailer::Base.deliveries.size).to eq(2)
    expect(recipient.reload.unlocked_sent_at).to be_present
  end
end
