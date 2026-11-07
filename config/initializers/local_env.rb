# Load local development credentials without requiring a dotenv gem.
if Rails.env.development?
  env_file = Rails.root.join(".env")
  if env_file.exist?
    env_file.each_line do |line|
      key, value = line.strip.split("=", 2)
      next if key.blank? || key.start_with?("#") || value.nil?

      ENV[key] ||= value.delete_prefix('"').delete_suffix('"').delete_prefix("'").delete_suffix("'")
    end
  end
end
