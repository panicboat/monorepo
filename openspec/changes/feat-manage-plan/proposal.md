# Manage Plans Feature

## Why
Currently, casts can only set their plans during the onboarding process. There is no way to edit them afterwards. This feature empowers casts to manage their service offerings continuously.

## What Changes
- Create userspace route `/manage/plan`.
- Refactor `PlanEditor` for reusability and UI consistency.
- Implement plan management flow.

## Verification
- Verify `/manage/plan` loads.
- Verify plans can be added, edited, deleted.
- Verify changes are saved.
