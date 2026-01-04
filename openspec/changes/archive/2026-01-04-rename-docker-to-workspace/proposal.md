# Proposal: Rename `docker` directory to `workspace`

## Goal
Rename the `docker` directory to `workspace` across all services to align with the updated `workflow-config.yaml` convention.

## Changes

### Directory Structure
- **`services/monolith`**: Rename `docker` -> `workspace`.
- **`services/docs`**: Rename `docker` -> `workspace`.
- **`web/nyx`**: Rename `docker` -> `workspace`.

### Configuration Updates
- **`workflow-config.yaml`**: Ensure `directory` is set to `workspace` (already done by user).
- **`docker-compose.yaml`**: Update build contexts and volume mounts to point to `workspace`.

## Verification
- Local build: `docker build` should succeed.
- Local execution: `docker-compose up` should work.
- CI/CD validation: `workflow-config` validation should pass.
