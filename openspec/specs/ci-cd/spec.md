# ci-cd Specification

## Purpose
TBD - created by archiving change add-container-builder-workflow. Update Purpose after archive.
## Requirements
### Requirement: Container Image Build and Push
The system SHALL automatically build and push container images to GitHub Container Registry (GHCR) when triggered by a deployment event for a service with the `docker` stack.

#### Scenario: Successful build and push
- **WHEN** a deployment is triggered for a service with `stack: docker`
- **THEN** authentication with GHCR is performed
- **THEN** the Docker image is built using the service's context
- **THEN** the image is pushed to `ghcr.io/{repository}/{image-name}`
- **THEN** the image is tagged with `sha-{commit}` and `latest` (for main branch)

### Requirement: Directory Structure Separation
Application source code MUST be isolated in a `workspace` directory to separate it from infrastructure configurations (kubernetes, terragrunt).

#### Scenario: Renaming for Clarity
- Given a service directory
- When structure is inspected
- Then application code MUST be in `workspace` directory (formerly `docker`)

### Requirement: CI Builder Configuration
Each service's Docker build configuration MUST point to the `docker` directory as the build context root.

#### Scenario: Building Monolith Service
- Given the `monolith` service definition
- When the CI pipeline triggers a build
- Then it MUST use the root directory (`services/monolith`) as the build context because `Dockerfile` assumes access to `Gemfile` and `app` directory at the root.

#### Scenario: Building Frontend Service
- Given the `heaven` workspace
- When the CI pipeline triggers a build
- Then it MUST use the workspace root (`web/heaven`) as the build context to allow Turborepo to prune/build workspace dependencies correctly.
- And it MUST expect a `Dockerfile` at the workspace root.

### Requirement: Documentation Local Development
The `services/docs/workspace` directory MUST contain a `docker-compose.yaml` file to facilitate local development and verification of the documentation site.

#### Scenario: Running Docs Locally
- Given the `services/docs/workspace` directory
- When `docker-compose up` is executed
- Then the documentation site MUST be accessible (e.g., via localhost).

