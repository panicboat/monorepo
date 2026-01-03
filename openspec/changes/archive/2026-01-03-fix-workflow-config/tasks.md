# Tasks

- [x] Renaming `services/docs/src` to `services/docs/docker` <!-- id: 4 -->
- [x] Restructure `services/monolith` <!-- id: 1 -->
    - Create `docker` directory.
    - Move application files (`app`, `config`, `lib`, `Gemfile`...) into `docker`.
- [x] Restructure `web/heaven` <!-- id: 2 -->
    - Create `docker` directory.
    - Move workspace files (`apps`, `packages`, `package.json`...) into `docker`.
- [x] Create `web/heaven/docker/Dockerfile` <!-- id: 0 -->
    - Implement multi-stage build for Next.js with Turborepo/pnpm.
- [x] Verify execution and paths <!-- id: 5 -->
    - Check if `pnpm dev` works from `web/heaven/docker`.
    - Ensure TS paths/aliases (`@/`) and internal updates resolve correctly.
- [x] Verify build locally <!-- id: 3 -->
    - Run `docker build` for all services pointing to `docker` context.
- [x] Manage `docker-compose.yaml` files <!-- id: 6 -->
    - Move `services/monolith/docker-compose.yaml` to `services/monolith/docker/` and update paths.
    - Create `web/heaven/docker/docker-compose.yaml` for local development.
