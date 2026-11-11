module CapsuleLoadingSteps
  def track_capsule_loading(failure_at: nil, failure: nil)
    source = <<~JS
      (() => {
        const failureAt = #{failure_at.to_json};
        const failure = #{failure.to_json};
        const originalFetch = window.fetch.bind(window);
        const originalSetInterval = window.setInterval.bind(window);
        const state = { now: Date.now(), requests: 0, tick: null };
        window.capsuleLoadingTest = state;
        Date.now = () => state.now;
        window.setInterval = (callback, delay, ...args) => {
          if (delay === 1000) {
            state.tick = () => callback(...args);
            return 0;
          }
          return originalSetInterval(callback, delay, ...args);
        };
        window.fetch = (input, ...args) => {
          const url = new URL(input instanceof Request ? input.url : input, location.href);
          if (url.pathname === '/api/capsules') {
            state.requests += 1;
            if (state.requests === failureAt) {
              const status = failure.startsWith('HTTP ') ? Number(failure.slice(5)) : 200;
              return Promise.resolve(new Response('Service temporarily unavailable', { status }));
            }
          }
          return originalFetch(input, ...args);
        };
      })();
    JS

    @capsule_loading_script = page.driver.browser.execute_cdp(
      'Page.addScriptToEvaluateOnNewDocument', source: source
    ).fetch('identifier')
  end
end

World(CapsuleLoadingSteps)

After do
  if @capsule_loading_script
    page.driver.browser.execute_cdp(
      'Page.removeScriptToEvaluateOnNewDocument', identifier: @capsule_loading_script
    )
  end
end

Given('capsule list request {int} returns {string}') do |request_number, failure|
  expect(['HTTP 503', 'HTTP 401', 'invalid JSON']).to include(failure)
  track_capsule_loading(failure_at: request_number, failure: failure)
end

Given('the browser clock and capsule requests are tracked') do
  track_capsule_loading
end

When('I retry loading capsules') do
  click_button 'Try again'
end

When('the browser clock advances by {int} seconds and the countdown updates') do |seconds|
  page.execute_script('window.capsuleLoadingTest.now += arguments[0] * 1000; window.capsuleLoadingTest.tick();', seconds)
end

When('the countdown updates {int} times without advancing the clock') do |count|
  page.execute_script('for (let i = 0; i < arguments[0]; i += 1) window.capsuleLoadingTest.tick();', count)
end

Then('loading fails without showing an empty library') do
  expect(page).to have_text("Couldn't load your capsules. Please try again.")
  expect(page).to have_no_text('No capsules yet')
  expect(page).to have_no_text('No capsules match your search or filters.')
  expect(page).to have_no_css('#capsules .env')
  expect(page).to have_button('Try again', disabled: false)
end

Then('the capsule loading error is cleared') do
  expect(page).to have_no_css('#capsule-load-error', visible: true)
end

Then('{int} capsule list requests have completed') do |count|
  expect(page).to have_css('#capsules[aria-busy="false"]')
  expect(page.evaluate_script('window.capsuleLoadingTest.requests')).to eq(count)
end
