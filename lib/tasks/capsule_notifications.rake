namespace :capsules do
  desc "Send pending recipient notifications"
  task notify_recipients: :environment do
    CapsuleRecipient.joins(:capsule).where("capsule_recipients.sealed_sent_at IS NULL OR (capsules.unlock_at <= ? AND capsule_recipients.unlocked_sent_at IS NULL)", Time.current).find_each do |recipient|
      recipient.deliver_pending!
    rescue StandardError => error
      Rails.logger.error("Recipient notification failed for recipient #{recipient.id}: #{error.class}")
    end
  end
end
