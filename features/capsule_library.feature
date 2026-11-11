Feature: Find capsules in the library
  As someone collecting memories over time
  I want to search, filter, and sort my capsules
  So that I can find the memory I want to open

  Background:
    Given I am a registered user who is logged in
    And the following capsules are in my library:
      | title               | message                  | created_days_ago | unlocks_in_days |
      | Graduation letter   | A secret scholarship     | 3                | 2               |
      | Birthday wishes     | A secret birthday wish   | 2                | -2              |
      | Graduation memories | A secret graduation note | 1                | -1              |

  Scenario: Search by title regardless of case or surrounding spaces
    When I visit FutureMe
    And I fill in "Search capsules" with "  gRaDuAtIoN  "
    Then I see these capsule titles in order:
      | Graduation memories |
      | Graduation letter   |
    And I see "Showing 2 of 3 capsules"

  Scenario: Combine a title search with capsule status
    When I visit FutureMe
    And I fill in "Search capsules" with "Graduation"
    And I choose "Locked" from "Status"
    Then I see these capsule titles in order:
      | Graduation letter |
    When I choose "Unlocked" from "Status"
    Then I see these capsule titles in order:
      | Graduation memories |
    And I see "Showing 1 of 3 capsules"

  Scenario: Do not search private message content
    When I visit FutureMe
    And I fill in "Search capsules" with "secret"
    Then no capsules are listed
    And I see "No capsules match your search or filters."
    And I see "Showing 0 of 3 capsules"

  Scenario: Reset search, status, and sorting after an empty result
    When I visit FutureMe
    And I fill in "Search capsules" with "No matching title"
    And I choose "Locked" from "Status"
    And I choose "Oldest first" from "Sort by"
    Then I see "No capsules match your search or filters."
    When I reset the capsule filters
    Then the capsule controls show search "" with status "All capsules" and sort "Newest first"
    And I see these capsule titles in order:
      | Graduation memories |
      | Birthday wishes     |
      | Graduation letter   |
    And I see "Showing 3 of 3 capsules"

  Scenario: Sort capsules by creation time or unlock date
    When I visit FutureMe
    Then I see these capsule titles in order:
      | Graduation memories |
      | Birthday wishes     |
      | Graduation letter   |
    When I choose "Oldest first" from "Sort by"
    Then I see these capsule titles in order:
      | Graduation letter   |
      | Birthday wishes     |
      | Graduation memories |
    When I choose "Unlock date" from "Sort by"
    Then I see these capsule titles in order:
      | Birthday wishes     |
      | Graduation memories |
      | Graduation letter   |

  Scenario: Show an empty library without suggesting a failed search
    Given there are no capsules in my library
    When I visit FutureMe
    Then I see "No capsules yet"
    And I do not see "No capsules match your search or filters."
    And I see "Showing 0 of 0 capsules"
    And no capsules are listed

  Scenario: A capsule appears when it unlocks while filters remain active
    Given a capsule titled "Almost ready" unlocks in 5 seconds
    When I visit FutureMe
    And I fill in "Search capsules" with "Almost"
    And I choose "Unlocked" from "Status"
    And I choose "Oldest first" from "Sort by"
    Then no capsules are listed
    When I wait for "Almost ready" to appear in the capsule list
    Then I see these capsule titles in order:
      | Almost ready |
    And the capsule controls show search "Almost" with status "Unlocked" and sort "Oldest first"
    And I see "Showing 1 of 4 capsules"

  Scenario: Search does not reveal capsules belonging to another account
    Given another account has a capsule titled "Graduation abroad"
    When I visit FutureMe
    And I fill in "Search capsules" with "Graduation"
    Then I see these capsule titles in order:
      | Graduation memories |
      | Graduation letter   |
    And I do not see "Graduation abroad"
    And I see "Showing 2 of 3 capsules"
