class PosterDesign
  THEME_FIELDS = %w[background_color accent_color font icon].freeze
  GEOMETRY_FIELDS = %w[x y width height rotation].freeze
  PUBLIC_BLOCKS = %w[title_block message_block icon_block].freeze
  ROOT_FIELDS = (["theme", "sealed_blocks"] + PUBLIC_BLOCKS).freeze
  NOTE_FIELDS = (%w[id text] + GEOMETRY_FIELDS).freeze
  FONTS = %w[sans serif mono display].freeze

  def initialize(data)
    @data = normalize(data)
  end

  def validation_errors
    return ["must be an object"] unless @data.is_a?(Hash)

    errors = unknown_fields(@data, ROOT_FIELDS, "design")
    if @data.key?("theme")
      errors.concat(object_errors(@data["theme"], THEME_FIELDS, "theme") do |field, value|
        "must be a supported #{field.tr('_', ' ')}" unless valid_theme_value?(field, value)
      end)
    end
    PUBLIC_BLOCKS.each do |name|
      errors.concat(geometry_errors(@data[name], name)) if @data.key?(name)
    end
    errors.concat(sealed_errors) if @data.key?("sealed_blocks")
    errors
  end

  def public_data
    source = @data.is_a?(Hash) ? @data : {}
    theme = source["theme"].is_a?(Hash) ? source["theme"] : {}
    public_theme = theme.select { |field, value| THEME_FIELDS.include?(field) && valid_theme_value?(field, value) }
    { "theme" => public_theme }.merge(PUBLIC_BLOCKS.to_h { |name| [name, geometry_data(source[name])] })
  end

  def sealed_data
    return [] unless @data.is_a?(Hash) && @data["sealed_blocks"].is_a?(Array)

    ids = []
    @data["sealed_blocks"].filter_map do |note|
      next unless note.is_a?(Hash) && note["text"].is_a?(String)

      result = { "text" => note["text"] }.merge(geometry_data(note))
      if valid_id?(note["id"]) && !ids.include?(note["id"])
        result["id"] = note["id"]
        ids << note["id"]
      end
      result
    end
  end

  private

  def normalize(value)
    case value
    when Hash
      value.to_h { |key, entry| [key.to_s, normalize(entry)] }
    when Array
      value.map { |entry| normalize(entry) }
    when String
      value.dup
    else
      value
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

      message = yield(field, entry)
      errors << "#{path}.#{field} #{message}" if message
    end
    errors
  end

  def valid_theme_value?(field, value)
    case field
    when "background_color", "accent_color"
      value.is_a?(String) && value.match?(/\A#[0-9a-f]{6}\z/i)
    when "font"
      FONTS.include?(value)
    when "icon"
      value.is_a?(String)
    else
      false
    end
  end

  def valid_geometry_value?(field, value)
    return false unless (value.is_a?(Integer) || value.is_a?(Float)) && value.to_f.finite?
    return true if field == "rotation"
    return value > 0 && value <= 100 if %w[width height].include?(field)

    value >= 0 && value <= 100
  end

  def geometry_errors(value, path)
    object_errors(value, GEOMETRY_FIELDS, path) do |field, entry|
      "must be a valid finite percentage or rotation" unless valid_geometry_value?(field, entry)
    end
  end

  def geometry_data(value)
    return {} unless value.is_a?(Hash)

    value.select { |field, entry| GEOMETRY_FIELDS.include?(field) && valid_geometry_value?(field, entry) }
  end

  def valid_id?(value)
    value.is_a?(String) && !value.strip.empty?
  end

  def sealed_errors
    notes = @data["sealed_blocks"]
    return ["sealed_blocks must be an array"] unless notes.is_a?(Array)

    ids = []
    notes.each_with_index.flat_map do |note, index|
      object_errors(note, NOTE_FIELDS, "sealed_blocks[#{index}]") do |field, value|
        if field == "id"
          if !valid_id?(value)
            "must be a non-empty string"
          elsif ids.include?(value)
            "must be unique"
          else
            ids << value
            nil
          end
        elsif field == "text"
          "must be a string" unless value.is_a?(String)
        else
          "must be a valid finite percentage or rotation" unless valid_geometry_value?(field, value)
        end
      end
    end
  end
end
