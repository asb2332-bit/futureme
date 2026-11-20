When('I share a saved draft with {string}') do |email|
  @collaborator_email = email
  visit '/create.html'
  fill_in 'title-input', with: 'A shared memory'
  creation_step('deliver')
  click_button 'Save draft for editing'
  expect(page).to have_current_path(/create\.html\?id=\d+/, ignore_query: false)
  find('#share-draft summary').click
  fill_in 'Teammate’s email', with: email
  click_button 'Send invitation'
  expect(page).to have_content('Invitation sent.')
  mail = ActionMailer::Base.deliveries.last
  expect(mail.to).to eq([email])
  @invitation_url = mail.body.decoded.lines.map(&:strip).find { |line| line.start_with?('http') }
end

Then("the owner and teammate can see typing and dragging on the same draft") do
  using_session(:teammate) do
    visit @invitation_url
    expect(page).to have_current_path('/login')
    fill_in 'Email', with: @collaborator_email
    fill_in 'Password', with: 'a-secure-password'
    click_button 'Log in'
    click_button 'Join draft'
    expect(find_field('title-input').value).to eq('A shared memory')
  end

  page.driver.browser.navigate.refresh
  expect(page).to have_css('#share-draft summary')
  creation_step('write')
  fill_in 'message-input', with: 'Writing from the owner'

  using_session(:teammate) do
    expect(page).to have_content('member@example.com is typing in Message: Writing from the owner')
    title = find('#poster-preview [aria-label="Title"]')
    title.scroll_to(:center)
    page.driver.browser.action.move_to(title.native).click_and_hold.move_by(-20, 15).release.perform
  end

  expect(page).to have_content('teammate@example.com is moving a title.')
  expect(page).to have_css('.collaborator-outline', text: @collaborator_email)
  creation_step('deliver')
  click_button 'Save draft for editing'
  expect(page).to have_css('#share-draft summary')

  using_session(:teammate) do
    expect(page).to have_content('The draft changed. Reload to see the latest saved version.')
    refresh
    expect(find_field('message-input').value).to eq('Writing from the owner')
  end
end
