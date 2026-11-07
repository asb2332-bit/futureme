class User < ApplicationRecord
  has_secure_password validations: false
  has_many :capsules, dependent: :restrict_with_error

  normalizes :email_address, with: ->(email) { email.strip.downcase }
  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: %w[user admin] }
  validates :password, presence: true, on: :create, unless: -> { google_uid.present? }
  validates :password, length: { minimum: 12, maximum: 72 }, confirmation: true, if: -> { password.present? }
  validates :google_uid, uniqueness: true, allow_nil: true
  validate do
    errors.add(:password, "must be at most 72 bytes") if password.present? && password.bytesize > 72
  end

  def admin?
    role == "admin"
  end

  def self.from_google(auth)
    raise ArgumentError, "Invalid Google identity" unless auth&.provider == "google_oauth2" && auth.uid.present? &&
      auth.dig("extra", "raw_info", "email_verified") == true && auth.info.email.present?

    find_by(google_uid: auth.uid) || begin
      email = auth.info.email.strip.downcase
      # Do not silently link an unverified password account by email.
      raise ArgumentError, "Use your password to sign in to this existing account." if exists?(email_address: email)
      create!(email_address: email, google_uid: auth.uid)
    end
  end
end
