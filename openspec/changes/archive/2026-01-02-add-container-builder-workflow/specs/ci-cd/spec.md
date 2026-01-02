## ADDED Requirements
### Requirement: Container Image Build and Push
The system SHALL automatically build and push container images to GitHub Container Registry (GHCR) when triggered by a deployment event for a service with the `docker` stack.

#### Scenario: Successful build and push
- **WHEN** a deployment is triggered for a service with `stack: docker`
- **THEN** authentication with GHCR is performed
- **THEN** the Docker image is built using the service's context
- **THEN** the image is pushed to `ghcr.io/{repository}/{image-name}`
- **THEN** the image is tagged with `sha-{commit}` and `latest` (for main branch)
