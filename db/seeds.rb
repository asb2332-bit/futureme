# Demo capsules matching docs/ui-prototype.html: three sealed (one with a photo and a voice note)
# and one already opened (with both). Media lives in db/seeds/media (see SOURCES.md there).
#
# Create-only: a capsule is skipped if one with the same title already exists, and nothing is
# ever deleted, so running `bin/rails db:seed` again never touches existing data.

MEDIA_DIR = Rails.root.join("db/seeds/media")

def seed_upload(filename, content_type)
  ActiveStorage::Blob.create_and_upload!(
    io: File.open(MEDIA_DIR.join(filename)),
    filename: filename,
    content_type: content_type
  ).signed_id
end

def seed_design(theme:, icon:, font:, message_block: nil, sealed_blocks: [])
  themes = {
    sage: { "background_color" => "#E3E7DF", "accent_color" => "#202923" },
    sunset: { "background_color" => "#FFD0B5", "accent_color" => "#6F2540" },
    night: { "background_color" => "#202923", "accent_color" => "#F5E8C8" }
  }

  {
    "theme" => themes.fetch(theme).merge("font" => font, "icon" => icon),
    "title_block" => { "x" => 8, "y" => 10, "width" => 72, "height" => 16, "rotation" => 0 },
    "message_block" => message_block || { "x" => 8, "y" => 36, "width" => 84, "height" => 38, "rotation" => 0 },
    "icon_block" => { "x" => 82, "y" => 8, "width" => 10, "height" => 12, "rotation" => 0 },
    "sealed_blocks" => sealed_blocks
  }
end

def note(id, text)
  { "id" => id, "type" => "text", "text" => text, "x" => 10, "y" => 86, "width" => 46, "height" => 9, "rotation" => -4 }
end

def photo(id, signed_id, x:, y:, rotation:)
  { "id" => id, "type" => "image", "media_id" => signed_id, "x" => x, "y" => y, "width" => 42, "height" => 30, "rotation" => rotation }
end

def voice(id, signed_id, y:)
  { "id" => id, "type" => "audio", "media_id" => signed_id, "x" => 8, "y" => y, "width" => 46, "height" => 10, "rotation" => 0 }
end

# Creates the capsule unless the title is taken. `unlock_at` may be in the past for the demo
# "already opened" capsule: it is created with a future time (the model requires that), then
# that same new record is backdated.
def seed_capsule(title:, message:, unlock_at:, created_at: Time.current, design_attrs: {})
  if Capsule.exists?(title: title)
    puts "  skip  #{title} (already exists)"
    return
  end

  design = seed_design(**design_attrs.except(:media)).tap do |d|
    d["sealed_blocks"] += design_attrs.fetch(:media, []).map(&:call)
  end
  capsule = Capsule.create!(title: title, message: message, unlock_at: [unlock_at, 1.minute.from_now].max, design: design)
  capsule.update_columns(unlock_at: unlock_at, created_at: created_at)
  puts "  added #{title}"
end

puts "Seeding demo capsules"

seed_capsule(
  title: "Graduation day",
  message: "I am proud of how far you have come.",
  unlock_at: 191.days.from_now.change(hour: 9),
  created_at: 1.day.ago,
  design_attrs: {
    theme: :sage, icon: "⏳", font: "sans",
    message_block: { "x" => 8, "y" => 30, "width" => 84, "height" => 20, "rotation" => 0 },
    sealed_blocks: [note("note-1", "P.S. call me")],
    media: [
      -> { photo("photo-1", seed_upload("graduation.jpg", "image/jpeg"), x: 50, y: 52, rotation: 4) },
      -> { voice("voice-1", seed_upload("reading.m4a", "audio/mp4"), y: 72) }
    ]
  }
)

seed_capsule(
  title: "Birthday wishes",
  message: "Happy birthday from all of us!",
  unlock_at: 59.days.from_now.change(hour: 8),
  created_at: 3.days.ago,
  design_attrs: { theme: :night, icon: "✦", font: "serif" }
)

seed_capsule(
  title: "Mom's 50th",
  message: "Fifty years of you. Here's to fifty more.",
  unlock_at: 212.days.from_now.change(hour: 10),
  created_at: 9.days.ago,
  design_attrs: {
    theme: :sunset, icon: "☼", font: "display",
    media: [-> { voice("voice-1", seed_upload("happy_birthday.m4a", "audio/mp4"), y: 76) }]
  }
)

seed_capsule(
  title: "A note from last year",
  message: "Keep believing in yourself.",
  unlock_at: 2.days.ago,
  created_at: 367.days.ago,
  design_attrs: {
    theme: :sage, icon: "✎", font: "mono",
    message_block: { "x" => 8, "y" => 30, "width" => 84, "height" => 18, "rotation" => 0 },
    sealed_blocks: [note("note-1", "You did it.")],
    media: [
      -> { photo("photo-1", seed_upload("beach.jpg", "image/jpeg"), x: 48, y: 50, rotation: -3) },
      -> { voice("voice-1", seed_upload("lullaby.m4a", "audio/mp4"), y: 72) }
    ]
  }
)
