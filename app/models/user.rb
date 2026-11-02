class User < ApplicationRecord
  validates :email_address, presence: true, uniqueness: true
end
