# CI/CD Specs

## MODIFIED Requirements

### Requirement: Directory Structure Separation
Application source code MUST be isolated in a `workspace` directory to separate it from infrastructure configurations (kubernetes, terragrunt).

#### Scenario: Renaming for Clarity
- Given a service directory
- When structure is inspected
- Then application code MUST be in `workspace` directory (formerly `docker`)
