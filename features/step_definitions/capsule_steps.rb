def retry_stale_browser_node
  attempts = 0
  begin
    yield
  rescue Selenium::WebDriver::Error::UnknownError => error
    raise unless error.message.include?('Node with given id does not belong to the document') && (attempts += 1) < 3

    sleep 0.1
    retry
  end
end

When('I visit FutureMe') do
  visit '/'
end

When('I visit the new capsule page') do
  find('.hero').click_link 'Create a capsule'
end

When('I fill in {string} with {string}') do |field, value|
  if field == 'Title' || field == 'Message' || field.start_with?('Message block')
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

When('I add a message block') do
  click_button 'Add message'
end

When('I click {string}') do |label|
  click_button label
end

When('I press Enter in {string}') do |field|
  find_field(field).send_keys(:enter)
end

When('I delete the selected image') do
  find('body').send_keys(:delete)
end

When('I attach an image file') do
  attach_file 'capsule-images', Rails.root.join('spec/fixtures/files/capsule.png'), visible: false
end

When('I add audio') do
  click_button 'Add audio'
end

When('I attach an audio file') do
  attach_file 'capsule-audio', Rails.root.join('spec/fixtures/files/capsule.mp3'), visible: false
end

When('I attach a video file') do
  attach_file 'capsule-video', Rails.root.join('spec/fixtures/files/capsule.mp4'), visible: false
end

When('I open {string}') do |title|
  click_link title
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

Then('the capsule title is {string}') do |title|
  expect(page).to have_current_path(/capsule\.html/)
  expect(Capsule.find_by!(title: title).title).to eq(title)
end

Then('the capsule titled {string} has message {string}') do |title, message|
  expect(page).to have_current_path(/capsule\.html/)
  expect(Capsule.find_by!(title: title).message).to eq(message)
end

Then('the poster design is saved') do
  design = Capsule.find_by!(title: 'My custom poster').design

  expect(design.dig('theme', 'background_color')).to eq('#202923')
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
  image_block = capsule.design.fetch('sealed_blocks').find { |block| block['image_index'] == 0 }
  expect(image_block.fetch('aspect_ratio')).to be > 0
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
  expect(capsule.design.fetch('sealed_blocks').any? { |block| block['media_type'] == 'audio' }).to be(true)
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
