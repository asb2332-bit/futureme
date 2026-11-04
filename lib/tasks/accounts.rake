namespace :accounts do
  desc "Grant admin access to an existing account: rake accounts:promote EMAIL=you@example.com"
  task promote: :environment do
    email = ENV.fetch("EMAIL").strip.downcase
    user = User.find_by!(email_address: email)
    user.update!(role: "admin")
    puts "Admin access granted to #{user.email_address}"
  end
end
