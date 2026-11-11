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
  expect(page).to have_css('#capsule-poster[aria-busy="false"]')
  Capsule.find_by!(title: title).update!(unlock_at: 1.minute.ago)
  page.execute_script(<<~JS)
    const originalNow = Date.now.bind(Date);
    const originalElapsed = performance.now.bind(performance);
    Date.now = () => originalNow() + 2 * 86400000;
    performance.now = () => originalElapsed() + 6000;
    showCountdown(currentCapsule);
  JS
end

Then('I eventually see the unlocked message {string}') do |message|
  expect(page).to have_text(message, wait: 10)
end

When('the next capsule refresh fails with {string}') do |failure|
  expect(page).to have_css('#capsule-poster[aria-busy="false"]')
  page.execute_script(<<~JS, failure)
    const failure = arguments[0];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, ...args) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (url.pathname !== `/api/capsules/${encodeURIComponent(capsuleId)}`) return originalFetch(input, ...args);
      window.fetch = originalFetch;
      if (failure === "network") {
        return Promise.reject(new TypeError("Network unavailable"));
      }
      return Promise.resolve(new Response("not JSON", { status: failure === "unavailable" ? 503 : 200 }));
    };
  JS
end

Then('the exact local unlock time is shown for {string}') do |title|
  capsule = Capsule.find_by!(title: title)
  expected = page.evaluate_script(<<~JS, capsule.unlock_at.iso8601(3))
    (() => {
      const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' });
      return `Opens ${formatter.format(new Date(arguments[0]))} (${formatter.resolvedOptions().timeZone})`;
    })()
  JS
  expect(page).to have_css('#capsule-unlock-date', text: expected)
end

When('calendar downloads are tracked') do
  page.execute_script(<<~JS)
    const originalFetch = window.fetch.bind(window);
    const originalClick = HTMLAnchorElement.prototype.click;
    const state = { requests: 0, failure: null, body: '', filename: null };
    window.calendarDownloadTest = state;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        state.filename = this.download;
        return;
      }
      return originalClick.call(this);
    };
    window.fetch = async (input, ...args) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (!url.pathname.startsWith('/api/capsules/') || !url.pathname.endsWith('/calendar')) return originalFetch(input, ...args);
      state.requests += 1;
      const failure = state.failure;
      state.failure = null;
      if (failure === 'network') throw new TypeError('Network unavailable');
      if (failure === 'invalid file') return new Response('not a calendar', { status: 200 });
      if (failure) return new Response('{}', { status: Number(failure.slice(5)), headers: { 'Content-Type': 'application/json' } });
      const response = await originalFetch(input, ...args);
      state.body = await response.clone().text();
      state.url = url.href;
      return response;
    };
  JS
end

When('I download the calendar reminder') do
  click_link 'Download calendar reminder'
end

When('I check {string}') do |label|
  check label
end

When('the next calendar download fails with {string}') do |failure|
  expect(['network', 'HTTP 503', 'HTTP 401', 'invalid file']).to include(failure)
  page.execute_script('window.calendarDownloadTest.failure = arguments[0];', failure)
end

Then('a private calendar file alerts {int} minutes before {string}') do |minutes, title|
  capsule = Capsule.find_by!(title: title)
  expect(page).to have_text('Reminder downloaded. Open it in your calendar app to add the alert.')
  download = page.evaluate_script('window.calendarDownloadTest')
  expect(download.fetch('filename')).to eq("futureme-capsule-#{capsule.id}.ics")
  expect(download.fetch('body')).to include("TRIGGER:-PT#{minutes}M", 'SUMMARY:Open your time capsule')
  expect(download.fetch('body')).not_to include(capsule.title, capsule.message)
  expect(URI.parse(download.fetch('url')).query).to eq("remind_before=#{minutes}&private_title=true")
end

Then('the calendar download is ready to use again') do
  expect(page).to have_link('Download calendar reminder')
  expect(page).to have_no_css('#download-calendar[aria-disabled="true"]')
  expect(page).to have_select('Remind me', disabled: false)
end

Then('{string} is unavailable as a reminder time') do |label|
  expect(page).to have_css('#calendar-lead-time option[disabled]', text: label, visible: :all)
end

Then('{string} is available as a reminder time') do |label|
  expect(page).to have_css('#calendar-lead-time option:not([disabled])', text: label, visible: :all)
end

Then('I remain on the capsule titled {string}') do |title|
  capsule = Capsule.find_by!(title: title)
  expect(page).to have_current_path("/capsule.html?id=#{capsule.id}")
  expect(page).to have_text(title)
end

When('the capsule detail clock runs ahead of the server') do
  page.execute_script(<<~JS)
    const originalFetch = window.fetch.bind(window);
    const state = { requests: 0, now: Date.now() + 2 * 86400000, monotonic: performance.now() + 6000 };
    window.capsuleDetailTest = state;
    Date.now = () => state.now;
    performance.now = () => state.monotonic;
    window.fetch = (input, ...args) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (url.pathname.startsWith('/api/capsules/') && url.pathname.split('/').length === 4) state.requests += 1;
      return originalFetch(input, ...args);
    };
    showCountdown(currentCapsule);
  JS
end

Then('{int} tracked capsule detail request has completed') do |count|
  expect(page).to have_css('#capsule-poster[aria-busy="false"]')
  expect(page.evaluate_script('window.capsuleDetailTest.requests')).to eq(count)
end

When('the capsule detail countdown updates {int} times without advancing time') do |count|
  page.execute_script('for (let index = 0; index < arguments[0]; index += 1) showCountdown(currentCapsule);', count)
end

When('the server unlocks {string} and the detail retry interval passes') do |title|
  Capsule.find_by!(title: title).update!(unlock_at: 1.minute.ago)
  page.execute_script('window.capsuleDetailTest.monotonic += 6000; showCountdown(currentCapsule);')
end

When('capsule detail visibility is tracked') do
  expect(page).to have_css('#capsule-poster[aria-busy="false"]')
  page.execute_script(<<~JS)
    const originalFetch = window.fetch.bind(window);
    const state = { hidden: false, requests: 0, unauthorized: false, delayed: false, release: null };
    window.capsuleVisibilityTest = state;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => state.hidden });
    window.fetch = async (input, ...args) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (!url.pathname.startsWith('/api/capsules/') || url.pathname.split('/').length !== 4) return originalFetch(input, ...args);
      state.requests += 1;
      if (state.unauthorized) return new Response('{}', { status: 401 });
      const response = await originalFetch(input, ...args);
      if (!state.delayed) return response;
      state.delayed = false;
      const body = await response.text();
      return new Promise(resolve => {
        state.release = () => resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }));
        document.body.dataset.capsuleResponsePending = 'true';
      });
    };
  JS
end

When('I hide the capsule detail page') do
  page.execute_script("window.capsuleVisibilityTest.hidden = true; document.dispatchEvent(new Event('visibilitychange'));")
end

When('the next visible capsule request returns unauthorized') do
  page.execute_script('window.capsuleVisibilityTest.unauthorized = true;')
end

When('I return to the capsule detail page') do
  page.execute_script(<<~JS)
    window.capsuleVisibilityTest.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  JS
end

Then('{int} foreground capsule request has completed') do |count|
  expect(page).to have_css('#capsule-poster[aria-busy="false"]', visible: :all)
  expect(page.evaluate_script('window.capsuleVisibilityTest.requests')).to eq(count)
end

When('the next capsule detail response is delayed') do
  expect(page).to have_css('#capsule-poster[aria-busy="false"]')
  page.execute_script('window.capsuleVisibilityTest.delayed = true; loadCapsule();')
  expect(page).to have_css('body[data-capsule-response-pending="true"]')
  expect(page).to have_css('#capsule-poster[aria-busy="true"]')
end

When('I release the delayed capsule detail response') do
  page.evaluate_async_script(<<~JS)
    const done = arguments[arguments.length - 1];
    window.capsuleVisibilityTest.release();
    document.body.dataset.capsuleResponsePending = 'false';
    setTimeout(() => done(true), 0);
  JS
end

Then('the calendar controls fit within the viewport') do
  expect(page).to have_select('Remind me', visible: true)
  expect(page).to have_field('Keep the capsule title out of my calendar', visible: true)
  expect(page).to have_link('Download calendar reminder', visible: true)
  expect(page.evaluate_script(<<~JS)).to be(true)
    document.documentElement.scrollWidth <= window.innerWidth + 1 &&
      [...document.querySelectorAll('#calendar-reminder input, #calendar-reminder select, #download-calendar')].every(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth + 1 && bounds.width > 0;
      })
  JS
end
