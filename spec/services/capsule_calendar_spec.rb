require 'spec_helper'
require 'active_support'
require 'active_support/core_ext/time'
require_relative '../../app/services/capsule_calendar'

RSpec.describe CapsuleCalendar do
  subject(:calendar) { described_class.new(capsule, url: url, generated_at: generated_at).to_ical }

  let(:capsule) do
    double('Capsule', id: 42, title: title, created_at: created_at, updated_at: updated_at, unlock_at: unlock_at)
  end
  let(:title) { 'A letter for next year' }
  let(:created_at) { Time.iso8601('2026-11-05T08:12:30.123456-05:00') }
  let(:updated_at) { Time.iso8601('2026-11-05T09:15:00-05:00') }
  let(:unlock_at) { Time.iso8601('2027-11-05T08:30:00-05:00') }
  let(:generated_at) { Time.iso8601('2026-11-05T10:45:12-05:00') }
  let(:url) { 'https://futureme.example/capsule.html?id=42' }
  let(:unfolded) { calendar.gsub(/\r\n[ \t]/, '') }
  let(:lines) { unfolded.split("\r\n") }

  def property(calendar, name)
    calendar.gsub(/\r\n[ \t]/, '').split("\r\n").find { |line| line.start_with?("#{name}:") }
  end

  it 'creates one private event that does not mark the calendar as busy' do
    expect(lines.first).to eq('BEGIN:VCALENDAR')
    expect(lines.last).to eq('END:VCALENDAR')
    expect(lines.count('BEGIN:VEVENT')).to eq(1)
    expect(lines.count('END:VEVENT')).to eq(1)
    expect(lines).to include('VERSION:2.0', 'CALSCALE:GREGORIAN', 'CLASS:PRIVATE', 'TRANSP:TRANSPARENT')
    expect(property(calendar, 'PRODID')).not_to be_nil
  end

  it 'uses UTC unlock and generation times with a fifteen-minute event' do
    expect(lines).to include(
      'DTSTART:20271105T133000Z',
      'DTEND:20271105T134500Z',
      'DTSTAMP:20261105T154512Z',
      'LAST-MODIFIED:20261105T141500Z'
    )
    expect(unlock_at.utc_offset).to eq(-18_000)
    expect(generated_at.utc_offset).to eq(-18_000)
    expect(created_at.utc_offset).to eq(-18_000)
  end

  it 'preserves the actual time when the event crosses a daylight-saving change' do
    zoned_unlock_at = Time.find_zone!('America/New_York').local(2027, 3, 14, 1, 55)
    allow(capsule).to receive(:unlock_at).and_return(zoned_unlock_at)

    expect(lines).to include('DTSTART:20270314T065500Z', 'DTEND:20270314T071000Z')
  end

  it 'includes a display alarm at the exact unlock time' do
    alarm = unfolded.match(/BEGIN:VALARM\r\n(.*?)END:VALARM/m)[1].split("\r\n")

    expect(alarm).to contain_exactly(
      'ACTION:DISPLAY',
      'TRIGGER:PT0S',
      'DESCRIPTION:Open your capsule: A letter for next year'
    )
  end

  it 'includes the public title and a link back to the capsule' do
    expect(lines).to include(
      "SUMMARY:Open your capsule: #{title}",
      "DESCRIPTION:Return to FutureMe when your time capsule unlocks.\\n#{url}",
      "URL:#{url}"
    )
  end

  [15, 60, 1440, 10080].each do |minutes|
    it "sets an advance alert #{minutes} minutes before the unchanged unlock event" do
      output = described_class.new(capsule, url: url, generated_at: generated_at, remind_before: minutes).to_ical

      expect(property(output, 'TRIGGER')).to eq("TRIGGER:-PT#{minutes}M")
      expect(property(output, 'DTSTART')).to eq(property(calendar, 'DTSTART'))
      expect(property(output, 'DTEND')).to eq(property(calendar, 'DTEND'))
      expect(output.gsub(/\r\n[ \t]/, '')).to include("DESCRIPTION:Your capsule unlocks soon: #{title}")
      expect(output).not_to include('ready to open')
    end
  end

  [0, 60].each do |minutes|
    it "never reads or exports the title with a private #{minutes}-minute reminder" do
      expect(capsule).not_to receive(:title)
      output = described_class.new(capsule, url: url, generated_at: generated_at,
        remind_before: minutes, private_title: true).to_ical

      expect(property(output, 'SUMMARY')).to eq('SUMMARY:Open your time capsule')
      expect(property(output, 'URL')).to eq("URL:#{url}")
      expect(output).not_to include(title)
      expect(property(output, 'DESCRIPTION')).to eq("DESCRIPTION:Return to FutureMe when your time capsule unlocks.\\n#{url}")
    end
  end

  it 'keeps the same event identity when reminder time or title privacy changes' do
    output = described_class.new(capsule, url: url, generated_at: generated_at,
      remind_before: 1440, private_title: true).to_ical

    expect(property(output, 'UID')).to eq(property(calendar, 'UID'))
  end

  it 'uses the capsule modification time and preserves identity after edits' do
    first_uid = property(calendar, 'UID')
    allow(capsule).to receive(:updated_at).and_return(updated_at + 3600)
    allow(capsule).to receive(:unlock_at).and_return(unlock_at + 86_400)
    output = described_class.new(capsule, url: url, generated_at: generated_at).to_ical

    expect(property(output, 'LAST-MODIFIED')).to eq('LAST-MODIFIED:20261105T151500Z')
    expect(property(output, 'DTSTART')).to eq('DTSTART:20271106T133000Z')
    expect(property(output, 'UID')).to eq(first_uid)
  end

  [nil, '60', 15.0, -15, 1, [15], { minutes: 15 }, true].each do |value|
    it "rejects unsupported reminder input #{value.inspect}" do
      expect { described_class.new(capsule, url: url, remind_before: value) }.to raise_error(ArgumentError)
    end
  end

  [nil, 'true', 'false', 1, [], {}].each do |value|
    it "rejects nonboolean private title input #{value.inspect}" do
      expect { described_class.new(capsule, url: url, private_title: value) }.to raise_error(ArgumentError)
    end
  end

  it 'can format a past event independently of download eligibility' do
    allow(capsule).to receive(:unlock_at).and_return(generated_at - 3600)

    expect(property(calendar, 'DTSTART')).to eq('DTSTART:20261105T144512Z')
  end

  it 'never reads the private message or saved poster design' do
    expect(capsule).not_to receive(:message)
    expect(capsule).not_to receive(:design)
    expect(capsule).not_to receive(:sealed_notes)
    expect(capsule).not_to receive(:as_json)

    expect(calendar).to include('BEGIN:VEVENT')
  end

  it 'keeps the same event identity across downloads and title changes' do
    first_uid = property(calendar, 'UID')
    allow(capsule).to receive(:title).and_return('A renamed capsule')
    later_calendar = described_class.new(capsule, url: url, generated_at: generated_at + 3600).to_ical

    expect(property(later_calendar, 'UID')).to eq(first_uid)
    expect(property(later_calendar, 'DTSTAMP')).not_to eq(property(calendar, 'DTSTAMP'))
  end

  it 'uses different event identities for different capsules, creation times, and sites' do
    first_uid = property(calendar, 'UID')
    other_capsule = double('Capsule', id: 43, title: title, created_at: created_at, updated_at: updated_at, unlock_at: unlock_at)
    recreated_capsule = double('Capsule', id: 42, title: title, created_at: created_at + 1, updated_at: updated_at, unlock_at: unlock_at)
    alternatives = [
      described_class.new(other_capsule, url: url, generated_at: generated_at).to_ical,
      described_class.new(recreated_capsule, url: url, generated_at: generated_at).to_ical,
      described_class.new(capsule, url: 'https://another.example/capsule.html?id=42', generated_at: generated_at).to_ical
    ]

    expect(alternatives.map { |value| property(value, 'UID') }.push(first_uid).uniq.length).to eq(4)
  end

  it 'escapes text delimiters and newlines without creating extra calendar properties' do
    allow(capsule).to receive(:title).and_return("Plans: one, two; C:\\notes\r\nBEGIN:VEVENT\rEND:VCALENDAR\nDone")

    expect(property(calendar, 'SUMMARY')).to eq(
      'SUMMARY:Open your capsule: Plans: one\, two\; C:\\\\notes\nBEGIN:VEVENT\nEND:VCALENDAR\nDone'
    )
    expect(lines.count('BEGIN:VEVENT')).to eq(1)
    expect(lines.count('END:VCALENDAR')).to eq(1)
  end

  it 'removes control characters while retaining text and tabs' do
    allow(capsule).to receive(:title).and_return("My\0\a\b\v\f\e\u007F\u0085\u009F\tletter")

    expect(property(calendar, 'SUMMARY')).to eq("SUMMARY:Open your capsule: My\tletter")
  end

  it 'sanitizes URL line breaks without escaping URI punctuation' do
    unsafe_url = "https://futureme.example/capsule.html?id=42&label=a,b;c\r\n\0\t"
    safe_url = 'https://futureme.example/capsule.html?id=42&label=a,b;c'
    output = described_class.new(capsule, url: unsafe_url, generated_at: generated_at).to_ical

    expect(property(output, 'URL')).to eq("URL:#{safe_url}")
    expect(property(output, 'DESCRIPTION')).to eq(
      'DESCRIPTION:Return to FutureMe when your time capsule unlocks.\nhttps://futureme.example/capsule.html?id=42&label=a\,b\;c'
    )
  end

  it 'folds long lines at seventy-five bytes without splitting UTF-8 characters' do
    allow(capsule).to receive(:title).and_return('Letters 💌 é 未来 ' * 30)
    physical_lines = calendar.split("\r\n")

    expect(calendar.encoding).to eq(Encoding::UTF_8)
    expect(physical_lines).to all(be_valid_encoding)
    expect(physical_lines.map(&:bytesize)).to all(be <= 75)
    expect(physical_lines.any? { |line| line.start_with?(' ') }).to be(true)
    expect(property(calendar, 'SUMMARY')).to eq("SUMMARY:Open your capsule: #{capsule.title}")
  end

  it 'uses only CRLF line endings and ends with a complete content line' do
    expect(calendar).to end_with("END:VCALENDAR\r\n")
    expect(calendar.delete("\r\n")).not_to be_empty
    expect(calendar.gsub("\r\n", '')).not_to match(/[\r\n]/)
  end

  it 'discards invalid UTF-8 bytes without making the calendar unreadable' do
    allow(capsule).to receive(:title).and_return("Letter\xFF 💌")

    expect(calendar).to be_valid_encoding
    expect(property(calendar, 'SUMMARY')).to eq('SUMMARY:Open your capsule: Letter 💌')
  end
end
