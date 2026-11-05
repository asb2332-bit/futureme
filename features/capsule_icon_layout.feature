Feature: Preserve a capsule's icon layout
  As someone designing a time capsule
  I want my icon's position, size, and rotation to survive sealing
  So that the saved poster matches my design

  Scenario: Reopen a capsule with a customized icon
    When I visit FutureMe
    And I visit the new capsule page
    And I fill in "Icon" with "✦"
    And I fill in "Title" with "My icon layout"
    And I fill in "Message" with "A message for later"
    And I fill in "Unlock at" with a date one day from now
    And I move, resize, and rotate the poster icon
    And I create the capsule
    Then the capsule displays my customized icon layout
    And I see "This capsule is locked"
    And I do not see "A message for later"
    When I visit FutureMe
    And I open "My icon layout"
    Then the capsule displays my customized icon layout
