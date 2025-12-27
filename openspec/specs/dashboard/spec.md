# dashboard Specification

## Purpose
TBD - created by archiving change feat-app-cast. Update Purpose after archive.
## Requirements
### Requirement: Cast Dashboard View
The system MUST provide a dashboard view for authenticated Cast users.

#### Scenario: Display key metrics
Given an authenticated Cast user
When they access the dashboard
Then they see their "Promise Rate", "Followers count", and "Unread messages count".

#### Scenario: Display Today's Promise
Given a Cast user with a scheduled promise for today
When they view the dashboard
Then they see a "TODAY'S PROMISE" card with the remaining time and a "Go to Chat" button.

### Requirement: Status Management
The system MUST allow Casts to update their online status.

#### Scenario: Change status
Given a Cast user on the dashboard
When they select a different status (e.g., "Tonight") from the header dropdown
Then the status indicator color updates immediately.

