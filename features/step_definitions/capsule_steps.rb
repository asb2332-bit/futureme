When('I visit FutureMe') do
  visit '/'
end

When('I visit the new capsule page') do
  # The home page has the same link in the nav, the hero, and (when empty) the empty state.
  click_link 'Create a capsule', match: :first
end

When('I fill in {string} with {string}') do |field, value|
  if field.start_with?('Text block')
    text_block = find("[aria-label='#{field}']")
    page.execute_script("arguments[0].textContent = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true }))", text_block, value)
  else
    fill_in field, with: value
  end
end

When('I continue to {string}') do |step|
  click_button "Next: #{step}"
end

When('I return to {string}') do |step|
  click_button "Back to #{step}"
end

When('I open the {string} step') do |step|
  click_button step
end

Then('the {string} field contains {string}') do |field, value|
  expect(page).to have_field(field, with: value)
end

Then('the email delivery option is unavailable') do
  expect(page).to have_field('Email a private link', disabled: true)
end

Then('keyboard focus is on {string}') do |text|
  heading = find('h2', text: text, exact_text: true)
  expect(page.evaluate_script('document.activeElement.id')).to eq(heading[:id])
end

When('I fill in {string} with a date one day from now') do |field|
  input = find_field(field)
  value = 1.day.from_now.strftime('%Y-%m-%dT%H:%M')

  page.execute_script('arguments[0].value = arguments[1]', input, value)
end

When('I fill in {string} with a date one day ago') do |field|
  input = find_field(field)
  value = 1.day.ago.strftime('%Y-%m-%dT%H:%M')

  page.execute_script('arguments[0].value = arguments[1]', input, value)
end

When('I visit the capsule page for id {string}') do |id|
  visit "/capsule.html?id=#{id}"
end

# The file inputs are visually hidden inside their "Add photo"/"Add audio" labels,
# so Capybara has to make them visible before Selenium will type a path into them.
When('I attach {string} with {string}') do |filename, label|
  attach_file label, Rails.root.join('features/fixtures', filename), make_visible: true
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

When('I search capsules for {string}') do |query|
  fill_in 'Search capsules', with: query
end

When('I filter capsules by {string}') do |status|
  click_button status
end

When('I clear capsule search') do
  click_button 'Clear search'
end

Given('the capsule API is unavailable') do
  browser = page.driver.browser
  result = browser.execute_cdp(
    'Page.addScriptToEvaluateOnNewDocument',
    source: <<~JAVASCRIPT
      const originalFetch = window.fetch.bind(window);
      window.fetch = (...args) => {
        const target = String(args[0]);
        if (target.includes('/api/capsules')) return Promise.reject(new TypeError('offline for feature test'));
        return originalFetch(...args);
      };
    JAVASCRIPT
  )
  @fetch_override_id = result['identifier']
end

After do
  next unless @fetch_override_id

  page.driver.browser.execute_cdp(
    'Page.removeScriptToEvaluateOnNewDocument',
    identifier: @fetch_override_id
  )
end

Given('a capsule titled {string} unlocks tomorrow with the message {string}') do |title, message|
  Capsule.create!(title: title, message: message, unlock_at: 1.day.from_now)
end

Given('a capsule titled {string} unlocked yesterday with the message {string}') do |title, message|
  capsule = Capsule.create!(title: title, message: message, unlock_at: 1.day.from_now)
  capsule.update!(unlock_at: 1.day.ago)
end

Given('a capsule titled {string} was opened yesterday with the message {string}') do |title, message|
  capsule = Capsule.create!(title: title, message: message, unlock_at: 1.day.from_now)
  capsule.update!(unlock_at: 2.days.ago, opened_at: 1.day.ago)
end

When('I break the seal') do
  click_button 'Break the seal'
end

def create_capsule_with_photo(title)
  photo = ActiveStorage::Blob.create_and_upload!(
    io: File.open(Rails.root.join('features/fixtures/grad.jpg')),
    filename: 'grad.jpg',
    content_type: 'image/jpeg'
  )
  design = {
    'sealed_blocks' => [
      { 'id' => 'photo-1', 'type' => 'image', 'media_id' => photo.signed_id, 'x' => 48, 'y' => 50, 'width' => 42, 'height' => 30, 'rotation' => 3 }
    ]
  }

  Capsule.create!(title: title, message: 'Look how far you came.', unlock_at: 1.day.from_now, design: design)
end

Given('a capsule titled {string} with a photo unlocks tomorrow') do |title|
  create_capsule_with_photo(title)
end

Given('a capsule titled {string} with a photo unlocked yesterday') do |title|
  create_capsule_with_photo(title).update!(unlock_at: 1.day.ago)
end

Then('I do not see a photo on the poster') do
  expect(page).to have_no_css('.pb.photo')
  expect(page).to have_no_css("img[src*='/rails/active_storage']")
end

Then('I see a photo on the poster') do
  photo = find(".poster .pb.photo img[src*='/rails/active_storage']")

  # The file itself must load, not just the <img> tag. synchronize retries until Capybara's wait time.
  page.document.synchronize do
    loaded_width = page.evaluate_script('arguments[0].complete ? arguments[0].naturalWidth : 0', photo)
    raise Capybara::ExpectationNotMet, 'photo has not loaded' unless loaded_width.to_i.positive?
  end
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
