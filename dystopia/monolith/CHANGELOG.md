# Changelog

## [0.5.0](https://github.com/panicboat/monorepo/compare/monolith-v0.4.0...monolith-v0.5.0) (2026-09-07)


### Features

* **dystopia/monolith:** emit gRPC traces via the OpenTelemetry SDK ([#1093](https://github.com/panicboat/monorepo/issues/1093)) ([59811cc](https://github.com/panicboat/monorepo/commit/59811ccccd56ffc0936810429884bc9f2633fb6d))

## [0.4.0](https://github.com/panicboat/monorepo/compare/monolith-v0.3.1...monolith-v0.4.0) (2026-09-06)


### Features

* **monolith:** wire billing settings from Secrets Manager ([#1067](https://github.com/panicboat/monorepo/issues/1067)) ([78f705f](https://github.com/panicboat/monorepo/commit/78f705ffc4fa682aa9a3ad937b4af08773bff83e))

## [0.3.1](https://github.com/panicboat/monorepo/compare/monolith-v0.3.0...monolith-v0.3.1) (2026-09-06)


### Bug Fixes

* **monolith:** skip structure.sql dump on startup migrate ([#1065](https://github.com/panicboat/monorepo/issues/1065)) ([f6bc8de](https://github.com/panicboat/monorepo/commit/f6bc8de616248b8b787ebcd80e9bf7ac98ba6142))

## [0.3.0](https://github.com/panicboat/monorepo/compare/monolith-v0.2.1...monolith-v0.3.0) (2026-09-05)


### Features

* **clusters/production:** move workloads out of default namespace ([#1007](https://github.com/panicboat/monorepo/issues/1007)) ([38ad079](https://github.com/panicboat/monorepo/commit/38ad07911cfe31549dab783576fc00cb4c46b57c))
* migrate identity management from self-hosted to Cognito ([#1016](https://github.com/panicboat/monorepo/issues/1016)) ([9295fa2](https://github.com/panicboat/monorepo/commit/9295fa2b2727839bd919387210f3d3d17ab81489))
* **monolith/billing:** add Stripe monthly subscription slice ([#1015](https://github.com/panicboat/monorepo/issues/1015)) ([a0f4e7a](https://github.com/panicboat/monorepo/commit/a0f4e7a2bd2438cc3780306f9556d6b4f1ed6068))
* **monolith:** attach Cognito AdminDeleteUser via EKS Pod Identity ([#1022](https://github.com/panicboat/monorepo/issues/1022)) ([4fa3205](https://github.com/panicboat/monorepo/commit/4fa3205b93d5ee8f678c6e184333188e79b22e34))


### Bug Fixes

* Fix database secret key ([#1009](https://github.com/panicboat/monorepo/issues/1009)) ([e921abd](https://github.com/panicboat/monorepo/commit/e921abdd966465d0ce0628861502cc9d78382829))

## [0.2.1](https://github.com/panicboat/monorepo/compare/monolith-v0.2.0...monolith-v0.2.1) (2026-05-17)


### Bug Fixes

* **monolith:** make unify_user_id migration idempotent and stop silencing migrate failures ([#634](https://github.com/panicboat/monorepo/issues/634)) ([1d12765](https://github.com/panicboat/monorepo/commit/1d127658292c71b40015805c87946b732d01ebaf))

## [0.2.0](https://github.com/panicboat/monorepo/compare/monolith-v0.1.0...monolith-v0.2.0) (2026-05-17)


### Features

* **flux:** cut over production deploy to semver image tags ([#624](https://github.com/panicboat/monorepo/issues/624)) ([cd6768f](https://github.com/panicboat/monorepo/commit/cd6768f0beb5246d076cc1175e2d8fb8bc15b680))


### Performance Improvements

* **monolith:** multi-stage Dockerfile + BuildKit cache mounts ([#627](https://github.com/panicboat/monorepo/issues/627)) ([2fe4e23](https://github.com/panicboat/monorepo/commit/2fe4e238f6308077c992e03e34fbeec90f15b8d9))

## 0.1.0 (2026-05-16)


### Features

* bootstrap release-please path routing (monolith / frontend) ([#610](https://github.com/panicboat/monorepo/issues/610)) ([540e959](https://github.com/panicboat/monorepo/commit/540e9595f33aac339904d1bca628eec497d6d31e))
