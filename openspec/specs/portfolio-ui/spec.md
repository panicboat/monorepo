# portfolio-ui Specification

## Purpose
TBD - created by archiving change feat-feature-portfolio. Update Purpose after archive.
## Requirements
### Requirement: Cast Detail Page
The application MUST provide a dedicated page for viewing cast details at `/casts/[id]`.

#### Scenario: Profile Display
- **Hero Section**: MUST display a full-screen hero image.
- **Radar Chart**: MUST display an animated radar chart showing cast traits (Looks, Tech, etc.).
- **Portfolio Grid**: MUST display a grid of portfolio photos.

### Requirement: Booking Interaction
The application MUST allow users to request an invitation from the profile page.

#### Scenario: Floating Footer
- **Visibility**: MUST be fixed at the bottom of the screen.
- **Action**: MUST navigate to the chat screen (`/chats/[id]`) when "Request Invitation" is clicked.

