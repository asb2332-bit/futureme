@browser-timezone
Feature: Keep capsule delivery times accurate when editing
  As someone editing a saved capsule
  I want delivery times to use my local timezone
  So that changing my message does not move its unlock time or reminder

  Background:
    Given I am a registered user who is logged in

  Scenario Outline: Preserve the exact unlock instant when editing other content
    Given my browser timezone is "<timezone>"
    And I have a capsule scheduled for "2099-11-01T06:30:45.123456Z"
    When I visit the scheduled capsule editor
    Then the local unlock field shows "<local_time>"
    When I fill in "Message" with "An updated memory"
    And I save the capsule changes
    Then the scheduled capsule keeps its exact original unlock time
    And the capsule titled "Timezone memory" has message "An updated memory"

    Examples:
      | timezone         | local_time       |
      | America/New_York | 2099-11-01T01:30 |
      | Asia/Kolkata     | 2099-11-01T12:00 |

  Scenario Outline: Save an intentionally changed unlock time in the local timezone
    Given my browser timezone is "<timezone>"
    And I have a capsule scheduled for "2099-11-01T06:30:45.123456Z"
    When I visit the scheduled capsule editor
    Then the local unlock field shows "<original_local_time>"
    When I set the local unlock field to "2099-11-02T09:45"
    And I save the capsule changes
    Then the scheduled capsule unlocks at "<utc_time>"

    Examples:
      | timezone         | original_local_time | utc_time             |
      | America/New_York | 2099-11-01T01:30     | 2099-11-02T14:45:00Z |
      | Asia/Kolkata     | 2099-11-01T12:00     | 2099-11-02T04:15:00Z |
