require 'rails_helper'

RSpec.describe User, type: :model do
  it 'requires a unique email address' do
    described_class.create!(email_address: 'amit@example.com')

    expect(described_class.new(email_address: 'amit@example.com')).not_to be_valid
  end
end
