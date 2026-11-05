Feature: Remember when a capsule unlocks
  As someone waiting to open a time capsule
  I want a calendar reminder for its unlock time
  So that I can return when my message is ready

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
