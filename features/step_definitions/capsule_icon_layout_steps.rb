When('I move, resize, and rotate the poster icon') do
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

  @icon_layout = page.evaluate_script(<<~JS)
    (() => {
      const icon = document.querySelector('.poster-icon-block');
      return Object.fromEntries(['left', 'top', 'width', 'height', 'transform'].map(name => [name, icon.style[name]]));
    })()
  JS

  expect(@icon_layout.fetch('left')).not_to eq('82%')
  expect(@icon_layout.fetch('top')).not_to eq('8%')
  expect(@icon_layout.fetch('width')).not_to eq('10%')
  expect(@icon_layout.fetch('height')).not_to eq('12%')
  expect(@icon_layout.fetch('transform')).not_to eq('rotate(0deg)')
end

Then('the capsule displays my customized icon layout') do
  icon = find('#capsule-poster .poster-block', text: '✦', exact_text: true)

  @icon_layout.each do |property, value|
    expect(page.evaluate_script('arguments[0].style[arguments[1]]', icon, property)).to eq(value)
  end
end
