# Changelog

## [0.3.0](https://github.com/panicboat/monorepo/compare/monolith-v0.2.1...monolith-v0.3.0) (2026-06-14)


### Features

* **feed:** symmetric ListFeed handler + use_case + adapter methods ([#663](https://github.com/panicboat/monorepo/issues/663)) ([3fdef23](https://github.com/panicboat/monorepo/commit/3fdef236c58a459f1fcf70630c60fa1b71f8121d))
* **feed:** symmetric ListFeed proto contract + slice design spec ([#660](https://github.com/panicboat/monorepo/issues/660)) ([eebfd8a](https://github.com/panicboat/monorepo/commit/eebfd8aa0866b0b440bc905e3e7cd664abfb90e5))
* **identity:** Account rename + RS256 JWT + frontend stub follow-up ([#649](https://github.com/panicboat/monorepo/issues/649)) ([00215b9](https://github.com/panicboat/monorepo/commit/00215b990289208cba3cdd5a046207b4b5077907))
* **post:** add ListPostsByIds use_case for cross-slice hydration ([#661](https://github.com/panicboat/monorepo/issues/661)) ([c8ea518](https://github.com/panicboat/monorepo/commit/c8ea518c98d70c46c46cdf8d20973a905ea7ea24))
* **posts:** symmetric posts backend — proto/schema/PostService/LikeService ([#652](https://github.com/panicboat/monorepo/issues/652)) ([12bc787](https://github.com/panicboat/monorepo/commit/12bc787d9e0584a2e3aa701c2763dbd8f3d40652))
* **post:** symmetric comment author resolution via ProfileService ([#655](https://github.com/panicboat/monorepo/issues/655)) ([a29378a](https://github.com/panicboat/monorepo/commit/a29378a1b686ca281359f66d5b8d5e9ab006b4e0))
* **post:** symmetric comment list author resolution via ProfileService ([#656](https://github.com/panicboat/monorepo/issues/656)) ([c493592](https://github.com/panicboat/monorepo/commit/c49359283042773b4edb86ca9e9f218439109782))
* **profile:** add ListAccountIdsByPrefecture use_case for cross-slice feed query ([#662](https://github.com/panicboat/monorepo/issues/662)) ([eae2061](https://github.com/panicboat/monorepo/commit/eae20610e5a104a28e802c1ac0d95965659b193f))
* **profile:** rebuild profile as full vertical slice (proto/monolith/frontend) ([#651](https://github.com/panicboat/monorepo/issues/651)) ([cda4c85](https://github.com/panicboat/monorepo/commit/cda4c85fd84f446df0d8f41c8d9f5d94ba97b697))

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
