Feature: Preserve a capsule's icon layout
  Scenario: Edit, seal and reopen a poster with a custom icon
    Given I am a registered user who is logged in
    When I visit FutureMe
    And I visit the new capsule page
    And I choose "Night" from "Theme"
    And I fill in "Icon" with "✦"
    And I select the "Poster icon" poster block
    And I move the selected poster block
    And I resize the selected poster block
    And I rotate the selected poster block
    And I remember the selected poster block geometry
    And I fill in "Title" with "My icon layout"
    And I fill in "Message" with "A private message"
    And I fill in "Unlock at" with a date one day from now
    And I create the capsule
    Then the sealed stamp shows my customized icon layout
    And I do not see "A private message"
    When I edit the capsule
    And I select the "Poster icon" poster block
    Then the selected poster block geometry is restored
