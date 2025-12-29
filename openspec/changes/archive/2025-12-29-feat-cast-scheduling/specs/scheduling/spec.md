# Spec: Cast Smart Scheduling

## ADDED Requirements

### Requirement: Schedule Management View
The system MUST provide a schedule management view for Casts.

#### Scenario: View Calendar
Given an authenticated Cast user
When they access the Schedule page (`/cast/schedule`)
Then they see a calendar grid for the current month.

#### Scenario: Manage Availability
Given a Cast user on the Schedule page
When they select a date
Then they can add or remove "Available" time slots.

### Requirement: Smart Invitation Drawer
The system MUST provide an invitation creation drawer in the chat interface.

#### Scenario: Open Drawer
Given a Cast user in a chat room
When they click the "Create Invitation" button (or similar trigger)
Then the Smart Invitation Drawer slides up from the bottom.

#### Scenario: Auto-suggest Slots
Given the Drawer is open
When it initializes
Then it displays auto-suggested time slots based on the Cast's schedule (e.g., "Today 21:00").

#### Scenario: Send Invitation
Given a specific slot and plan are selected in the Drawer
When the Cast clicks "Send Invitation"
Then a POST request is sent to `/api/chats/:id/invitations`
And the drawer closes with a success feedback.
