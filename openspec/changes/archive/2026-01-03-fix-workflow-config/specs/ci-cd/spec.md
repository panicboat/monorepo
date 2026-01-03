# CI/CD Specs

## ADDED Requirements

### Requirement: Directory Structure Separation
Application source code MUST be isolated in a `docker` directory to separate it from infrastructure configurations (kubernetes, terragrunt).

#### Scenario: Isolating Code
- Given a service directory (e.g., `services/monolith`)
- When listing the contents
- Then it MUST contain a `docker` directory containing the application code and Dockerfile
- And it MUST separate `kubernetes` and `terragrunt` directories from the application logic.

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
