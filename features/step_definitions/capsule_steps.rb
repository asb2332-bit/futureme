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

def creation_step(name)
  find(".create-steps [data-show-step='#{name}']").click
end

Then('I can preview collaborators and recipients without sending them') do
  creation_step('collaborate')
  fill_in 'Collaborator email', with: 'friend@example.com'
  click_button 'Add collaborator'
  find('select[aria-label="Preview activity for friend@example.com"]').select('Writing')
  expect(page).to have_content('friend@example.com is writing (local preview)')
  expect(page).to have_content('Invitations and shared changes are not sent or saved')
  creation_step('deliver')
  fill_in 'Recipient email', with: 'reader@example.com'
  click_button 'Add recipient'
  fill_in 'Recipient email', with: 'reader@example.com'
  click_button 'Add recipient'
  expect(page).to have_content('That recipient is already on the list')
  expect(page).to have_content('1 recipient')
  expect(page).to have_content('Recipients are not saved and no emails are sent')
  find('button[aria-label="Remove recipient reader@example.com"]').click
  expect(page).to have_content('0 recipients')
end

When('I write a title and message in the creation form') do
  fill_in 'title-input', with: 'A future memory'
  fill_in 'message-input', with: 'Keep this message.'
end

When('I move through the creation steps') do
  creation_step('design')
  creation_step('deliver')
  creation_step('write')
end

Then('the creation form retains the title and message') do
  expect(find_field('title-input').value).to eq('A future memory')
  expect(find_field('message-input').value).to eq('Keep this message.')
end

When('I visit FutureMe') do
  visit '/'
end

When('I visit the new capsule page') do
  find('.hero').click_link 'Create a capsule'
end

When('I fill in {string} with {string}') do |field, value|
  retry_stale_browser_node do
    if field == 'Title' || field == 'Message' || field.start_with?('Message block')
      text_block = find("[aria-label='#{field}']")
      page.execute_script("arguments[0].textContent = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true }))", text_block, value)
    else
      creation_step('design') if field == 'Image URL'
      fill_in field, with: value
    end
  end
end

When('I fill in {string} with a date one day from now') do |field|
  retry_stale_browser_node do
    creation_step('deliver')
    input = find_field(field)
    value = 1.day.from_now.strftime('%Y-%m-%dT%H:%M')
    page.execute_script('arguments[0].value = arguments[1]', input, value)
  end
end

When('I create the capsule') do
  creation_step('deliver')
  click_button 'Seal the capsule'
end

When('I clear the capsule title') do
  creation_step('write')
  fill_in 'title-input', with: ''
end

When('I attempt to save the capsule changes') do
  creation_step('deliver')
  click_button 'Save changes'
end

When('I save the capsule changes') do
  creation_step('deliver')
  click_button 'Save changes'
  expect(page).to have_current_path(/capsule\.html/)
end

When('I edit the capsule') do
  click_link 'Edit capsule'
end

When('I cancel editing') do
  click_link 'Cancel'
end

When('I dismiss the delete confirmation') do
  dismiss_confirm { click_button 'Delete capsule' }
end

When('I confirm deleting the capsule') do
  accept_confirm { click_button 'Delete capsule' }
  expect(page).to have_current_path('/index.html')
end

Then('the capsule titled {string} no longer exists') do |title|
  expect(@account.capsules.where(title: title)).to be_empty
end

When('I choose {string} from {string}') do |option, field|
  creation_step('design')
  select option, from: field
end

When('I add a message block') do
  creation_step('design')
  click_button 'Add message'
end

When('I click {string}') do |label|
  creation_step('design') if label == 'Make selected message title'
  click_button label
end

When('I press Enter in {string}') do |field|
  find_field(field).send_keys(:enter)
end

When('I delete the selected image') do
  find('body').send_keys(:delete)
end

When('I attach an image file') do
  creation_step('design')
  attach_file 'capsule-images', Rails.root.join('spec/fixtures/files/capsule.png'), visible: false
end

When('I add audio') do
  creation_step('design')
  click_button 'Add audio'
end

When('I attach an audio file') do
  creation_step('design')
  attach_file 'capsule-audio', Rails.root.join('spec/fixtures/files/capsule.mp3'), visible: false
end

When('I attach a video file') do
  creation_step('design')
  attach_file 'capsule-video', Rails.root.join('spec/fixtures/files/capsule.mp4'), visible: false
end

When('I open {string}') do |title|
  click_link title
end

Given('a capsule already contains 2 MB of media') do
  capsule = @account.capsules.create!(title: 'Full capsule', message: 'Memories', unlock_at: 1.day.from_now,
    design: { 'sealed_blocks' => [
      { 'id' => 'saved-image', 'image_index' => 0, 'x' => 10, 'y' => 10, 'width' => 30, 'height' => 25, 'rotation' => 0 },
      { 'id' => 'saved-audio', 'media_type' => 'audio', 'media_index' => 0, 'x' => 10, 'y' => 40, 'width' => 45, 'height' => 10, 'rotation' => 0 },
      { 'id' => 'saved-video', 'media_type' => 'video', 'media_index' => 0, 'x' => 55, 'y' => 65, 'width' => 30, 'height' => 25, 'rotation' => 0 }
    ] })
  %w[capsule-at-limit.png capsule-at-limit.mp3 capsule-at-limit.mp4].each do |filename|
    attachment = filename.end_with?('.png') ? capsule.images : filename.end_with?('.mp3') ? capsule.audio : capsule.video
    attachment.attach(io: File.open(Rails.root.join('spec/fixtures/files', filename)), filename: filename)
  end
end

When('I remove the existing image from the poster') do
  creation_step('design')
  find('.poster-image-block').click
  find('body').send_keys(:delete)
end

When('I remove the existing audio from the poster') do
  creation_step('design')
  find('audio').find(:xpath, '..').find('.media-drag-handle').click
  find('body').send_keys(:delete)
end

Then('the full capsule has the replacement audio') do
  capsule = @account.capsules.find_by!(title: 'Full capsule')
  expect(capsule.audio.blobs.pluck(:filename)).to eq(['capsule.mp3'])
  expect(capsule.images.blobs.count).to eq(1)
  expect(capsule.video.blobs.count).to eq(1)
end

When('I remove the existing video from the poster') do
  creation_step('design')
  find('video').find(:xpath, '..').find('.media-drag-handle').click
  find('body').send_keys(:delete)
end

Then('the full capsule has the replacement video') do
  capsule = @account.capsules.find_by!(title: 'Full capsule')
  expect(capsule.video.blobs.pluck(:filename)).to eq(['capsule.mp4'])
  expect(capsule.images.blobs.count).to eq(1)
  expect(capsule.audio.blobs.count).to eq(1)
end

When('I undo the poster change') do
  find('body').send_keys([:control, 'z'])
end

Then('the full capsule retains its original image') do
  expect(@account.capsules.find_by!(title: 'Full capsule').images.blobs.pluck(:filename)).to eq(['capsule-at-limit.png'])
end

Then('the full capsule has the replacement image') do
  capsule = @account.capsules.find_by!(title: 'Full capsule')
  expect(capsule.images.blobs.pluck(:filename)).to eq(['capsule.png'])
  expect(capsule.audio.blobs.count).to eq(1)
  expect(capsule.video.blobs.count).to eq(1)
end

Then('adding another audio file exceeds the capsule limit') do
  creation_step('design')
  expect(accept_alert { attach_file 'capsule-audio', Rails.root.join('spec/fixtures/files/capsule.mp3'), visible: false }).to include("exceed this capsule's 2 MB limit")
  expect(page).to have_no_text("This file can't be added", wait: 7)
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
