# Rules for photos and voice notes: which file types are allowed and how big they may be.
# Used both when a file is uploaded and when a capsule references the upload.
module MediaUpload
  MAX_BYTES = 25.megabytes

  KINDS_BY_CONTENT_TYPE = {
    "image/jpeg" => "image",
    "image/png" => "image",
    "image/gif" => "image",
    "image/webp" => "image",
    "audio/mpeg" => "audio",
    "audio/mp4" => "audio",
    "audio/x-m4a" => "audio",
    "audio/aac" => "audio",
    "audio/wav" => "audio",
    "audio/x-wav" => "audio",
    "audio/vnd.wave" => "audio",
    "audio/webm" => "audio",
    "audio/ogg" => "audio"
  }.freeze

  TYPE_NOT_SUPPORTED = "File type not supported".freeze
  TOO_LARGE = "File must be under 25 MB".freeze

  module_function

  def kind_for(content_type)
    KINDS_BY_CONTENT_TYPE[content_type.to_s]
  end

  # Detects the type from the file's bytes. The filename and the browser's declared type are
  # deliberately ignored: given a name, Marcel falls back to the extension, so a text file
  # renamed to .jpg would pass as image/jpeg.
  def detect_content_type(io, filename)
    io.rewind
    detected = Marcel::MimeType.for(io)
    detected = "audio/aac" if detected == "application/octet-stream" && aac_adts?(io, filename)
    io.rewind
    detected
  end

  # Raw AAC (.aac) has no container magic Marcel recognises; every ADTS frame starts with a
  # 12-bit sync word (0xFFF) followed by layer bits 00.
  def aac_adts?(io, filename)
    return false unless File.extname(filename.to_s).casecmp?(".aac")

    io.rewind
    header = io.read(2)&.bytes
    header && header.length == 2 && header[0] == 0xFF && (header[1] & 0xF6) == 0xF0
  end

  # Re-check a blob when a capsule references it. Blobs can also be created through
  # Active Storage's own direct-upload route, which skips the upload endpoint's checks.
  def blob_error(blob, expected_kind)
    return TYPE_NOT_SUPPORTED unless kind_for(blob.content_type) == expected_kind
    return TOO_LARGE if blob.byte_size > MAX_BYTES

    nil
  end
end
