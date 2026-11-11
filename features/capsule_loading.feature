Feature: Recover from capsule loading failures
  As someone returning to my capsules
  I want loading failures to be recoverable
  So that a temporary problem does not hide my saved memories

  Background:
    Given I am a registered user who is logged in

  Scenario Outline: Retry an initial loading failure
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "A private birthday wish"
    And capsule list request 1 returns "<failure>"
    When I visit FutureMe
    Then loading fails without showing an empty library
    When I retry loading capsules
    Then I see "Birthday wishes"
    And I see "Showing 1 of 1 capsule"
    And the capsule loading error is cleared
    And 2 capsule list requests have completed

    Examples:
      | failure      |
      | HTTP 503     |
      | invalid JSON |

  Scenario: Preserve the last loaded list and filters after a refresh failure
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "A private birthday wish"
    And a capsule titled "Graduation letter" unlocks tomorrow with the message "A private graduation wish"
    And capsule list request 2 returns "HTTP 503"
    When I visit FutureMe
    And I fill in "Search capsules" with "Birthday"
    And I choose "Locked" from "Status"
    And I choose "Oldest first" from "Sort by"
    Then I see "Birthday wishes"
    When the browser clock advances by 172800 seconds and the countdown updates
    Then I see "Couldn't refresh your capsules. Showing the last loaded list."
    And I see these capsule titles in order:
      | Birthday wishes |
    And the capsule controls show search "Birthday" with status "Locked" and sort "Oldest first"
    When I retry loading capsules
    Then the capsule loading error is cleared
    And I see these capsule titles in order:
      | Birthday wishes |
    And the capsule controls show search "Birthday" with status "Locked" and sort "Oldest first"
    And 3 capsule list requests have completed

  Scenario: Limit refresh requests when the browser clock is ahead of the server
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "A private birthday wish"
    And a capsule titled "Graduation letter" unlocks tomorrow with the message "A private graduation wish"
    And the browser clock and capsule requests are tracked
    When I visit FutureMe
    Then I see "Showing 2 of 2 capsules"
    When the browser clock advances by 172800 seconds and the countdown updates
    Then 2 capsule list requests have completed
    When the countdown updates 20 times without advancing the clock
    Then 2 capsule list requests have completed
    And I see "Sealed"
    And I do not see "A private birthday wish"
    And I do not see "A private graduation wish"
    When the browser clock advances by 6 seconds and the countdown updates
    Then 3 capsule list requests have completed

  Scenario: Clear the loaded library when the session expires
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "A private birthday wish"
    And capsule list request 2 returns "HTTP 401"
    When I visit FutureMe
    Then I see "Birthday wishes"
    When the browser clock advances by 172800 seconds and the countdown updates
    Then I see "Please log in again to see your capsules."
    And no capsules are listed
    And the capsule search controls are hidden
    And 2 capsule list requests have completed

  Scenario: A signed-out visitor sees a login prompt without loading the library
    When I log out
    And the browser clock and capsule requests are tracked
    And I visit FutureMe
    Then I see "Log in to see your capsules."
    And the capsule search controls are hidden
    And 0 capsule list requests have completed
