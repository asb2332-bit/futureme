Feature: Account access
  As a person preserving private memories
  I want to sign in with my own account
  So that only I can access my capsules

  Scenario: Register a regular account
    When I register with email "new@example.com" and password "a-secure-password"
    Then I see "new@example.com"
    And my account has the user role

  Scenario: Log in and log out
    Given I am a registered user who is logged in
    Then I see "member@example.com"
    When I log out
    Then I see "You have logged out."
    When I log in with email "member@example.com" and password "a-secure-password"
    Then I see "member@example.com"

  Scenario: Reject an incorrect password
    Given an account exists with email "member@example.com"
    When I log in with email "member@example.com" and password "incorrect-password"
    Then I see "Invalid email or password."

  Scenario: Admin can access account overview
    Given I am logged in as an admin
    When I visit the admin overview
    Then I see "Account overview"

  Scenario: Regular users cannot access admin pages
    Given I am a registered user who is logged in
    When I visit the admin overview
    Then I do not see "Account overview"

  Scenario: Google sign-in creates a regular account
    Given Google accepts my sign-in as "google@example.com"
    When I sign in with Google
    Then I see "google@example.com"
    And my account has the user role

  Scenario: Google sign-in is cancelled
    Given Google sign-in is cancelled
    When I sign in with Google
    Then I see "Google sign-in was cancelled or failed."
