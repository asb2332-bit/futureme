Feature: Time capsules
  As someone preserving a meaningful memory
  I want to schedule a message for a future date
  So that it is revealed at the right time

  Scenario: Create a future capsule
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Graduation day"
    And I fill in "Message" with "I am proud of how far you have come."
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "Graduation day"
    And I see "This capsule is locked"

  Scenario: Create a customized poster capsule
    When I visit FutureMe
    And I visit the new capsule page
    And I choose "Night" from "Theme"
    And I fill in "Icon" with "✦"
    And I add a text block
    And I fill in "Text block 1" with "Private poster note"
    And I fill in "Title" with "My custom poster"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "My custom poster"
    And I do not see "Private poster note"
    And the poster design is saved

  Scenario: View a locked capsule
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "Happy birthday from all of us!"
    When I visit FutureMe
    And I open "Birthday wishes"
    Then I see "Birthday wishes"
    And I see "This capsule is locked"
    And I do not see "Happy birthday from all of us!"

  Scenario: View an unlocked capsule
    Given a capsule titled "A note from last year" unlocked yesterday with the message "Keep believing in yourself."
    When I visit FutureMe
    And I open "A note from last year"
    Then I see "A note from last year"
    And I see "Ready to open"
    And I do not see "Keep believing in yourself."
    When I break the seal
    Then I see "Keep believing in yourself."

  Scenario: An opened capsule stays open
    Given a capsule titled "A note from last year" unlocked yesterday with the message "Keep believing in yourself."
    When I visit FutureMe
    And I open "A note from last year"
    And I break the seal
    And I visit FutureMe
    Then I see "Already opened"
    When I open "A note from last year"
    Then I see "Keep believing in yourself."
    And I do not see "Break the seal"

  Scenario: Reject an invalid capsule
    When I visit FutureMe
    And I visit the new capsule page
    And I create the capsule
    Then I see "Title can't be blank"
    And I see "Message can't be blank"
    And I see "Unlock at can't be blank"

  Scenario: See capsules on the timeline
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "Happy birthday!"
    And a capsule titled "Summer letter" unlocked yesterday with the message "Hi."
    And a capsule titled "A note from last year" was opened yesterday with the message "Keep going."
    When I visit FutureMe
    Then I see "Opening soon"
    And I see "Ready to open"
    And I see "Already opened"
    And I see "Sealed"
    And I see "Unlocked"

  Scenario: Empty home page
    When I visit FutureMe
    Then I see "No capsules yet"

  Scenario: Reject an unlock time in the past
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Too late"
    And I fill in "Message" with "Oops"
    And I fill in "Unlock at" with a date one day ago
    And I create the capsule
    Then I see "Unlock at must be in the future"

  @allow-rescue
  Scenario: Open a capsule that doesn't exist
    When I visit the capsule page for id "999999"
    Then I see "Capsule not found"

  Scenario: Add a photo and a voice note
    When I visit FutureMe
    And I visit the new capsule page
    And I attach "grad.jpg" with "Add photo"
    And I attach "voice_note.m4a" with "Add audio"
    Then I see "Photo 1"
    And I see "Voice note 1"

  Scenario: Media stays hidden while sealed
    Given a capsule titled "Grad day" with a photo unlocks tomorrow
    When I visit FutureMe
    And I open "Grad day"
    Then I see "a photo"
    And I do not see a photo on the poster

  Scenario: Media appears after unlock
    Given a capsule titled "Last year" with a photo unlocked yesterday
    When I visit FutureMe
    And I open "Last year"
    Then I do not see a photo on the poster
    When I break the seal
    Then I see a photo on the poster

  Scenario: Reject an unsupported file
    When I visit FutureMe
    And I visit the new capsule page
    And I attach "setup.exe" with "Add photo"
    Then I see "File type not supported"
