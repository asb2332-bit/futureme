Feature: Continue an unfinished capsule
  As someone writing a message for the future
  I want to save my unfinished capsule on this device
  So that I can return to my writing and poster design later

  Scenario: Automatically save writing before refreshing the editor
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "A letter for later"
    And I fill in "Message" with "Remember how this moment felt."
    Then the draft is saved on this device
    And no capsule has been created
    When I refresh the draft editor
    Then the draft contains "A letter for later" in "Title"
    And the draft contains "Remember how this moment felt." in "Message"
    And no capsule has been created

  Scenario: Resume the complete poster design from the home page
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "My unfinished poster"
    And I fill in "Message" with "The part I will finish tomorrow."
    And I choose "Night" from "Theme"
    And I choose "Serif" from "Font"
    And I fill in "Icon" with "✦"
    And I add a text block
    And I fill in "Text block 1" with "An extra private note"
    And I set the draft unlock date to one day from now
    And I adjust and remember the draft icon layout
    And I save the draft
    And I visit FutureMe
    Then I see a saved draft titled "My unfinished poster"
    And I do not see "The part I will finish tomorrow."
    And I do not see "An extra private note"
    When I resume the draft titled "My unfinished poster"
    Then the draft contains "My unfinished poster" in "Title"
    And the draft contains "The part I will finish tomorrow." in "Message"
    And the draft contains "An extra private note" in "Text block 1"
    And the restored draft keeps my poster controls, unlock date, and icon layout
    And no capsule has been created

  Scenario: Seal one draft without removing another unfinished capsule
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Ready to seal"
    And I fill in "Message" with "See you in the future."
    And I set the draft unlock date to one day from now
    And I save the draft
    And I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Still writing"
    And I fill in "Message" with "I need more time to finish this."
    And I save the draft
    And I visit FutureMe
    Then I see a saved draft titled "Ready to seal"
    And I see a saved draft titled "Still writing"
    And no capsule has been created
    When I resume the draft titled "Ready to seal"
    And I create the capsule
    Then I see "This capsule is locked"
    When I visit FutureMe
    Then I do not see a saved draft titled "Ready to seal"
    And I see a saved draft titled "Still writing"
    And exactly one capsule titled "Ready to seal" has been created

  Scenario: Discard an unfinished capsule after confirming
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Changed my mind"
    And I fill in "Message" with "This draft can go."
    And I save the draft
    And I confirm discarding the draft
    And I visit FutureMe
    Then I do not see a saved draft titled "Changed my mind"
    And no capsule has been created

  Scenario: Keep a draft when the capsule is not ready to seal
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Missing a message"
    And I set the draft unlock date to one day from now
    And I save the draft
    And I create the capsule
    Then I see "Message can't be blank"
    When I visit FutureMe
    And I resume the draft titled "Missing a message"
    Then the draft contains "Missing a message" in "Title"
    And no capsule has been created

  Scenario: Keep the writing when sealing fails and retry successfully
    Given the next capsule submission fails to connect
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Try again later"
    And I fill in "Message" with "Please keep this message safe."
    And I set the draft unlock date to one day from now
    And I save the draft
    And I create the capsule
    Then the capsule submission failure is shown
    And the draft contains "Please keep this message safe." in "Message"
    And the draft titled "Try again later" remains saved locally
    And no capsule has been created
    When I create the capsule
    Then I see "This capsule is locked"
    And exactly one capsule titled "Try again later" has been created
    When I visit FutureMe
    Then I do not see a saved draft titled "Try again later"

  Scenario: Explain when this browser cannot save drafts
    Given this browser cannot store capsule drafts
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Keep this editor open"
    And I fill in "Message" with "I can still finish my message here."
    And I attempt to save the draft
    Then the draft storage failure is shown
    And the draft contains "I can still finish my message here." in "Message"
    And no capsule has been created

  Scenario: Keep both versions when another tab edits the same draft
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Title" with "Two versions"
    And I fill in "Message" with "The original unfinished message."
    And I save the draft
    And another tab saves "A message from the second tab." in this draft
    And I fill in "Message" with "My version from the first tab."
    Then I see "This draft changed in another tab. Reload it or save your version as a new draft."
    When I save my draft as a new draft
    And I visit FutureMe
    Then both draft messages "A message from the second tab." and "My version from the first tab." remain saved
    And no capsule has been created
