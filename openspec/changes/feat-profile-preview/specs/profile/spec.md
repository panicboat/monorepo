# Profile Preview Specs

## ADDED Requirements

### Requirement: Profile Preview Capability
The system MUST allow casts to preview their profile changes in a simulated guest view without saving data to the backend.

#### Scenario: Previewing unsaved changes
Given I am on the Profile Edit page
And I have modified my nickname to "New Name"
And I have not saved the changes yet
When I click the "Preview" button
Then a modal should appear displaying the Guest Detail view
And the displayed nickname should be "New Name"

#### Scenario: Previewing without changes
Given I am on the Profile Edit page
And I have not made any changes
When I click the "Preview" button
Then a modal should appear displaying the current profile data

#### Scenario: Closing preview
Given the Preview Modal is open
When I click the close button or outside the modal
Then the modal should close
And I should return to the Profile Edit page with my unsaved changes intact
