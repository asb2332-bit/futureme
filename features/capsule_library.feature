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

  Scenario: Match title words in any order without requiring accents
    Given there are no capsules in my library
    And a capsule titled "Fúture café letter" unlocks tomorrow with the message "A private memory"
    And a capsule titled "Future letter" unlocks tomorrow with the message "A private memory"
    When I visit FutureMe
    And I fill in "Search capsules" with "  CAFE   FUTURE  "
    Then I see these capsule titles in order:
      | Fúture café letter |
    And I see "Showing 1 of 2 capsules"

  Scenario: Include both local date boundaries across daylight saving time
    Given the browser uses the New York time zone
    And my library spans a daylight-saving day
    When I visit FutureMe
    And I filter unlock dates to the daylight-saving day
    And I choose "Locked" from "Status"
    And I choose "Unlock date" from "Sort by"
    Then I see these capsule titles in order:
      | First boundary |
      | Last boundary  |
    And I see "Showing 2 of 4 capsules"

  Scenario: Support an open beginning or end to the unlock date range
    Given the browser uses the New York time zone
    And my library spans a daylight-saving day
    When I visit FutureMe
    And I filter unlock dates from the daylight-saving day onward
    And I choose "Unlock date" from "Sort by"
    Then I see these capsule titles in order:
      | First boundary |
      | Last boundary  |
      | After the day  |
    When I filter unlock dates through the daylight-saving day
    Then I see these capsule titles in order:
      | Before the day |
      | First boundary |
      | Last boundary  |

  Scenario: Explain a reversed date range and reset every filter
    When I visit FutureMe
    And I enter a reversed unlock date range
    Then the unlock date range is marked invalid
    And I see "Choose an end date on or after the start date."
    And I do not see "No capsules match your search or filters."
    When I reset the capsule filters
    Then the unlock date range is empty and valid
    And I see "Showing 3 of 3 capsules"

  Scenario: Preserve filters across reload without putting a title in the URL
    When I visit FutureMe
    And I fill in "Search capsules" with "Graduation"
    And I choose "Locked" from "Status"
    And I choose "Oldest first" from "Sort by"
    And I filter unlock dates from today through the next 3 days
    And I reload the library
    Then the capsule controls show search "Graduation" with status "Locked" and sort "Oldest first"
    And the selected unlock date range is restored
    And I see these capsule titles in order:
      | Graduation letter |
    And the library URL contains no search or filter values

  Scenario: Return to the same filtered library from a capsule
    When I visit FutureMe
    And I fill in "Search capsules" with "Graduation"
    And I choose "Locked" from "Status"
    And I open "Graduation letter"
    And I return to the previous page
    Then the capsule controls show search "Graduation" with status "Locked" and sort "Newest first"
    And I see these capsule titles in order:
      | Graduation letter |

  Scenario: Show the real unlock date on an unlocked envelope
    When I visit FutureMe
    Then the envelope for "Birthday wishes" shows its unlock date

  Scenario: Keep every search control usable on a narrow screen
    Given the browser has a 320 pixel wide viewport
    When I visit FutureMe
    And I fill in "Search capsules" with "Graduation"
    And I choose "Locked" from "Status"
    Then the library controls fit within the viewport
    And I see these capsule titles in order:
      | Graduation letter |
