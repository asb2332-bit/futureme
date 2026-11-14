Feature: Time capsules
  As someone preserving a meaningful memory
  I want to schedule a message for a future date
  So that it is revealed at the right time

  Background:
    Given I am a registered user who is logged in

  Scenario: Preview collaborators and recipients
    When I visit FutureMe
    And I visit the new capsule page
    Then I can preview collaborators and recipients without sending them

  Scenario: Keep the message while moving between creation steps
    When I visit FutureMe
    And I visit the new capsule page
    And I write a title and message in the creation form
    And I move through the creation steps
    Then the creation form retains the title and message

  Scenario: View multiple capsules
    Given I have capsules titled "First capsule" and "Second capsule"
    When I visit FutureMe
    Then I see "First capsule"
    And I see "Second capsule"

  Scenario: Reject a sixth capsule
    Given I already have 5 capsules
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Sixth capsule"
    And I fill in "Message" with "This should not be created."
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "You can only create up to 5 capsules."

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
    And I add a message block
    And I fill in "Message block 1" with "Private poster note"
    And I fill in "Title" with "My custom poster"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "My custom poster"
    And I do not see "Private poster note"
    And the poster design is saved

  Scenario: Make a text block the title
    When I visit FutureMe
    And I visit the new capsule page
    And I add a message block
    And I fill in "Message block 1" with "A better title"
    And I click "Make selected message title"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the capsule title is "A better title"

  Scenario: Create a capsule with an added message block
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Message blocks work"
    And I add a message block
    And I fill in "Message block 1" with "This is the message"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the capsule titled "Message blocks work" has message "This is the message"

  Scenario: Create a capsule with a linked image
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Image URL" with "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
    And I press Enter in "Image URL"
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
    Then I can play the selected audio
    And I fill in "Title" with "My audio capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the audio is sealed

  Scenario: Create a capsule with repeated audio and video files
    When I visit FutureMe
    And I visit the new capsule page
    And I attach an audio file
    And I attach an audio file
    And I attach a video file
    And I attach a video file
    Then I see two selected audio previews
    And I see two selected video previews
    And I fill in "Title" with "My media capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the repeated media files are sealed

  Scenario: Remove a linked image before sealing
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Image URL" with "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
    And I press Enter in "Image URL"
    And I delete the selected image
    And I fill in "Title" with "No image capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then no image is sealed

  Scenario: Replace a saved file in a full capsule
    Given a capsule already contains 2 MB of media
    When I visit FutureMe
    And I open "Full capsule"
    And I edit the capsule
    And I remove the existing image from the poster
    And I attach an image file
    And I save the capsule changes
    Then the full capsule has the replacement image

  Scenario: Replace saved audio in a full capsule
    Given a capsule already contains 2 MB of media
    When I visit FutureMe
    And I open "Full capsule"
    And I edit the capsule
    And I remove the existing audio from the poster
    And I attach an audio file
    And I save the capsule changes
    Then the full capsule has the replacement audio

  Scenario: Replace saved video in a full capsule
    Given a capsule already contains 2 MB of media
    When I visit FutureMe
    And I open "Full capsule"
    And I edit the capsule
    And I remove the existing video from the poster
    And I attach a video file
    And I save the capsule changes
    Then the full capsule has the replacement video

  Scenario: Cancelling an edit keeps a removed file
    Given a capsule already contains 2 MB of media
    When I visit FutureMe
    And I open "Full capsule"
    And I edit the capsule
    And I remove the existing image from the poster
    And I cancel editing
    Then the full capsule retains its original image

  Scenario: A failed save keeps a removed file
    Given a capsule already contains 2 MB of media
    When I visit FutureMe
    And I open "Full capsule"
    And I edit the capsule
    And I remove the existing image from the poster
    And I clear the capsule title
    And I attempt to save the capsule changes
    Then I see "Title can't be blank"
    And the full capsule retains its original image

  Scenario: Undo removing a saved file restores the capacity limit
    Given a capsule already contains 2 MB of media
    When I visit FutureMe
    And I open "Full capsule"
    And I edit the capsule
    And I remove the existing image from the poster
    And I undo the poster change
    Then adding another audio file exceeds the capsule limit
    When I cancel editing
    Then the full capsule retains its original image

  Scenario: Reject more media when editing a full capsule
    Given a capsule already contains 2 MB of media
    When I visit FutureMe
    And I open "Full capsule"
    And I edit the capsule
    Then adding another audio file exceeds the capsule limit

  Scenario: Cancel editing without deleting a capsule
    Given a capsule titled "Keep this message" unlocks tomorrow with the message "Do not erase this."
    When I visit FutureMe
    And I open "Keep this message"
    And I edit the capsule
    And I cancel editing
    Then the capsule titled "Keep this message" has message "Do not erase this."
    And I see "Keep this message"

  Scenario: Keep a capsule when deletion is cancelled
    Given a capsule titled "Keep this message" unlocks tomorrow with the message "Do not erase this."
    When I visit FutureMe
    And I open "Keep this message"
    And I edit the capsule
    And I dismiss the delete confirmation
    And I cancel editing
    Then the capsule titled "Keep this message" has message "Do not erase this."

  Scenario: Delete a capsule from the editor
    Given a capsule titled "Delete this" unlocks tomorrow with the message "Private memory"
    When I visit FutureMe
    And I open "Delete this"
    And I edit the capsule
    And I confirm deleting the capsule
    Then the capsule titled "Delete this" no longer exists

  Scenario: Edit a locked capsule without losing its message
    Given a capsule titled "Keep this message" unlocks tomorrow with the message "Do not erase this."
    When I visit FutureMe
    And I open "Keep this message"
    And I edit the capsule
    And I save the capsule changes
    Then the capsule titled "Keep this message" has message "Do not erase this."

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
