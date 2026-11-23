require "uri"

class PosterDesign
  THEME_FIELDS = %w[background_color accent_color font icon].freeze
  GEOMETRY_FIELDS = %w[x y width height rotation].freeze
  PUBLIC_BLOCKS = %w[title_block message_block icon_block].freeze
  MEDIA_BLOCKS = %w[audio_block video_block].freeze
  MEDIA_GEOMETRY = (GEOMETRY_FIELDS + %w[aspect_ratio]).freeze
  ROOT_FIELDS = (PUBLIC_BLOCKS + MEDIA_BLOCKS + %w[theme hidden_blocks sealed_blocks remote_image_urls]).freeze
  NOTE_FIELDS = (MEDIA_GEOMETRY + %w[id text kind type media_type media_index image_url image_index url]).freeze
  FONTS = %w[sans serif mono display].freeze

  def initialize(data)
    @data = normalize(data)
  end

  def validation_errors
    return ["must be an object"] unless @data.is_a?(Hash)

    errors = unknown_fields(@data, ROOT_FIELDS, "design")
    errors.concat(object_errors(@data["theme"], THEME_FIELDS, "theme")) if @data.key?("theme")
    PUBLIC_BLOCKS.each do |key|
      errors.concat(object_errors(@data[key], GEOMETRY_FIELDS, key)) if @data.key?(key)
    end
    MEDIA_BLOCKS.each do |key|
      errors.concat(object_errors(@data[key], MEDIA_GEOMETRY, key)) unless @data[key].nil?
    end
    if @data.key?("hidden_blocks") && !valid_list?(@data["hidden_blocks"]) { |id| %w[title message].include?(id) }
      errors << "hidden_blocks must contain valid block names"
    end
    if @data.key?("remote_image_urls") && !valid_list?(@data["remote_image_urls"]) { |url| https_url?(url) }
      errors << "remote image URLs must use HTTPS"
    end
    errors.concat(sealed_errors) if @data.key?("sealed_blocks")
    errors
  end

  def public_data
    source = @data.is_a?(Hash) ? @data : {}
    result = { "theme" => select_fields(source["theme"], THEME_FIELDS) }
    PUBLIC_BLOCKS.each { |key| result[key] = select_fields(source[key], GEOMETRY_FIELDS) }
    MEDIA_BLOCKS.each { |key| result[key] = source[key].is_a?(Hash) ? select_fields(source[key], MEDIA_GEOMETRY) : nil }
    hidden = source["hidden_blocks"]
    result["hidden_blocks"] = hidden.is_a?(Array) ? hidden & %w[title message] : []
    result
  end

  def sealed_data
    return [] unless @data.is_a?(Hash) && @data["sealed_blocks"].is_a?(Array)

    ids = {}
    @data["sealed_blocks"].filter_map do |note|
      next unless note.is_a?(Hash)
      block = select_fields(note, NOTE_FIELDS)
      next if (block.keys & %w[text image_url image_index media_index url]).empty?
      if block.key?("id")
        id = block["id"]
        block.delete("id") if ids[id]
        ids[id] = true
      end
      block
    end
  end

  def remote_image_urls
    return [] unless @data.is_a?(Hash) && @data["remote_image_urls"].is_a?(Array)
    @data["remote_image_urls"].select { |url| https_url?(url) }
  end

  private

  def normalize(value)
    case value
    when Hash then value.to_h { |key, entry| [key.to_s, normalize(entry)] }
    when Array then value.map { |entry| normalize(entry) }
    when String then value.dup
    else value
    end
  end

  def unknown_fields(value, fields, path)
    unknown = value.keys - fields
    unknown.empty? ? [] : ["#{path} contains unsupported fields: #{unknown.join(', ')}"]
  end

  def object_errors(value, fields, path)
    return ["#{path} must be an object"] unless value.is_a?(Hash)

    errors = unknown_fields(value, fields, path)
    value.each do |field, entry|
      next unless fields.include?(field)
      message = field_error(field, entry)
      errors << "#{path}.#{field} #{message}" if message
    end
    errors
  end

  def select_fields(object, fields)
    return {} unless object.is_a?(Hash)
    object.select { |field, value| fields.include?(field) && field_error(field, value).nil? }
  end

  def valid_list?(value, &validation)
    value.is_a?(Array) && value.all?(&validation)
  end

  def https_url?(value)
    return false unless value.is_a?(String)
    uri = URI.parse(value)
    uri.is_a?(URI::HTTPS) && !uri.host.to_s.empty?
  rescue URI::InvalidURIError
    false
  end

  def finite_number?(value)
    (value.is_a?(Integer) || value.is_a?(Float)) && value.to_f.finite?
  end

  def field_error(field, value)
    case field
    when "background_color", "accent_color"
      "must be a six-digit hex color" unless value.is_a?(String) && value.match?(/\A#[0-9a-f]{6}\z/i)
    when "font" then "must be a supported font" unless FONTS.include?(value)
    when "icon", "text" then "must be a string" unless value.is_a?(String)
    when "id" then "must be a non-empty string" unless value.is_a?(String) && !value.strip.empty?
    when "x", "y" then "must be a percentage" unless finite_number?(value) && value.between?(0, 100)
    when "width", "height" then "must be a positive percentage" unless finite_number?(value) && value.positive? && value <= 100
    when "rotation" then "must be finite" unless finite_number?(value)
    when "aspect_ratio" then "must be positive" unless finite_number?(value) && value.positive?
    when "image_index", "media_index" then "must be a nonnegative integer" unless value.is_a?(Integer) && value >= 0
    when "image_url" then "must use HTTPS" unless https_url?(value)
    when "url" then "must be a media URL" unless https_url?(value) || (value.is_a?(String) && value.start_with?("/rails/active_storage/"))
    when "type" then "must be a supported block type" unless %w[text image audio video].include?(value)
    when "media_type" then "must be a supported media type" unless %w[image audio video].include?(value)
    when "kind" then "must be a message" unless value == "message"
    end
  end

  def sealed_errors
    notes = @data["sealed_blocks"]
    return ["sealed_blocks must be an array"] unless notes.is_a?(Array)

    ids = {}
    notes.each_with_index.flat_map do |note, index|
      path = "sealed_blocks[#{index}]"
      errors = object_errors(note, NOTE_FIELDS, path)
      if note.is_a?(Hash) && note.key?("id") && field_error("id", note["id"]).nil?
        id = note["id"]
        errors << "#{path}.id must be unique" if ids[id]
        ids[id] = true
      end
      errors
    end
  end
end
