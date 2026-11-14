Feature: Time capsules
  As someone preserving a meaningful memory
  I want to schedule a message for a future date
  So that it is revealed at the right time

  Background:
    Given I am a registered user who is logged in

  Scenario: View multiple capsules
    Given I have capsules titled "First capsule" and "Second capsule"
    When I visit FutureMe
    Then I see "First capsule"
    And I see "Second capsule"

  Scenario: Reject a sixth capsule
    Given I already have 5 capsules
    When I visit FutureMe
    And I visit the new capsule page
    And I continue alone
    And I fill in "Title" with "Sixth capsule"
    And I fill in "Message" with "This should not be created."
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "You can only create up to 5 capsules."

  Scenario: Create a future capsule
    When I visit FutureMe
    And I visit the new capsule page
    And I continue alone
    And I fill in "Title" with "Graduation day"
    And I fill in "Message" with "I am proud of how far you have come."
    And I continue to "Design"
    And I continue to "Deliver"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "Graduation day"
    And I see "This capsule is locked"

  Scenario: Use the guided create flow
    When I visit FutureMe
    And I visit the new capsule page
    And I continue alone
    Then I see "Start with the words"
    When I fill in "Title" with "A letter for next spring"
    And I fill in "Message" with "Remember how hopeful today felt."
    And I continue to "Design"
    Then I see "Make it yours"
    And keyboard focus is on "Make it yours."
    When I return to "Write"
    Then keyboard focus is on "Start with the words."
    And the "Title" field contains "A letter for next spring"
    And the "Message" field contains "Remember how hopeful today felt."
    When I continue to "Design"
    And I continue to "Deliver"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "A letter for next spring"
    And I see "This capsule is locked"

  Scenario: Collaborate before writing
    When I visit FutureMe
    And I visit the new capsule page
    Then I see "Create it together"
    And the current creation step is "Collaborate"
    And I see "Only you can invite or remove people and seal this capsule."
    And I see "Invitations and shared changes are previewed locally"
    When I continue alone
    Then keyboard focus is on "Start with the words."
    And the current creation step is "Write"
    When I fill in "Title" with "A shared graduation letter"
    And I open the "Collaborate" step
    Then keyboard focus is on "Create it together."
    And I see "You · Owner"
    And I open the "Write" step
    Then the "Title" field contains "A shared graduation letter"

  Scenario: Manage capsule collaborators
    When I visit FutureMe
    And I visit the new capsule page
    And I add collaborator "sam@example.com"
    Then I see "sam@example.com"
    And I see "Active"
    And I see "2 people here"
    When I add collaborator "ana@example.com"
    Then I see "ana@example.com"
    And I see "Invited"
    When I continue to "Write"
    Then the current creation step is "Write"
    When I open the "Deliver" step
    Then I see "sam@example.com (Active)"
    And I see "ana@example.com (Invited)"
    When I add email recipient "recipient@example.com"
    Then I see "1 recipient"
    And I see "2 collaborators"
    When I open the "Collaborate" step
    And I remove collaborator "ana@example.com"
    Then the collaborator list does not include "ana@example.com"
    And I see "sam@example.com"

  Scenario: Validate collaborator email
    When I visit FutureMe
    And I visit the new capsule page
    And I add collaborator ""
    Then I see "Enter an email address."
    When I add collaborator "not-an-email"
    Then I see "Enter a valid email address."
    When I add collaborator " ANA@example.com "
    Then I see "ana@example.com"
    When I add collaborator "ana@example.com"
    Then I see "That collaborator is already on the list."
    When I add collaborator "MEMBER@example.com"
    Then I see "That collaborator is already on the list."

  Scenario: Keep collaborator previews out of saved capsules
    When I visit FutureMe
    And I visit the new capsule page
    And I add collaborator "sam@example.com"
    Then I see "sam@example.com"
    And I continue to "Write"
    And I fill in "Title" with "Local collaboration preview"
    And I fill in "Message" with "This is still a normal capsule."
    And I open the "Deliver" step
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the capsule titled "Local collaboration preview" has no collaborator data

  Scenario: Show live collaborator presence
    When I visit FutureMe
    And I visit the new capsule page
    And I add collaborator "sam@example.com"
    And I add collaborator "ana@example.com"
    And I open the "Write" step
    Then I see "sam@example.com is writing · Write"
    And I see "sam@example.com is writing"
    And I do not see "ana@example.com is writing"
    When I continue to "Design"
    Then I see "sam@example.com is arranging the poster · Design"
    And I see "sam@example.com cursor"
    And I see "sam@example.com is editing Message"
    And I see "SA editing"

  Scenario: Return to solo presence
    When I visit FutureMe
    And I visit the new capsule page
    And I add collaborator "sam@example.com"
    And I add collaborator "ana@example.com"
    And I remove collaborator "sam@example.com"
    Then I see "Working solo"
    And I see "Only you are in this draft"
    And I do not see "sam@example.com is writing"
    When I open the "Design" step
    Then I do not see "sam@example.com cursor"
    When I continue to "Deliver"
    Then I see "ana@example.com (Invited)"

  Scenario: Manage multiple email recipients
    When I visit FutureMe
    And I visit the new capsule page
    And I open the "Deliver" step
    Then I see "Send it to someone"
    And I see "Coming soon"
    When I add email recipient "ana@example.com"
    And I add email recipient "sam@example.com"
    Then I see "ana@example.com"
    And I see "sam@example.com"
    And I see "2 recipients"
    When I remove email recipient "ana@example.com"
    Then I do not see "ana@example.com"
    And I see "sam@example.com"
    And I see "1 recipient"

  Scenario: Create a customized poster capsule
    When I visit FutureMe
    And I visit the new capsule page
    And I continue alone
    And I continue to "Design"
    And I choose "Night" from "Theme"
    And I fill in "Icon" with "✦"
    And I add a text block
    And I fill in "Text block 1" with "Private poster note"
    And I return to "Write"
    And I fill in "Title" with "My custom poster"
    And I fill in "Message" with "A message for later"
    And I continue to "Design"
    And I continue to "Deliver"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then I see "My custom poster"
    And I do not see "Private poster note"
    And the poster design is saved

  Scenario: Make a text block the title
    When I visit FutureMe
    And I visit the new capsule page
    And I continue alone
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
    And I continue alone
    And I fill in "Title" with "Message blocks work"
    And I add a message block
    And I fill in "Message block 1" with "This is the message"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the capsule titled "Message blocks work" has message "This is the message"

  Scenario: Create a capsule with a linked image
    When I visit FutureMe
    And I visit the new capsule page
    And I continue alone
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
    And I continue alone
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
    And I continue alone
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
    And I continue alone
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
    And I continue alone
    And I fill in "Image URL" with "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
    And I press Enter in "Image URL"
    And I delete the selected image
    And I fill in "Title" with "No image capsule"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then no image is sealed

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
    And I open the "Deliver" step
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

  Scenario: Search capsules by title
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "Happy birthday!"
    And a capsule titled "Summer letter" unlocks tomorrow with the message "Hi."
    When I visit FutureMe
    And I search capsules for "  BIRTHDAY  "
    Then I see "Birthday wishes"
    And I do not see "Summer letter"
    And I see "1 capsule found"

  Scenario: Filter capsules by status
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "Happy birthday!"
    And a capsule titled "Summer letter" unlocked yesterday with the message "Hi."
    And a capsule titled "A note from last year" was opened yesterday with the message "Keep going."
    When I visit FutureMe
    And I filter capsules by "Ready"
    Then I see "Summer letter"
    And I do not see "Birthday wishes"
    And I do not see "A note from last year"
    When I filter capsules by "Opened"
    Then I see "A note from last year"
    And I do not see "Summer letter"
    And I see "1 capsule found"

  Scenario: No capsule matches a search
    Given a capsule titled "Birthday wishes" unlocks tomorrow with the message "Happy birthday!"
    When I visit FutureMe
    And I search capsules for "ocean"
    Then I see "No capsules match"
    When I clear capsule search
    Then I see "Birthday wishes"
    And I do not see "No capsules match"

  Scenario: Keep loading failures distinct from an empty collection
    Given the capsule API is unavailable
    When I visit FutureMe
    Then I see "Couldn't load your capsules"
    When I search capsules for "birthday"
    Then I see "Couldn't load your capsules"
    And I do not see "No capsules yet"

  Scenario: Empty home page
    When I visit FutureMe
    Then I see "No capsules yet"

  Scenario: Reject an unlock time in the past
    When I visit FutureMe
    And I visit the new capsule page
    And I continue alone
    And I fill in "Title" with "Too late"
    And I fill in "Message" with "Oops"
    And I continue to "Design"
    And I continue to "Deliver"
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
    And I continue alone
    And I continue to "Design"
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
    And I continue alone
    And I continue to "Design"
    And I attach "setup.exe" with "Add photo"
    Then I see "File type not supported"
