class CapsuleRecipient < ApplicationRecord
  belongs_to :capsule
  normalizes :email, with: ->(email) { email.strip.downcase }
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }
  validates :email, uniqueness: { scope: :capsule_id }

  def deliver_pending!
    # shortcut: a crash after SMTP acceptance can duplicate mail, use an idempotent mail provider if needed.
    with_lock do
      capsule.reload
      return if capsule.draft?
      unless sealed_sent_at
        CapsuleMailer.recipient_sealed(self).deliver_now!
        update!(sealed_sent_at: Time.current)
      end
      if capsule.unlocked? && !unlocked_sent_at
        CapsuleMailer.recipient_unlocked(self).deliver_now!
        update!(unlocked_sent_at: Time.current)
      end
    end
  end
end
