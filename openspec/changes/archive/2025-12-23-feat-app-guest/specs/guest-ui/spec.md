# Spec: Guest UI Features

# Spec: Guest UI Features

## ADDED Requirements

### Requirement: Global Navigation
The application MUST provide a global navigation bar at the bottom of the screen.

#### Scenario: Display Logic
- The navigation bar MUST be fixed at the bottom.
- It MUST contain links to `Home`, `Talk` (Chats), and `History`.
- The current page icon MUST be highlighted.

### Requirement: Home Screen
The application MUST display a Home screen at `/home` with discovery features.

#### Scenario: Home Layout
- **Header**: MUST display "PrivateHeaven" logo.
- **Tabs**: MUST allow switching between `Discover` and `Following`.
- **List**: MUST display a feed of cast updates (mock data).

### Requirement: Chat List Screen
The application MUST display a list of chats at `/chats`.

#### Scenario: Chat List Layout
- **Header**: MUST display "Messages".
- **Tabs**: MUST include `All`, `Invitations`, and `Unread`.
- **Invitations**: MUST be displayed with a distinct gold border design.
- **Badge**: MUST show unread counts.

## Technical Specifications
- **Styling**: Tailwind CSS v4 + Lucide React.
- **Animation**: Framer Motion.
- **Data**: MSW (`/api/guest/home`).
