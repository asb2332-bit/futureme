Given('the following capsules are in my library:') do |table|
  now = Time.current

  table.hashes.each do |row|
    capsule = @account.capsules.create!(title: row.fetch('title'), message: row.fetch('message'), unlock_at: now + 1.day)
    capsule.update!(
      created_at: now - row.fetch('created_days_ago').to_i.days,
      unlock_at: now + row.fetch('unlocks_in_days').to_i.days
    )
  end
end

Given('there are no capsules in my library') do
  @account.capsules.destroy_all
end

Given('a capsule titled {string} unlocks in {int} seconds') do |title, seconds|
  @account.capsules.create!(title: title, message: 'A message for the future', unlock_at: seconds.seconds.from_now)
end

When('I reset the capsule filters') do
  click_button 'Reset filters'
end

When('I wait for {string} to appear in the capsule list') do |title|
  within '#capsules' do
    expect(page).to have_link(title, wait: 12)
  end
end

Then('I see these capsule titles in order:') do |table|
  titles = table.raw.flatten
  expect(page).to have_css('#capsules .env h3', count: titles.length)
  expect(all('#capsules .env h3').map(&:text)).to eq(titles)
end

Then('no capsules are listed') do
  expect(page).to have_no_css('#capsules .env')
end

Then('the capsule controls show search {string} with status {string} and sort {string}') do |search, status, sort|
  expect(page).to have_field('Search capsules', with: search)
  expect(page).to have_select('Status', selected: status)
  expect(page).to have_select('Sort by', selected: sort)
end

Given('another account has a capsule titled {string}') do |title|
  owner = User.create!(email_address: 'other-library@example.com', password: 'a-secure-password')
  owner.capsules.create!(title: title, message: 'A private message', unlock_at: 1.day.from_now)
end

Then('the capsule search controls are hidden') do
  expect(page).to have_no_css('#capsule-controls', visible: true)
  expect(page).to have_no_text('Loading capsules…')
  expect(page).to have_no_text('Showing ')
end
