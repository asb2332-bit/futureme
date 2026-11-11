Given('my browser timezone is {string}') do |timezone|
  page.driver.browser.execute_cdp('Emulation.setTimezoneOverride', timezoneId: timezone)
end

After('@browser-timezone') do
  page.driver.browser.execute_cdp('Emulation.setTimezoneOverride', timezoneId: '')
end

Given('I have a capsule scheduled for {string}') do |timestamp|
  @scheduled_capsule = @account.capsules.create!(
    title: 'Timezone memory', message: 'The original memory', unlock_at: Time.iso8601(timestamp)
  )
  @original_unlock_at = @scheduled_capsule.reload.unlock_at
end

When('I visit the scheduled capsule editor') do
  visit "/create.html?id=#{@scheduled_capsule.id}"
  expect(page).to have_button('Save changes')
end

Then('the local unlock field shows {string}') do |value|
  expect(page).to have_field('Unlock at', with: value)
end

When('I set the local unlock field to {string}') do |value|
  field = find_field('Unlock at')
  page.execute_script(<<~JS, field, value)
    arguments[0].value = arguments[1];
    arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
    arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
  JS
end

Then('the scheduled capsule keeps its exact original unlock time') do
  expect(page).to have_current_path(/capsule\.html/)
  expect(@scheduled_capsule.reload.unlock_at).to eq(@original_unlock_at)
end

Then('the scheduled capsule unlocks at {string}') do |timestamp|
  expect(page).to have_current_path(/capsule\.html/)
  expect(@scheduled_capsule.reload.unlock_at).to eq(Time.iso8601(timestamp))
end
