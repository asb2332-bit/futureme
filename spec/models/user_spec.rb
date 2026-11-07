require 'rails_helper'

RSpec.describe User, type: :model do
  it 'requires a unique email address' do
    described_class.create!(email_address: 'amit@example.com', password: 'a-secure-password')

    expect(described_class.new(email_address: 'amit@example.com', password: 'a-secure-password')).not_to be_valid
  end
  it 'rejects passwords longer than bcrypt can safely hash, including Unicode' do
    user = described_class.new(email_address: 'unicode@example.com', password: 'é' * 40)
    expect(user).not_to be_valid
    expect(user.errors[:password]).to include('must be at most 72 bytes')
  end
end
