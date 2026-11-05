When('I visit FutureMe') do
  visit '/'
end

When('I visit the new capsule page') do
  # The home page has the same link in the nav, the hero, and (when empty) the empty state.
  click_link 'Create a capsule', match: :first
end

When('I fill in {string} with {string}') do |field, value|
  if field == 'Title' || field == 'Message' || field.start_with?('Text block')
    text_block = find("[aria-label='#{field}']")
    page.execute_script("arguments[0].textContent = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true }))", text_block, value)
  else
    fill_in field, with: value
  end
end

When('I fill in {string} with a date one day from now') do |field|
  input = find_field(field)
  value = 1.day.from_now.strftime('%Y-%m-%dT%H:%M')

  page.execute_script('arguments[0].value = arguments[1]', input, value)
end

When('I create the capsule') do
  click_button 'Seal the capsule'
end

When('I choose {string} from {string}') do |option, field|
  select option, from: field
end

When('I add a text block') do
  click_button 'Add text'
end

When('I open {string}') do |title|
  click_link title
end

Given('a capsule titled {string} unlocks tomorrow with the message {string}') do |title, message|
  Capsule.create!(title: title, message: message, unlock_at: 1.day.from_now)
end

Given('a capsule titled {string} unlocked yesterday with the message {string}') do |title, message|
  capsule = Capsule.create!(title: title, message: message, unlock_at: 1.day.from_now)
  capsule.update!(unlock_at: 1.day.ago)
end

Then('the poster design is saved') do
  design = Capsule.find_by!(title: 'My custom poster').design

  expect(design.dig('theme', 'background_color')).to eq('#202923')
  expect(design.dig('theme', 'icon')).to eq('✦')
  expect(design.fetch('sealed_blocks').first.fetch('text')).to eq('Private poster note')
end

Then('I see {string}') do |text|
  expect(page).to have_text(text)
end

Then('I do not see {string}') do |text|
  expect(page).not_to have_text(text)
end
