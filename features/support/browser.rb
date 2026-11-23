require 'capybara/cucumber'
require 'selenium-webdriver'

# Chrome 158 rejects the wildcard storage origin used by Capybara 3.40.
module ChromeResetFallback
  def reset!
    super
  rescue Selenium::WebDriver::Error::InvalidArgumentError => error
    raise unless error.message.include?("* is not a valid URL")

    quit
  end
end

class FutureMeChromeDriver < Capybara::Selenium::Driver
  private

  def specialize_driver
    super
    extend ChromeResetFallback
  end
end

Capybara.register_driver :chrome_headless do |app|
  options = Selenium::WebDriver::Chrome::Options.new
  options.add_argument('--headless=new')
  options.add_argument('--no-sandbox')
  options.add_argument('--disable-dev-shm-usage')

  FutureMeChromeDriver.new(app, browser: :chrome, options: options)
end

Capybara.default_driver = :chrome_headless
