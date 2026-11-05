Then('the calendar reminder points to the capsule titled {string}') do |title|
  capsule = Capsule.find_by!(title: title)
  expect(page).to have_css('#calendar-reminder', visible: true)
  expect(page).to have_link('Download calendar reminder', href: %r{/api/capsules/#{capsule.id}/calendar\z})
end

Then('no calendar reminder is offered') do
  expect(page).to have_no_link('Download calendar reminder')
  expect(page).to have_no_css('#calendar-reminder', visible: true)
end

When('I visit a capsule that does not exist') do
  visit '/capsule.html?id=-1'
end

When('I visit the capsule page without an ID') do
  visit '/capsule.html'
end

When('the capsule titled {string} reaches its unlock time') do |title|
  Capsule.find_by!(title: title).update!(unlock_at: 1.minute.ago)
  page.execute_script('const originalNow = Date.now; Date.now = () => originalNow() + 2 * 86400000;')
end

Then('I eventually see the unlocked message {string}') do |message|
  expect(page).to have_text(message, wait: 10)
end

When('the next capsule refresh fails with {string}') do |failure|
  page.execute_script(<<~JS, failure)
    const failure = arguments[0];
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      window.fetch = originalFetch;
      if (failure === "network") {
        return Promise.reject(new TypeError("Network unavailable"));
      }
      return Promise.resolve(new Response("not JSON", { status: failure === "unavailable" ? 503 : 200 }));
    };
  JS
end
