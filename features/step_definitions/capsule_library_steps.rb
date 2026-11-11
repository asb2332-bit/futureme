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

module CapsuleLibraryDateSteps
  def set_unlock_range(from, through)
    page.execute_script(<<~JS, from, through)
      const from = document.querySelector('#capsule-unlock-from');
      const through = document.querySelector('#capsule-unlock-through');
      from.value = arguments[0];
      through.value = arguments[1];
      from.dispatchEvent(new Event('change', { bubbles: true }));
      through.dispatchEvent(new Event('change', { bubbles: true }));
    JS
    @selected_unlock_range = [from, through]
  end
end

World(CapsuleLibraryDateSteps)

Given('the browser uses the New York time zone') do
  page.driver.browser.execute_cdp('Emulation.setTimezoneOverride', timezoneId: 'America/New_York')
  @library_timezone_override = true
end

Given('my library spans a daylight-saving day') do
  @account.capsules.destroy_all
  year = Time.current.year + 1
  first = Date.new(year, 3, 1)
  day = 1 + ((7 - first.wday) % 7) + 7
  zone = Time.find_zone!('America/New_York')
  start_time = zone.local(year, 3, day)
  end_time = zone.local(year, 3, day + 1)
  @library_range_day = start_time.strftime('%Y-%m-%d')
  expect(end_time - start_time).to eq(23.hours)
  {
    'Before the day' => start_time - 1.second,
    'First boundary' => start_time,
    'Last boundary' => end_time - 1.second,
    'After the day' => end_time
  }.each do |title, unlock_at|
    @account.capsules.create!(title: title, message: 'A private memory', unlock_at: unlock_at)
  end
end

When('I filter unlock dates to the daylight-saving day') do
  set_unlock_range(@library_range_day, @library_range_day)
end

When('I filter unlock dates from the daylight-saving day onward') do
  set_unlock_range(@library_range_day, '')
end

When('I filter unlock dates through the daylight-saving day') do
  set_unlock_range('', @library_range_day)
end

When('I enter a reversed unlock date range') do
  set_unlock_range('2030-06-10', '2030-06-09')
end

Then('the unlock date range is marked invalid') do
  expect(page).to have_css('#capsule-unlock-from[aria-invalid="true"]')
  expect(page).to have_css('#capsule-unlock-through[aria-invalid="true"]')
  expect(page).to have_css('#capsule-filter-error', visible: true)
  expect(page).to have_no_css('#capsules .env')
end

Then('the unlock date range is empty and valid') do
  expect(page).to have_field('Unlocks from', with: '')
  expect(page).to have_field('Unlocks through', with: '')
  expect(page).to have_no_css('#capsule-filter-error', visible: true)
  expect(page).to have_no_css('[aria-invalid="true"]')
end

When('I filter unlock dates from today through the next {int} days') do |days|
  range = page.evaluate_script(<<~JS, days)
    (() => {
      const date = new Date();
      const format = value => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
      const from = format(date);
      date.setDate(date.getDate() + arguments[0]);
      return [from, format(date)];
    })()
  JS
  set_unlock_range(*range)
end

When('I reload the library') do
  page.refresh
end

When('I return to the previous page') do
  page.go_back
end

Then('the selected unlock date range is restored') do
  expect(page).to have_field('Unlocks from', with: @selected_unlock_range.first)
  expect(page).to have_field('Unlocks through', with: @selected_unlock_range.last)
end

Then('the library URL contains no search or filter values') do
  expect(URI.parse(page.current_url).query).to be_nil
  expect(URI.parse(page.current_url).fragment).to be_nil
end

Then('the envelope for {string} shows its unlock date') do |title|
  capsule = @account.capsules.find_by!(title: title)
  expected = page.evaluate_script('Postal.formatDay(arguments[0])', capsule.unlock_at.iso8601)
  within(find('#capsules .env', text: title)) do
    expect(page).to have_css('.postmark[aria-label="UNLOCKED ' + expected + '"]')
  end
end

Given('the browser has a 320 pixel wide viewport') do
  page.driver.browser.execute_cdp('Emulation.setDeviceMetricsOverride', width: 320, height: 760, deviceScaleFactor: 1, mobile: false)
  @library_viewport_override = true
end

Then('the library controls fit within the viewport') do
  expect(page).to have_field('Search capsules', visible: true)
  expect(page).to have_select('Status', visible: true)
  expect(page).to have_select('Sort by', visible: true)
  expect(page).to have_field('Unlocks from', visible: true)
  expect(page).to have_field('Unlocks through', visible: true)
  expect(page).to have_button('Reset filters', visible: true)
  expect(page.evaluate_script(<<~JS)).to be(true)
    document.documentElement.scrollWidth <= window.innerWidth + 1 &&
      [...document.querySelectorAll('#capsule-controls input, #capsule-controls select, #capsule-controls button')].every(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth + 1 && bounds.width > 0;
      })
  JS
end

After do
  page.driver.browser.execute_cdp('Emulation.setTimezoneOverride', timezoneId: '') if @library_timezone_override
  page.driver.browser.execute_cdp('Emulation.clearDeviceMetricsOverride') if @library_viewport_override
end
