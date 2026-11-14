def retry_stale_browser_node
  attempts = 0
  begin
    yield
  rescue Selenium::WebDriver::Error::WebDriverError => error
    stale_node = error.message.include?('Node with given id does not belong to the document') || error.message.include?('stale element')
    raise unless stale_node && (attempts += 1) < 3

    sleep 0.1
    retry
  end
end

When('I visit FutureMe') do
  visit '/'
end

When('I visit the new capsule page') do
  # The home page has the same link in the nav, the hero, and (when empty) the empty state.
  click_link 'Create a capsule', match: :first
end

When('I fill in {string} with {string}') do |field, value|
  retry_stale_browser_node do
    if field.start_with?('Text block') || field.start_with?('Message block')
      label = field.sub('Message block', 'Text block')
      text_block = find("[aria-label='#{label}']")
      page.execute_script("arguments[0].textContent = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true }))", text_block, value)
    else
      input = find_field(field, visible: :all)
      if input.visible?
        fill_in field, with: value
      else
        page.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true }))", input, value)
      end
    end
  end
end

When('I continue to {string}') do |step|
  click_button "Next: #{step}"
end

When('I return to {string}') do |step|
  click_button "Back to #{step}"
end

When('I open the {string} step') do |step|
  find("button[data-show-step='#{step.downcase}']").click
end

When('I continue alone') do
  click_button 'Continue alone'
end

When('I add collaborator {string}') do |email|
  fill_in 'Collaborator email', with: email
  click_button 'Add collaborator'
end

When('I remove collaborator {string}') do |email|
  find("button[aria-label='Remove collaborator #{email}']").click
end

When('I preview collaborator {string} as {string}') do |email, state|
  find("select[aria-label='Preview activity for #{email}']").find('option', text: state, exact_text: true).select_option
end

Then('collaborator {string} is {string}') do |email, status|
  collaborator = find('#collaborator-list .collaborator-member', text: email)
  expect(collaborator).to have_css('.member-status', text: status)
end

Then('the collaborator list does not include {string}') do |email|
  expect(find('#collaborator-list')).to have_no_text(email)
end

Then('the current creation step is {string}') do |step|
  expect(find('.step-tab[aria-current="step"]')).to have_text(step)
end

Then('the {string} field contains {string}') do |field, value|
  expect(page).to have_field(field, with: value)
end

When('I add email recipient {string}') do |email|
  fill_in 'Recipient email', with: email
  click_button 'Add recipient'
end

When('I remove email recipient {string}') do |email|
  find("button[aria-label='Remove #{email}']").click
end

Then('keyboard focus is on {string}') do |text|
  heading = find('h2', text: text, exact_text: true)
  expect(page.evaluate_script('document.activeElement.id')).to eq(heading[:id])
end

When('I fill in {string} with a date one day from now') do |field|
  retry_stale_browser_node do
    input = find_field(field, visible: :all)
    value = 1.day.from_now.strftime('%Y-%m-%dT%H:%M')
    page.execute_script('arguments[0].value = arguments[1]', input, value)
  end
end

When('I fill in {string} with a date one day ago') do |field|
  input = find_field(field, visible: :all)
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
  click_button 'Deliver' unless find_button('Seal the capsule', visible: :all).visible?
  click_button 'Seal the capsule'
end

When('I save the capsule changes') do
  click_button 'Deliver' unless find_button('Save changes', visible: :all).visible?
  click_button 'Save changes'
end

When('I edit the capsule') do
  click_link 'Edit capsule'
end

When('I choose {string} from {string}') do |option, field|
  select option, from: field
end

When('I add a message block') do
  button = find_button('Add text', visible: :all)
  button.visible? ? button.click : page.execute_script('arguments[0].click()', button)
end

When('I add a text block') do
  click_button 'Add text'
end

When('I click {string}') do |label|
  button = find_button(label, visible: :all)
  button.visible? ? button.click : page.execute_script('arguments[0].click()', button)
end

When('I press Enter in {string}') do |field|
  input = find_field(field, visible: :all)
  if input.visible?
    input.send_keys(:enter)
  else
    page.execute_script("arguments[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))", input)
  end
end

When('I delete the selected image') do
  find('body').send_keys(:delete)
end

When('I attach an image file') do
  attach_file 'photo-upload', Rails.root.join('spec/fixtures/files/capsule.png'), visible: false
end

When('I add audio') do
  click_button 'Add audio'
end

When('I attach an audio file') do
  attach_file 'audio-upload', Rails.root.join('spec/fixtures/files/capsule.mp3'), visible: false
end

When('I attach a video file') do
  attach_file 'video-upload', Rails.root.join('spec/fixtures/files/capsule.mp4'), visible: false
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

Given('I already have {int} capsules') do |count|
  count.times do |index|
    @account.capsules.create!(title: "Existing capsule #{index}", message: "Message #{index}", unlock_at: 1.day.from_now)
  end
end

Given('I have capsules titled {string} and {string}') do |first_title, second_title|
  [first_title, second_title].each do |title|
    @account.capsules.create!(title: title, message: "Message for #{title}", unlock_at: 1.day.from_now)
  end
end

Given('a capsule titled {string} unlocks tomorrow with the message {string}') do |title, message|
  @account.capsules.create!(title: title, message: message, unlock_at: 1.day.from_now)
end

Given('a capsule titled {string} unlocked yesterday with the message {string}') do |title, message|
  capsule = @account.capsules.create!(title: title, message: message, unlock_at: 1.day.from_now)
  capsule.update!(unlock_at: 1.day.ago)
end

Given('a capsule titled {string} was opened yesterday with the message {string}') do |title, message|
  capsule = @account.capsules.create!(title: title, message: message, unlock_at: 1.day.from_now)
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

  capsule = @account.capsules.create!(title: title, message: 'Look how far you came.', unlock_at: 1.day.from_now, design: design)
  capsule
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

Then('the capsule title is {string}') do |title|
  expect(page).to have_current_path(/capsule\.html/)
  expect(Capsule.find_by!(title: title).title).to eq(title)
end

Then('the capsule titled {string} has message {string}') do |title, message|
  expect(page).to have_current_path(/capsule\.html/)
  expect(Capsule.find_by!(title: title).message).to eq(message)
end

Then('the capsule titled {string} has no collaborator data') do |title|
  expect(page).to have_current_path(/capsule\.html/)
  capsule = Capsule.find_by!(title: title)
  serialized = capsule.attributes.to_json

  expect(serialized).not_to include('sam@example.com')
  expect(serialized).not_to match(/collaborator|presence|activeCollaborator/i)
end

Then('the poster design is saved') do
  design = Capsule.find_by!(title: 'My custom poster').design

  expect(design.dig('theme', 'background_color')).to eq('#202923')
  expect(design.dig('theme', 'icon')).to eq('✦')
  expect(design.fetch('sealed_blocks').first.fetch('text')).to eq('Private poster note')
end

Then('the linked image is sealed') do
  expect(page).to have_current_path(/capsule\.html/)
  image_block = Capsule.find_by!(title: 'My image capsule').design.fetch('sealed_blocks').find { |block| block['image_url'] }

  expect(image_block.fetch('image_url')).to eq('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee')
end

Then('the uploaded image is sealed') do
  expect(page).to have_current_path(/capsule\.html/)
  capsule = Capsule.find_by!(title: 'My uploaded image capsule')

  expect(capsule.images).to be_attached
  image_block = capsule.design.fetch('sealed_blocks').find { |block| block['type'] == 'image' }
  expect(image_block).to be_present
end

Then('I can play the selected audio') do
  expect(page).to have_css('#poster-preview audio[controls]')
end

Then('I see two selected audio previews') do
  expect(page).to have_css('#poster-preview audio[controls]', count: 2)
end

Then('I see two selected video previews') do
  expect(page).to have_css('#poster-preview video[controls]', count: 2)
end

Then('the audio is sealed') do
  expect(page).to have_current_path(/capsule\.html/)
  capsule = Capsule.find_by!(title: 'My audio capsule')
  expect(capsule.audio).to be_attached
  expect(capsule.design.fetch('sealed_blocks').any? { |block| block['type'] == 'audio' }).to be(true)
end

Then('the repeated media files are sealed') do
  expect(page).to have_current_path(/capsule\.html/)
  capsule = Capsule.find_by!(title: 'My media capsule')

  expect(capsule.audio.blobs.count).to eq(2)
  expect(capsule.video.blobs.count).to eq(2)
end

Then('no image is sealed') do
  expect(page).to have_current_path(/capsule\.html/)
  blocks = Capsule.find_by!(title: 'No image capsule').design.fetch('sealed_blocks')

  expect(blocks.none? { |block| block['image_url'] || block['image_index'] }).to be(true)
end

Then('I see {string}') do |text|
  retry_stale_browser_node { expect(page).to have_text(text) }
end

Then('I do not see {string}') do |text|
  retry_stale_browser_node { expect(page).not_to have_text(text) }
end
