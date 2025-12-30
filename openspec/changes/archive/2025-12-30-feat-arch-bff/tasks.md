# Tasks: BFF Setup

- [x] Setup Buf <!-- id: 1 -->
    - Initialize `buf` in the root or `services/monolith`.
    - Configure linting.

- [x] Generate Types <!-- id: 2 -->
    - Configure `buf.gen.yaml` to output TypeScript/ES definitions to `web/heaven/packages/rpc` (or similar shared package).

- [x] Implement BFF Client <!-- id: 3 -->
    - Install Connect libs in `web/heaven`.
    - Create a gRPC Client Factory (using `createPromiseClient`).
    - Implement a test Server Action that calls `IdentityService.HealthCheck` via the client.
