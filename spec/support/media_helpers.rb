# Tiny but real media files built in memory, so request specs need no fixture files.
module MediaHelpers
  # A valid 1x1 PNG.
  PNG_BYTES = [
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000" \
    "1f15c4890000000d49444154789c6360000002000154a24f5d00000000" \
    "49454e44ae426082"
  ].pack("H*").freeze

  # A valid 0.01 s silent 8 kHz mono WAV.
  def self.wav_bytes
    samples = "\x00".b * 80
    header = ["RIFF", 36 + samples.bytesize, "WAVE", "fmt ", 16, 1, 1, 8_000, 8_000, 1, 8, "data", samples.bytesize]
    header.pack("a4Va4a4VvvVVvva4V") + samples
  end

  def uploaded(bytes, filename, content_type)
    Rack::Test::UploadedFile.new(StringIO.new(bytes), content_type, original_filename: filename)
  end

  def photo_upload = uploaded(PNG_BYTES, "grad.png", "image/png")
  def voice_upload = uploaded(MediaHelpers.wav_bytes, "voice_note.wav", "audio/wav")
  def exe_upload = uploaded("MZ just a text file pretending\n", "setup.exe", "application/x-msdownload")

  # Upload a file through the API and return its signed id.
  def upload_signed_id(file)
    post api_uploads_path, params: { file: file }
    expect(response).to have_http_status(:created)
    JSON.parse(response.body).fetch("signed_id")
  end

  # Every hash key anywhere in a parsed JSON value.
  def all_json_keys(value)
    case value
    when Hash then value.keys + value.values.flat_map { |nested| all_json_keys(nested) }
    when Array then value.flat_map { |nested| all_json_keys(nested) }
    else []
    end
  end
end

RSpec.configure do |config|
  config.include MediaHelpers, type: :request
  config.include MediaHelpers, type: :model
  config.after(:suite) { FileUtils.rm_rf(Rails.root.join("tmp/storage")) }
end
