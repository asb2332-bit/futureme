Feature: Remember when a capsule unlocks
  As someone waiting to open a time capsule
  I want a calendar reminder for its unlock time
  So that I can return when my message is ready

  Background:
    Given I am a registered user who is logged in

  Scenario: Offer a calendar reminder for a locked capsule
    Given a capsule titled "Graduation wishes" unlocks tomorrow with the message "A private graduation wish"
    When I visit FutureMe
    And I open "Graduation wishes"
    Then I see "This capsule is locked"
    And the calendar reminder points to the capsule titled "Graduation wishes"
    And I do not see "A private graduation wish"

  Scenario: Do not offer a future reminder for an already unlocked capsule
    Given a capsule titled "A memory from last year" unlocked yesterday with the message "The wait is over."
    When I visit FutureMe
    And I open "A memory from last year"
    Then I see "The wait is over."
    And no calendar reminder is offered

  @allow-rescue
  Scenario: Do not offer a reminder when the capsule is missing
    When I visit a capsule that does not exist
    Then I see "Capsule not found"
    And no calendar reminder is offered

  Scenario: Do not offer a reminder without a capsule ID
    When I visit the capsule page without an ID
    Then I see "Capsule not found"
    And no calendar reminder is offered

  Scenario: Remove the reminder when the capsule unlocks
    Given a capsule titled "Ready soon" unlocks tomorrow with the message "The moment has arrived."
    When I visit FutureMe
    And I open "Ready soon"
    Then the calendar reminder points to the capsule titled "Ready soon"
    When the capsule titled "Ready soon" reaches its unlock time
    Then I eventually see the unlocked message "The moment has arrived."
    And no calendar reminder is offered

  Scenario Outline: Hide the reminder when the capsule cannot be refreshed
    Given a capsule titled "Waiting for news" unlocks tomorrow with the message "A private update"
    When I visit FutureMe
    And I open "Waiting for news"
    Then the calendar reminder points to the capsule titled "Waiting for news"
    When the next capsule refresh fails with "<failure>"
    And the capsule titled "Waiting for news" reaches its unlock time
    Then I see "Couldn't load this capsule. Please refresh."
    And no calendar reminder is offered
    And I do not see "A private update"

    Examples:
      | failure      |
      | network      |
      | unavailable  |
      | invalid JSON |

  Scenario: Choose an earlier alert without sharing the capsule title
    Given a capsule titled "Graduation wishes" unlocks tomorrow with the message "A private graduation wish"
    When I visit FutureMe
    And I open "Graduation wishes"
    Then the exact local unlock time is shown for "Graduation wishes"
    When I choose "1 hour before" from "Remind me"
    And I check "Keep the capsule title out of my calendar"
    And calendar downloads are tracked
    And I download the calendar reminder
    Then a private calendar file alerts 60 minutes before "Graduation wishes"
    And I see "Reminder downloaded. Open it in your calendar app to add the alert."
    And I see "downloads do not sync automatically"
    And the calendar download is ready to use again

  Scenario: Do not offer alert times that have already passed
    Given a capsule titled "Tomorrow's letter" unlocks tomorrow with the message "A quiet moment"
    When I visit FutureMe
    And I open "Tomorrow's letter"
    Then "1 week before" is unavailable as a reminder time
    And "1 hour before" is available as a reminder time

  Scenario Outline: Recover from calendar download failures without leaving the capsule
    Given a capsule titled "Waiting for news" unlocks tomorrow with the message "A private update"
    When I visit FutureMe
    And I open "Waiting for news"
    And calendar downloads are tracked
    And the next calendar download fails with "<failure>"
    And I download the calendar reminder
    Then I see "Couldn't download your reminder. Please try again."
    And I remain on the capsule titled "Waiting for news"
    And the calendar download is ready to use again
    When I download the calendar reminder
    Then I see "Reminder downloaded. Open it in your calendar app to add the alert."
    And I do not see "Couldn't download your reminder. Please try again."

    Examples:
      | failure     |
      | network     |
      | HTTP 503    |
      | invalid file |

  Scenario: Clear the capsule when a calendar download reveals an expired session
    Given a capsule titled "Waiting for news" unlocks tomorrow with the message "A private update"
    When I visit FutureMe
    And I open "Waiting for news"
    And calendar downloads are tracked
    And the next calendar download fails with "HTTP 401"
    And I download the calendar reminder
    Then I see "Please log in again to see this capsule."
    And no calendar reminder is offered
    And I do not see "Waiting for news"

  Scenario: Bound detail refreshes when the browser clock is ahead of the server
    Given a capsule titled "Ready soon" unlocks tomorrow with the message "The moment has arrived."
    When I visit FutureMe
    And I open "Ready soon"
    And the capsule detail clock runs ahead of the server
    Then 1 tracked capsule detail request has completed
    When the capsule detail countdown updates 20 times without advancing time
    Then 1 tracked capsule detail request has completed
    And I see "This capsule is locked"
    And the calendar reminder points to the capsule titled "Ready soon"
    When the server unlocks "Ready soon" and the detail retry interval passes
    Then I eventually see the unlocked message "The moment has arrived."
    And no calendar reminder is offered

  Scenario: Revalidate a private capsule before showing it after a tab return
    Given a capsule titled "A private memory" unlocked yesterday with the message "Only my account can read this."
    When I visit FutureMe
    And I open "A private memory"
    And capsule detail visibility is tracked
    And I hide the capsule detail page
    Then I do not see "Only my account can read this."
    When the next visible capsule request returns unauthorized
    And I return to the capsule detail page
    Then I see "Please log in again to see this capsule."
    And I do not see "Only my account can read this."
    And 1 foreground capsule request has completed

  Scenario: Ignore an older capsule response after a reminder download loses authorization
    Given a capsule titled "Waiting for news" unlocks tomorrow with the message "A private update"
    When I visit FutureMe
    And I open "Waiting for news"
    And capsule detail visibility is tracked
    And calendar downloads are tracked
    And the next capsule detail response is delayed
    And the next calendar download fails with "HTTP 401"
    And I download the calendar reminder
    Then I see "Please log in again to see this capsule."
    When I release the delayed capsule detail response
    Then I see "Please log in again to see this capsule."
    And I do not see "Waiting for news"
    And no calendar reminder is offered

  Scenario: Use calendar reminder controls on a narrow mobile screen
    Given the browser has a 320 pixel wide viewport
    And a capsule titled "Tomorrow's letter" unlocks tomorrow with the message "A quiet moment"
    When I visit FutureMe
    And I open "Tomorrow's letter"
    Then the calendar controls fit within the viewport
