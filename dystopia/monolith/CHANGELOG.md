# Changelog

## [0.9.0](https://github.com/panicboat/monorepo/compare/monolith-v0.8.0...monolith-v0.9.0) (2026-10-10)


### Features

* **dystopia:** implement [@username](https://github.com/username) mentions in posts, comments, and replies ([#1348](https://github.com/panicboat/monorepo/issues/1348)) ([6895572](https://github.com/panicboat/monorepo/commit/6895572f1fbdb57c9a7189cb9bb3581af36be535))
* **dystopia:** let the author edit a review or a karte entry ([#1496](https://github.com/panicboat/monorepo/issues/1496)) ([456549c](https://github.com/panicboat/monorepo/commit/456549c00e29bb9d88b3f4b683fdafe541808261))
* **dystopia:** move the acting principal from the account to the profile ([#1403](https://github.com/panicboat/monorepo/issues/1403)) ([f71d417](https://github.com/panicboat/monorepo/commit/f71d417aeee6db931b5537cee129a59e9ada3731))
* **dystopia:** own karte entries by account and show the writing profile as author ([#1410](https://github.com/panicboat/monorepo/issues/1410)) ([e29abdb](https://github.com/panicboat/monorepo/commit/e29abdb9e64a63033544bd246f97965e4c69eaba))
* **dystopia:** profile lifecycle, per-profile purge and hiding of disabled profiles ([#1424](https://github.com/panicboat/monorepo/issues/1424)) ([abaed78](https://github.com/panicboat/monorepo/commit/abaed78ff5e248615d318db19588b80fa8a37324))
* **dystopia:** record the owning account of a media file and key its object by the uploading profile ([#1443](https://github.com/panicboat/monorepo/issues/1443)) ([3008360](https://github.com/panicboat/monorepo/commit/300836072952d9c8b80b73fcf7132c741dae9002))
* **dystopia:** turn the tags written in a post into links that find posts with the same tag ([#1501](https://github.com/panicboat/monorepo/issues/1501)) ([ff167b8](https://github.com/panicboat/monorepo/commit/ff167b8452098d534621f5b88b67e71be288d4e2))


### Bug Fixes

* **dystopia/frontend:** show the industry of a cast as an icon ([#1490](https://github.com/panicboat/monorepo/issues/1490)) ([924baae](https://github.com/panicboat/monorepo/commit/924baaea4bf7c9b24181b72a14f1825b1fedfbd0))
* **dystopia/monolith:** authenticate media requests and let only the uploader delete a media file ([#1435](https://github.com/panicboat/monorepo/issues/1435)) ([49fcbc9](https://github.com/panicboat/monorepo/commit/49fcbc944f918f157ea8704118cce87f45528c1b))
* **dystopia/monolith:** deliver messaging stream events instead of failing on the first one ([#1430](https://github.com/panicboat/monorepo/issues/1430)) ([c5d09dd](https://github.com/panicboat/monorepo/commit/c5d09dda2f896015e6428eaeddc337afd0d41b9e))
* **dystopia/monolith:** save notification preferences on every update ([#1427](https://github.com/panicboat/monorepo/issues/1427)) ([cdc0bbb](https://github.com/panicboat/monorepo/commit/cdc0bbbe8e0ae9dad1355a4d9c61d3536e9fa4c7))
* **dystopia/monolith:** seed the follows and the block the seed summary describes ([#1432](https://github.com/panicboat/monorepo/issues/1432)) ([eda3800](https://github.com/panicboat/monorepo/commit/eda38007d8a45c3a6e74b6ea797a7753db2b55a6))
* **dystopia/monolith:** stop gruf from taking a reload lock on every request ([#1428](https://github.com/panicboat/monorepo/issues/1428)) ([eaa3906](https://github.com/panicboat/monorepo/commit/eaa39069839b15e48c82245db134b8ba82a410d1))
* **dystopia/monolith:** store the kind of a media file instead of always storing unknown ([#1450](https://github.com/panicboat/monorepo/issues/1450)) ([1180da0](https://github.com/panicboat/monorepo/commit/1180da0eb899908f9083be80747b3aca13d99d25))
* **dystopia:** answer NOT_FOUND from GetProfile for a profile that does not exist ([#1433](https://github.com/panicboat/monorepo/issues/1433)) ([cefcad8](https://github.com/panicboat/monorepo/commit/cefcad86dc7699537b6443fa1e90cd983b1f9e6c))
* **dystopia:** feed and ranking errors, local dev sign-in ([#1380](https://github.com/panicboat/monorepo/issues/1380)) ([7e68c92](https://github.com/panicboat/monorepo/commit/7e68c9221bd7ccf1e5b85c137215ad1867aee4f7))
* **dystopia:** gate message button by role-based follow requirement ([#1301](https://github.com/panicboat/monorepo/issues/1301)) ([68f1563](https://github.com/panicboat/monorepo/commit/68f1563fede3044976a07e17b65682a5debc554b))
* **dystopia:** refresh an open conversation by polling and remove the event stream ([#1441](https://github.com/panicboat/monorepo/issues/1441)) ([7b9417a](https://github.com/panicboat/monorepo/commit/7b9417accc5f5682a4cc0ae38418da45d9904e33))
* **dystopia:** seed accounts that own a second profile and make the README seed steps match the schema ([#1451](https://github.com/panicboat/monorepo/issues/1451)) ([09db2a8](https://github.com/panicboat/monorepo/commit/09db2a8d0c276693dc8d82b6fd36c20dd542e823))
* **dystopia:** show who a conversation is with and say why a reply cannot be sent ([#1493](https://github.com/panicboat/monorepo/issues/1493)) ([79269bc](https://github.com/panicboat/monorepo/commit/79269bcf71f54df3d722783db0ef4a68af6cb8d6))

## [0.8.0](https://github.com/panicboat/monorepo/compare/monolith-v0.7.1...monolith-v0.8.0) (2026-09-29)


### Features

* **dystopia:** add karte and review tabs to Home ([#1297](https://github.com/panicboat/monorepo/issues/1297)) ([b0ace3c](https://github.com/panicboat/monorepo/commit/b0ace3c1dbd585976be2814d1f2a3c3e81d663ce))


### Bug Fixes

* **dystopia/monolith:** default karte access to true until billing lands ([#1289](https://github.com/panicboat/monorepo/issues/1289)) ([2d27908](https://github.com/panicboat/monorepo/commit/2d27908becff43bb8142264769b166811909674b))
* **dystopia:** gate karte viewing/creation to casts only ([#1298](https://github.com/panicboat/monorepo/issues/1298)) ([62f85c5](https://github.com/panicboat/monorepo/commit/62f85c5b00ac42f8f444078792bfa8bb011f5cf1))
* **dystopia:** show target identity in review and karte lists ([#1292](https://github.com/panicboat/monorepo/issues/1292)) ([f75485f](https://github.com/panicboat/monorepo/commit/f75485f1d09a4dc77fa8edd004cd36107721818e))

## [0.7.1](https://github.com/panicboat/monorepo/compare/monolith-v0.7.0...monolith-v0.7.1) (2026-09-27)


### Bug Fixes

* **dystopia/monolith:** automate DB migration with a Job and gate rollouts with probes ([#1273](https://github.com/panicboat/monorepo/issues/1273)) ([4a0a5ff](https://github.com/panicboat/monorepo/commit/4a0a5ffad0273723d50219abd408a5625059deaf))
* **dystopia/monolith:** hydrate reply author in ListCommentsByAuthor response ([#1255](https://github.com/panicboat/monorepo/issues/1255)) ([8bc1d41](https://github.com/panicboat/monorepo/commit/8bc1d4139107d0052d83035d21fad8d982efe3ca))
* **dystopia:** link comment and reply avatars to author profile ([#1260](https://github.com/panicboat/monorepo/issues/1260)) ([301a742](https://github.com/panicboat/monorepo/commit/301a742a8005380e1cb09418470dd4fc326d755f))
* **dystopia:** reject cross-account likes-list requests ([#1271](https://github.com/panicboat/monorepo/issues/1271)) ([389c27b](https://github.com/panicboat/monorepo/commit/389c27b07f32ed0db05e67759e0f820b1cd44dac))
* **dystopia:** remove unused cast area setting ([#1259](https://github.com/panicboat/monorepo/issues/1259)) ([e08aafa](https://github.com/panicboat/monorepo/commit/e08aafabc5d84fec86c0344591a95c29803bc6a2))

## [0.7.0](https://github.com/panicboat/monorepo/compare/monolith-v0.6.2...monolith-v0.7.0) (2026-09-26)


### Features

* **review:** add Guest→Cast review feature ([#1232](https://github.com/panicboat/monorepo/issues/1232)) ([#1234](https://github.com/panicboat/monorepo/issues/1234)) ([7043d79](https://github.com/panicboat/monorepo/commit/7043d79a7e5f2d0e1718c29b50657035ed264102))

## [0.6.2](https://github.com/panicboat/monorepo/compare/monolith-v0.6.1...monolith-v0.6.2) (2026-09-24)


### Bug Fixes

* **dystopia:** media upload failing in production (S3 storage backend) ([#1212](https://github.com/panicboat/monorepo/issues/1212)) ([c878ea6](https://github.com/panicboat/monorepo/commit/c878ea65f35cb1e319c9b40f00b759a76786b207))

## [0.6.1](https://github.com/panicboat/monorepo/compare/monolith-v0.6.0...monolith-v0.6.1) (2026-09-23)


### Bug Fixes

* **dystopia/monolith:** align profile seed with body_stats schema ([#1196](https://github.com/panicboat/monorepo/issues/1196)) ([251cac8](https://github.com/panicboat/monorepo/commit/251cac833298eb3450cef9be5e00a07ca0d28696))

## [0.6.0](https://github.com/panicboat/monorepo/compare/monolith-v0.5.0...monolith-v0.6.0) (2026-09-20)


### Features

* **dystopia:** add schedule slice for cast attendance ([#1185](https://github.com/panicboat/monorepo/issues/1185)) ([e5a4f3a](https://github.com/panicboat/monorepo/commit/e5a4f3a1550a033da10b5bd3dd8a4f6a9120d0e0))
* **dystopia:** enrich cast profile with body stats and sns links ([#1182](https://github.com/panicboat/monorepo/issues/1182)) ([2c8292f](https://github.com/panicboat/monorepo/commit/2c8292fab1dddc328c44cc018c224568bb0eb1ce))

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
