# Spec: Cast Onboarding

## ADDED Requirements

### Requirement: Onboarding Wizard
The system MUST provide an onboarding wizard for new Cast users to complete their profile.

#### Scenario: Multi-step completion
Given a new Cast user accessing `/cast/onboarding`
When they complete the "Profile" step and "Photo" step
Then they are shown a completion message
And redirected to the dashboard.
