Feature: Time capsules
  As someone preserving a meaningful memory
  I want to schedule a message for a future date
  So that it is revealed at the right time

  Background:
    Given I am a registered user who is logged in

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
    And I add a text block
    And I fill in "Text block 1" with "Private poster note"
    And I fill in "Title" with "My custom poster"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "My custom poster"
    And I do not see "Private poster note"
    And the poster design is saved

  Scenario: Create a capsule with a linked image
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Image URL" with "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
    And I add an image
    And I fill in "Title" with "My image capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "My image capsule"
    And the linked image is sealed

  Scenario: Create a capsule with an uploaded image
    When I visit FutureMe
    And I visit the new capsule page
    And I attach an image file
    And I add an image
    And I fill in "Title" with "My uploaded image capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "My uploaded image capsule"
    And the uploaded image is sealed

  Scenario: Create a capsule with audio
    When I visit FutureMe
    And I visit the new capsule page
    And I attach an audio file
    And I add audio
    Then I can play the selected audio
    And I fill in "Title" with "My audio capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the audio is sealed

  Scenario: Remove a linked image before sealing
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Image URL" with "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
    And I add an image
    And I delete the selected image
    And I fill in "Title" with "No image capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then no image is sealed

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
    And I see "Keep believing in yourself."

  Scenario: Reject an invalid capsule
    When I visit FutureMe
    And I visit the new capsule page
    And I create the capsule
    Then I see "Title can't be blank"
    And I see "Message can't be blank"
    And I see "Unlock at can't be blank"
