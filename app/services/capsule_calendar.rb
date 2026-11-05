require 'digest'
require 'time'

class CapsuleCalendar
  def initialize(capsule, url:, generated_at: Time.current)
    @capsule = capsule
    @url = clean_text(url).delete("\n\t")
    @generated_at = generated_at
  end

  def to_ical
    unlock_at = @capsule.unlock_at.to_time.getutc
    summary = escape_text("Open your capsule: #{@capsule.title}")
    description = escape_text("Your time capsule is ready to open.\n#{@url}")

    lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FutureMe//Capsule Unlock Reminder//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      "UID:#{uid}",
      "DTSTAMP:#{format_time(@generated_at)}",
      "DTSTART:#{format_time(unlock_at)}",
      "DTEND:#{format_time(unlock_at + 900)}",
      "SUMMARY:#{summary}",
      "DESCRIPTION:#{description}",
      "URL:#{@url}",
      'CLASS:PRIVATE',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0S',
      "DESCRIPTION:#{summary}",
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ]

    lines.flat_map { |line| fold_line(line) }.join("\r\n") + "\r\n"
  end

  private

  def uid
    identity = [@capsule.id, @capsule.created_at.to_time.getutc.iso8601(6), @url].join("\0")
    "#{Digest::SHA256.hexdigest(identity)}@futureme"
  end

  def format_time(value)
    value.to_time.getutc.strftime('%Y%m%dT%H%M%SZ')
  end

  def clean_text(value)
    value.to_s.encode(Encoding::UTF_8, invalid: :replace, undef: :replace, replace: '')
         .gsub(/\r\n?/, "\n")
         .gsub(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]/, '')
  end

  def escape_text(value)
    clean_text(value).gsub(/[\\;,\n]/) { |character| character == "\n" ? '\\n' : "\\#{character}" }
  end

  def fold_line(line)
    line.each_char.each_with_object(['']) do |character, folded|
      folded << ' ' if folded.last.bytesize + character.bytesize > 75
      folded.last << character
    end
  end
end
