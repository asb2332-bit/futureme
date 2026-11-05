module CapsuleDraftSteps
  def inject_draft_test_script(source)
    @draft_test_scripts ||= []
    @draft_test_scripts << page.driver.browser.execute_cdp(
      'Page.addScriptToEvaluateOnNewDocument', source: source
    ).fetch('identifier')
  end
end

World(CapsuleDraftSteps)

Before do
  visit '/'
  page.execute_script(<<~JS)
    Object.keys(localStorage).filter(key => key.startsWith('futureme:draft:')).forEach(key => localStorage.removeItem(key));
  JS
end

After do
  Array(@draft_test_scripts).each do |identifier|
    page.driver.browser.execute_cdp('Page.removeScriptToEvaluateOnNewDocument', identifier: identifier)
  end
  @draft_other_window.close if @draft_other_window
end

When('I save the draft') do
  click_button 'Save draft'
  expect(page).to have_css('#draft-status', text: 'Draft saved on this device.')
end

When('I attempt to save the draft') do
  click_button 'Save draft'
end

Then('the draft is saved on this device') do
  expect(page).to have_css('#draft-status', text: 'Draft saved on this device.')
end

When('I refresh the draft editor') do
  page.refresh
end

When('I set the draft unlock date to one day from now') do
  @draft_unlock_at = 1.day.from_now.strftime('%Y-%m-%dT%H:%M')
  page.execute_script(<<~JS, find_field('Unlock at'), @draft_unlock_at)
    arguments[0].value = arguments[1];
    arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
  JS
end

When('I adjust and remember the draft icon layout') do
  page.current_window.resize_to(1280, 900)
  find('.poster-icon-block').click

  [
    ['.poster-icon-block', -80, 60],
    ['.poster-icon-block .resize-se', 30, 25],
    ['.poster-icon-block .rotate-handle', 35, 10]
  ].each do |selector, x, y|
    control = find(selector)
    page.driver.browser.action.move_to(control.native).click_and_hold.move_by(x, y).release.perform
  end

  @draft_icon_layout = page.evaluate_script(<<~JS)
    (() => {
      const icon = document.querySelector('.poster-icon-block');
      return Object.fromEntries(['left', 'top', 'width', 'height', 'transform'].map(name => [name, icon.style[name]]));
    })()
  JS

  expect(@draft_icon_layout.fetch('left')).not_to eq('82%')
  expect(@draft_icon_layout.fetch('width')).not_to eq('10%')
  expect(@draft_icon_layout.fetch('transform')).not_to eq('rotate(0deg)')
end

Then('the restored draft keeps my poster controls, unlock date, and icon layout') do
  expect(page).to have_select('Theme', selected: 'Night')
  expect(page).to have_select('Font', selected: 'Serif')
  expect(page).to have_field('Icon', with: '✦')
  expect(page).to have_field('Background', with: '#202923')
  expect(page).to have_field('Accent', with: '#f5e8c8')
  expect(page).to have_field('Unlock at', with: @draft_unlock_at)

  icon = find('.poster-icon-block')
  @draft_icon_layout.each do |property, value|
    expect(page.evaluate_script('arguments[0].style[arguments[1]]', icon, property)).to eq(value)
  end
end

Then('the draft contains {string} in {string}') do |text, field|
  expect(page).to have_css("[aria-label='#{field}']", text: text, exact_text: true)
end

Then('I see a saved draft titled {string}') do |title|
  expect(page).to have_link(title, href: %r{/create\.html\?draft=})
end

Then('I do not see a saved draft titled {string}') do |title|
  expect(page).to have_no_link(title, href: %r{/create\.html\?draft=})
end

When('I resume the draft titled {string}') do |title|
  find('a[href^="/create.html?draft="]', text: title).click
end

When('I confirm discarding the draft') do
  accept_confirm { click_button 'Discard draft' }
end

Then('no capsule has been created') do
  expect(Capsule.count).to eq(0)
end

Then('exactly one capsule titled {string} has been created') do |title|
  expect(Capsule.count).to eq(1)
  expect(Capsule.first.title).to eq(title)
end

Then('the draft titled {string} remains saved locally') do |title|
  titles = page.evaluate_script('window.FutureMeDrafts.list().drafts.map(draft => draft.capsule.title)')
  expect(titles).to include(title)
end

Given('the next capsule submission fails to connect') do
  inject_draft_test_script(<<~JS)
    (() => {
      const originalFetch = window.fetch.bind(window);
      let failed = false;
      window.fetch = (input, options = {}) => {
        const url = new URL(input instanceof Request ? input.url : input, location.href);
        if (!failed && url.pathname === '/api/capsules' && options.method === 'POST') {
          failed = true;
          return Promise.reject(new TypeError('Network connection unavailable'));
        }
        return originalFetch(input, options);
      };
    })();
  JS
end

Given('this browser cannot store capsule drafts') do
  inject_draft_test_script(<<~JS)
    (() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('futureme:draft:')) throw new DOMException('Storage is full', 'QuotaExceededError');
        return originalSetItem.call(this, key, value);
      };
    })();
  JS
end

Then('the capsule submission failure is shown') do
  expect(page).to have_css('#form-errors', text: /couldn't|could not|unable|try again/i)
  expect(page).to have_button('Seal the capsule', disabled: false)
end

Then('the draft storage failure is shown') do
  expect(page).to have_css('#draft-status', text: /couldn't|could not|unavailable|unable/i)
  expect(page).to have_no_css('#draft-status', text: 'Draft saved on this device.')
end

When('another tab saves {string} in this draft') do |message|
  draft_url = current_url
  @draft_other_window = open_new_window
  within_window(@draft_other_window) do
    visit draft_url
    steps %(When I fill in "Message" with "#{message}")
    click_button 'Save draft'
    expect(page).to have_css('#draft-status', text: 'Draft saved on this device.')
  end
end

When('I save my draft as a new draft') do
  click_button 'Save as new draft'
  expect(page).to have_css('#draft-status', text: 'Draft saved on this device.')
end

Then('both draft messages {string} and {string} remain saved') do |first, second|
  messages = page.evaluate_script('window.FutureMeDrafts.list().drafts.map(draft => draft.capsule.message)')
  expect(messages).to contain_exactly(first, second)
end
