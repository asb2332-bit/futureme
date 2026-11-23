require 'rails_helper'

RSpec.describe 'Capsule recipients', type: :request do
  let!(:owner) { User.create!(email_address: 'owner@example.com', password: 'secure-password-123') }
  let!(:recipient) { User.create!(email_address: 'friend@example.com', password: 'secure-password-123') }

  def login(user)
    post login_path, params: { email_address: user.email_address, password: 'secure-password-123' }
  end

  it 'sends a seal notice, restricts editing and content, then sends one unlock notice' do
    login(owner)
    ActionMailer::Base.deliveries.clear
    post api_capsules_path, params: { capsule: { title: 'Hello', message: 'Private memory', unlock_at: 1.day.from_now, recipient_emails: ['FRIEND@example.com'] } }, as: :json
    expect(response).to have_http_status(:created)
    capsule = Capsule.last
    expect(capsule.recipients.pluck(:email)).to eq(['friend@example.com'])
    notice = ActionMailer::Base.deliveries.find { |mail| mail.to == ['friend@example.com'] }
    token = capsule.recipients.first.signed_id(purpose: :capsule_share)
    link = capsule_invitation_link_path(token)
    expect(notice.body.decoded).to include(link)
    expect(notice.body.decoded).not_to include('Private memory')

    post logout_path
    get link
    expect(response).to redirect_to(login_path)
    login(recipient)
    expect(response).to redirect_to(link)
    get api_capsule_path(capsule)
    expect(response).to have_http_status(:not_found)
    get link
    expect(response).to redirect_to("/capsule.html?id=#{capsule.id}")
    get api_capsule_path(capsule)
    expect(response.parsed_body).to include('locked' => true, 'message' => nil, 'owner' => false, 'contents' => nil)
    get api_capsule_path(capsule), params: { editing: true }
    expect(response).to have_http_status(:not_found)
    patch api_capsule_path(capsule), params: { capsule: { title: 'Stolen' } }, as: :json
    expect(response).to have_http_status(:not_found)

    capsule.update!(unlock_at: 1.minute.ago)
    capsule.recipients.first.deliver_pending!
    capsule.recipients.first.deliver_pending!
    emails = ActionMailer::Base.deliveries.select { |mail| mail.to == ['friend@example.com'] }
    expect(emails.size).to eq(2)
    expect(emails.last.body.decoded).not_to include('Private memory')
    get api_capsule_path(capsule)
    expect(response.parsed_body).to include('locked' => false, 'message' => 'Private memory')
    expect(response.parsed_body.fetch('contents')).to include('notes' => 0, 'photos' => 0)
  end

  it 'denies a shared link to a different account and revokes removed recipients' do
    capsule = owner.capsules.create!(title: 'Hello', message: 'Private', unlock_at: 1.day.from_now)
    share = capsule.recipients.create!(email: recipient.email_address)
    link = capsule_invitation_link_path(share.signed_id(purpose: :capsule_share))
    stranger = User.create!(email_address: 'stranger@example.com', password: 'secure-password-123')
    login(stranger)
    get link
    expect(response).to have_http_status(:not_found)
    get api_capsule_path(capsule)
    expect(response).to have_http_status(:not_found)
    post logout_path
    login(recipient)
    get link
    expect(response).to have_http_status(:redirect)
    share.destroy!
    get api_capsule_path(capsule)
    expect(response).to have_http_status(:not_found)
  end

  it 'rejects invalid addresses and does not change recipients on invalid edits' do
    login(owner)
    post api_capsules_path, params: { capsule: { title: 'Hello', message: 'Private', unlock_at: 1.day.from_now, recipient_emails: ['bad email'] } }, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(Capsule.count).to eq(0)
    capsule = owner.capsules.create!(title: 'Hello', message: 'Private', unlock_at: 1.day.from_now)
    capsule.recipients.create!(email: recipient.email_address)
    patch api_capsule_path(capsule), params: { capsule: { title: '', recipient_emails: [] } }, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(capsule.recipients.pluck(:email)).to eq([recipient.email_address])
  end
end
