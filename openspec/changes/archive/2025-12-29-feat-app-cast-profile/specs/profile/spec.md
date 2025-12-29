# Spec: Cast Profile Edit

## ADDED Requirements

### Requirement: Profile Edit View
The system MUST provide a profile edit view for authenticated Cast users.

#### Scenario: Display Current Profile
Given an authenticated Cast user
When they access the Profile Edit page (`/cast/profile/edit`)
Then the form is pre-filled with their current profile data (Name, Photos, Tags, Bio).

### Requirement: Photo Management
The system MUST allow Casts to upload and remove profile photos.

#### Scenario: Add Photo
Given a Cast user on the Profile Edit page
When they select a photo to upload
Then the photo is displayed in the preview list.

#### Scenario: Remove Photo
Given a Cast user on the Profile Edit page
When they click the remove button on a photo
Then the photo is removed from the preview list.

### Requirement: Profile Update
The system MUST allow Casts to save their profile changes.

#### Scenario: Save Profile
Given a Cast user has modified their profile
When they click "Save"
Then a PUT request is sent to `/api/cast/profile`
And a success message is displayed.
