# Profile Preview Feature

## Background
Currently, casts can edit their profile in the `/manage/profile` page, but they cannot see how it will look to guests before saving.
We want to allow casts to preview their profile changes in a "Guest View" modal using their local unsaved data.

## Goal
- Allow Casts to preview their profile edits in a Guest-like UI without saving.
- Reuse existing Guest components (`ProfileSpecs`, `PhotoGallery`) but adapt them to accept local data.

## Changes
### UI
- Add a "Preview" (Eye Icon) button to the Profile Edit page header or near the Save button.
- Create a `ProfilePreviewModal` that renders the Guest Detail view using form data.

### Components
- Refactor `PhotoGallery` to accept `images` prop (override ID-based fetch).
- Refactor `ProfileSpecs` to accept `profile` prop (override ID-based fetch).
