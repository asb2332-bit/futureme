class CapsuleInvitation < ApplicationRecord
  PURPOSE = :join_capsule_draft

  belongs_to :capsule
  normalizes :email, with: ->(email) { email.strip.downcase }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }
end
