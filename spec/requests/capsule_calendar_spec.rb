require 'rails_helper'

RSpec.describe 'Capsule calendar reminders', type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { User.create!(email_address: 'owner@example.com', password: 'a-secure-password') }
  before { post login_path, params: { email_address: user.email_address, password: 'a-secure-password' } }

  let(:capsule) do
    user.capsules.create!(
      title: 'Graduation wishes',
      message: 'Private main message',
      unlock_at: Time.new(Time.current.year + 1, 3, 15, 9, 30, 0, '-04:00'),
      design: {
        'theme' => { 'background_color' => '#202923', 'icon' => '✦' },
        'sealed_blocks' => [{ 'id' => 'note-1', 'text' => 'Private poster note' }]
      }
    )
  end

  def calendar_lines
    response.body.gsub(/\r\n[ \t]/, '').split("\r\n")
  end

  def calendar_uid
    calendar_lines.find { |line| line.start_with?('UID:') }
  end

  def expect_calendar_error(status)
    expect(response).to have_http_status(status)
    expect(response.media_type).to eq('application/json')
    expect(JSON.parse(response.body).fetch('error')).to be_present
    expect(response.headers['Content-Disposition']).to be_nil
    expect(response.headers.fetch('Cache-Control')).to include('private', 'no-store')
    expect(response.body).not_to include('BEGIN:VCALENDAR')
  end

  it 'downloads a private calendar attachment for the correct unlock time' do
    get calendar_api_capsule_path(capsule)

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq('text/calendar')
    expect(response.content_type.downcase).to include('charset=utf-8')
    expect(response.headers.fetch('Content-Disposition')).to include('attachment', "futureme-capsule-#{capsule.id}.ics")
    expect(response.headers.fetch('Cache-Control')).to include('private', 'no-store')
    expect(calendar_lines).to include(
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      "DTSTART:#{capsule.unlock_at.utc.strftime('%Y%m%dT%H%M%SZ')}",
      'CLASS:PRIVATE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    )
    expect(calendar_lines.join("\n")).to include('Graduation wishes', "/capsule.html?id=#{capsule.id}")
    expect(response.body).to end_with("\r\n")
  end

  [true, false].each do |locked|
    it "excludes private messages and poster data when locked is #{locked}" do
      capsule.update!(unlock_at: 1.minute.ago) unless locked

      get calendar_api_capsule_path(capsule)

      if locked
        expect(response).to have_http_status(:ok)
        expect(calendar_lines.join("\n")).to include('Graduation wishes')
      else
        expect_calendar_error(:unprocessable_entity)
        expect(response.body).not_to include(capsule.title)
      end
      expect(response.body).not_to include('Private main message', 'Private poster note', 'sealed_blocks', '#202923', '✦')
    end
  end

  [0, 15, 60, 1440, 10080].each do |minutes|
    it "downloads the supported #{minutes}-minute reminder" do
      get calendar_api_capsule_path(capsule), params: { remind_before: minutes.to_s, private_title: 'false' }

      expect(response).to have_http_status(:ok)
      expect(calendar_lines).to include("TRIGGER:#{minutes.zero? ? 'PT0S' : "-PT#{minutes}M"}")
      expect(calendar_lines).to include("SUMMARY:Open your capsule: #{capsule.title}")
    end
  end

  it 'exports a generic calendar title without changing the capsule' do
    get calendar_api_capsule_path(capsule), params: { private_title: 'true', remind_before: '60' }

    expect(response).to have_http_status(:ok)
    expect(calendar_lines).to include('SUMMARY:Open your time capsule', 'DESCRIPTION:Your time capsule unlocks soon.')
    expect(response.body).not_to include(capsule.title, capsule.message, 'Private poster note')
    expect(capsule.reload.title).to eq('Graduation wishes')
  end

  ['', '-15', '1', '15.0', ' 15', "15\nBEGIN:VEVENT", ['15'], { minutes: '15' }].each do |value|
    it "rejects malformed reminder time #{value.inspect}" do
      get calendar_api_capsule_path(capsule), params: { remind_before: value }

      expect_calendar_error(:unprocessable_entity)
    end
  end

  ['', 'TRUE', '1', ['true'], { value: 'true' }].each do |value|
    it "rejects malformed title privacy #{value.inspect}" do
      get calendar_api_capsule_path(capsule), params: { private_title: value }

      expect_calendar_error(:unprocessable_entity)
    end
  end

  [0, 15, 60, 1440, 10080].each do |minutes|
    it "rejects an alert that has reached its #{minutes}-minute reminder time" do
      freeze_time do
        capsule.update!(unlock_at: Time.current + minutes.minutes)

        get calendar_api_capsule_path(capsule), params: { remind_before: minutes.to_s }

        expect_calendar_error(:unprocessable_entity)
        expect(JSON.parse(response.body).fetch('error')).to include('already passed')
        expect(response.body).not_to include(capsule.title, capsule.message)
      end
    end
  end

  it 'allows an alert whose scheduled time is still in the future' do
    freeze_time do
      capsule.update!(unlock_at: Time.current + 15.minutes + 1.second)

      get calendar_api_capsule_path(capsule), params: { remind_before: '15' }

      expect(response).to have_http_status(:ok)
      expect(calendar_lines).to include('TRIGGER:-PT15M')
    end
  end

  it 'does not create or modify a capsule when a reminder is downloaded' do
    original_attributes = capsule.attributes.deep_dup

    expect {
      get calendar_api_capsule_path(capsule)
    }.not_to change(Capsule, :count)

    expect(response).to have_http_status(:ok)
    expect(capsule.reload.attributes).to eq(original_attributes)
  end

  it 'keeps the event identity stable for repeated downloads and distinct for different capsules' do
    get calendar_api_capsule_path(capsule)
    first_uid = calendar_uid
    expect(first_uid).to be_present

    get calendar_api_capsule_path(capsule)
    expect(calendar_uid).to eq(first_uid)

    another = user.capsules.create!(title: capsule.title, message: 'Another secret', unlock_at: capsule.unlock_at)
    get calendar_api_capsule_path(another)

    expect(calendar_uid).to be_present
    expect(calendar_uid).not_to eq(first_uid)
  end

  it 'requires login before downloading a reminder' do
    capsule_id = capsule.id
    post logout_path

    get calendar_api_capsule_path(capsule_id)

    expect_calendar_error(:unauthorized)
    expect(response.body).not_to include('BEGIN:VCALENDAR', capsule.title)
  end

  it 'does not reveal another account capsule through a reminder' do
    other_user = User.create!(email_address: 'another@example.com', password: 'a-secure-password')
    other_capsule = other_user.capsules.create!(title: 'Another private title', message: 'Another secret', unlock_at: 1.day.from_now)

    get calendar_api_capsule_path(other_capsule), params: { private_title: 'true', remind_before: 'invalid' }

    expect_calendar_error(:not_found)
    expect(response.body).not_to include('BEGIN:VCALENDAR', other_capsule.title, other_capsule.message)
  end

  it 'returns not found for a capsule that does not exist' do
    get calendar_api_capsule_path(-1)

    expect_calendar_error(:not_found)
  end
end
