require 'digest'
require 'time'

class CapsuleCalendar
  REMINDER_MINUTES = [0, 15, 60, 1440, 10080].freeze

  def initialize(capsule, url:, generated_at: Time.current, remind_before: 0, private_title: false)
    unless remind_before.is_a?(Integer) && REMINDER_MINUTES.include?(remind_before)
      raise ArgumentError, 'Unsupported reminder time'
    end
    unless private_title.equal?(true) || private_title.equal?(false)
      raise ArgumentError, 'Private title must be true or false'
    end

    @capsule = capsule
    @url = clean_text(url).delete("\n\t")
    @generated_at = generated_at
    @remind_before = remind_before
    @private_title = private_title
  end

  def to_ical
    unlock_at = @capsule.unlock_at.to_time.getutc
    title = @private_title ? nil : @capsule.title
    summary = escape_text(@private_title ? 'Open your time capsule' : "Open your capsule: #{title}")
    description = escape_text("Return to FutureMe when your time capsule unlocks.\n#{@url}")
    alarm_description = if @remind_before.zero?
      summary
    else
      escape_text(@private_title ? 'Your time capsule unlocks soon.' : "Your capsule unlocks soon: #{title}")
    end

    lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FutureMe//Capsule Unlock Reminder//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      "UID:#{uid}",
      "DTSTAMP:#{format_time(@generated_at)}",
      "LAST-MODIFIED:#{format_time(@capsule.updated_at)}",
      "DTSTART:#{format_time(unlock_at)}",
      "DTEND:#{format_time(unlock_at + 900)}",
      "SUMMARY:#{summary}",
      "DESCRIPTION:#{description}",
      "URL:#{@url}",
      'CLASS:PRIVATE',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      "TRIGGER:#{@remind_before.zero? ? 'PT0S' : "-PT#{@remind_before}M"}",
      "DESCRIPTION:#{alarm_description}",
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
