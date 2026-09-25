# Changelog

## [0.8.3](https://github.com/panicboat/monorepo/compare/frontend-v0.8.2...frontend-v0.8.3) (2026-09-25)


### Bug Fixes

* **dystopia/frontend:** use dvh so BottomTab tracks the visible viewport ([#1230](https://github.com/panicboat/monorepo/issues/1230)) ([f34290f](https://github.com/panicboat/monorepo/commit/f34290fc699fd4a629cb9cce59ef0e0a0accb4d2))

## [0.8.2](https://github.com/panicboat/monorepo/compare/frontend-v0.8.1...frontend-v0.8.2) (2026-09-25)


### Bug Fixes

* **dystopia/frontend:** pin BottomTab to viewport bottom on short pages ([#1228](https://github.com/panicboat/monorepo/issues/1228)) ([0ffef81](https://github.com/panicboat/monorepo/commit/0ffef81c8a89bdf30f767f7dd3fbd4ab30c885b0))

## [0.8.1](https://github.com/panicboat/monorepo/compare/frontend-v0.8.0...frontend-v0.8.1) (2026-09-24)


### Bug Fixes

* **dystopia:** media upload failing in production (S3 storage backend) ([#1212](https://github.com/panicboat/monorepo/issues/1212)) ([c878ea6](https://github.com/panicboat/monorepo/commit/c878ea65f35cb1e319c9b40f00b759a76786b207))

## [0.8.0](https://github.com/panicboat/monorepo/compare/frontend-v0.7.0...frontend-v0.8.0) (2026-09-23)


### Features

* **dystopia/frontend:** add unauthenticated landing page ([#1198](https://github.com/panicboat/monorepo/issues/1198)) ([d3e8813](https://github.com/panicboat/monorepo/commit/d3e88136a66c7f284e378fdbbcd4dae47ce7afc2))
* **dystopia/frontend:** refresh the home feed after posting ([#1194](https://github.com/panicboat/monorepo/issues/1194)) ([0b36ea8](https://github.com/panicboat/monorepo/commit/0b36ea8e7d138ec68ffd8d5d4cafe1e2b6181ffc))


### Bug Fixes

* **dystopia/frontend:** align schedule rows into a 2-column layout ([#1189](https://github.com/panicboat/monorepo/issues/1189)) ([680dee7](https://github.com/panicboat/monorepo/commit/680dee76479a8db97ba3201c4861e6bc26175091))
* **dystopia/frontend:** clarify guest/cast role selector on signup ([#1199](https://github.com/panicboat/monorepo/issues/1199)) ([5301f5c](https://github.com/panicboat/monorepo/commit/5301f5c629dbefb866fe6bafd3037a88f9012127))
* **dystopia/frontend:** drop karte mention from the deactivation copy ([#1192](https://github.com/panicboat/monorepo/issues/1192)) ([21b0606](https://github.com/panicboat/monorepo/commit/21b0606e9c7def47666af51e2db03613aafc9046))
* **dystopia/frontend:** wire media upload into the post composer ([#1191](https://github.com/panicboat/monorepo/issues/1191)) ([a868103](https://github.com/panicboat/monorepo/commit/a8681032c1218623ed04da0b444682453ecf6d92))

## [0.7.0](https://github.com/panicboat/monorepo/compare/frontend-v0.6.1...frontend-v0.7.0) (2026-09-20)


### Features

* **dystopia:** add schedule slice for cast attendance ([#1185](https://github.com/panicboat/monorepo/issues/1185)) ([e5a4f3a](https://github.com/panicboat/monorepo/commit/e5a4f3a1550a033da10b5bd3dd8a4f6a9120d0e0))
* **dystopia:** enrich cast profile with body stats and sns links ([#1182](https://github.com/panicboat/monorepo/issues/1182)) ([2c8292f](https://github.com/panicboat/monorepo/commit/2c8292fab1dddc328c44cc018c224568bb0eb1ce))

## [0.6.1](https://github.com/panicboat/monorepo/compare/frontend-v0.6.0...frontend-v0.6.1) (2026-09-18)


### Bug Fixes

* **dystopia/frontend:** always route the profile nav item to /profile ([#1179](https://github.com/panicboat/monorepo/issues/1179)) ([c2e66db](https://github.com/panicboat/monorepo/commit/c2e66db0c4bb611dd073957e17f267766298aec4))

## [0.6.0](https://github.com/panicboat/monorepo/compare/frontend-v0.5.0...frontend-v0.6.0) (2026-09-18)


### Features

* **dystopia/frontend:** add a first-run tour explaining each nav feature ([#1171](https://github.com/panicboat/monorepo/issues/1171)) ([98ee923](https://github.com/panicboat/monorepo/commit/98ee923ea1cc2fefc3c64c39398719d416a3bee7))


### Bug Fixes

* **dystopia/frontend:** confirm before logout and clear the session cookie ([#1172](https://github.com/panicboat/monorepo/issues/1172)) ([57301b6](https://github.com/panicboat/monorepo/commit/57301b6d40be446c0248f8f04ef54407044191e3))
* **dystopia/frontend:** link post author name to their profile ([#1168](https://github.com/panicboat/monorepo/issues/1168)) ([276c7ba](https://github.com/panicboat/monorepo/commit/276c7ba550d978f0d0fa3dfc49bcfcdec2143bee))
* **dystopia/frontend:** sign in by DB role instead of client-supplied role ([#1177](https://github.com/panicboat/monorepo/issues/1177)) ([38e7c3a](https://github.com/panicboat/monorepo/commit/38e7c3a856064656cace8db8f4a9fcdad681ef01))
* **dystopia/frontend:** treat a missing profile row as editable, not logged-out ([#1169](https://github.com/panicboat/monorepo/issues/1169)) ([8470e63](https://github.com/panicboat/monorepo/commit/8470e63e5f6bf1ce0f0e32e95fe8d1c970351b50))

## [0.5.0](https://github.com/panicboat/monorepo/compare/frontend-v0.4.1...frontend-v0.5.0) (2026-09-17)


### Features

* **frontend:** increase typography and icon scale ([#1159](https://github.com/panicboat/monorepo/issues/1159)) ([381b485](https://github.com/panicboat/monorepo/commit/381b48575ecfb65915bc285f071fc174feb98d37))

## [0.4.1](https://github.com/panicboat/monorepo/compare/frontend-v0.4.0...frontend-v0.4.1) (2026-09-17)


### Bug Fixes

* **dystopia/frontend:** sync Cognito user pool/client ID after pool recreate ([#1158](https://github.com/panicboat/monorepo/issues/1158)) ([46a4ae0](https://github.com/panicboat/monorepo/commit/46a4ae0abe416d55e5ead727daae704ac7e9c201))
* **dystopia/frontend:** update dependency next to v16.3.5 ([#1133](https://github.com/panicboat/monorepo/issues/1133)) ([021cc0e](https://github.com/panicboat/monorepo/commit/021cc0e3c2c98fa110fd914e2e8f832f048b88b9))

## [0.4.0](https://github.com/panicboat/monorepo/compare/frontend-v0.3.5...frontend-v0.4.0) (2026-09-07)


### Features

* **dystopia/frontend:** propagate trace context on gRPC calls to monolith ([#1095](https://github.com/panicboat/monorepo/issues/1095)) ([b67a1be](https://github.com/panicboat/monorepo/commit/b67a1bed604a29f64ebb1bad51d0909b062a6e78))


### Bug Fixes

* **dystopia/frontend:** update dependency @opentelemetry/api to ^1.9.1 ([#1102](https://github.com/panicboat/monorepo/issues/1102)) ([0e7c2fa](https://github.com/panicboat/monorepo/commit/0e7c2fa1e72068502b9f4efea0d3ed6a371fb075))

## [0.3.5](https://github.com/panicboat/monorepo/compare/frontend-v0.3.4...frontend-v0.3.5) (2026-09-07)


### Bug Fixes

* **frontend:** use a deterministic Username for ConfirmSignUp too ([#1086](https://github.com/panicboat/monorepo/issues/1086)) ([7217ae2](https://github.com/panicboat/monorepo/commit/7217ae213ed0b4615d705d8f794bbf0f84204f8e))

## [0.3.4](https://github.com/panicboat/monorepo/compare/frontend-v0.3.3...frontend-v0.3.4) (2026-09-06)


### Bug Fixes

* **frontend:** use a random Username for Cognito SignUp ([#1084](https://github.com/panicboat/monorepo/issues/1084)) ([be6103d](https://github.com/panicboat/monorepo/commit/be6103daf6bf956e3a958faf80dc46d313061a84))

## [0.3.3](https://github.com/panicboat/monorepo/compare/frontend-v0.3.2...frontend-v0.3.3) (2026-09-06)


### Bug Fixes

* **dystopia/frontend:** update dependency @bufbuild/protobuf to ^2.14.1 ([#1078](https://github.com/panicboat/monorepo/issues/1078)) ([bc68e6c](https://github.com/panicboat/monorepo/commit/bc68e6c96872bb822951cf6ae53b750f6a5ee99f))
* **dystopia/frontend:** update dependency jose to ^6.2.12 ([#1079](https://github.com/panicboat/monorepo/issues/1079)) ([c20da25](https://github.com/panicboat/monorepo/commit/c20da25a46a24576ddf575a0142810eb9bda5339))
* **dystopia/frontend:** update dependency next to v16.3.4 ([#1080](https://github.com/panicboat/monorepo/issues/1080)) ([2f5016a](https://github.com/panicboat/monorepo/commit/2f5016a904cea2e5611fdaa418ba7719a7284f8f))

## [0.3.2](https://github.com/panicboat/monorepo/compare/frontend-v0.3.1...frontend-v0.3.2) (2026-09-06)


### Bug Fixes

* **frontend:** normalize phone numbers to E.164 before Cognito calls ([#1076](https://github.com/panicboat/monorepo/issues/1076)) ([fbb3552](https://github.com/panicboat/monorepo/commit/fbb355223f378846a5e9254e16b94bc9250aa529))

## [0.3.1](https://github.com/panicboat/monorepo/compare/frontend-v0.3.0...frontend-v0.3.1) (2026-09-06)


### Bug Fixes

* **frontend:** wire real Cognito user pool config in production ([#1069](https://github.com/panicboat/monorepo/issues/1069)) ([88054c1](https://github.com/panicboat/monorepo/commit/88054c1bed145ef1e300f19c3e390170a08e831d))

## [0.3.0](https://github.com/panicboat/monorepo/compare/frontend-v0.2.1...frontend-v0.3.0) (2026-09-05)


### Features

* **clusters/production:** move workloads out of default namespace ([#1007](https://github.com/panicboat/monorepo/issues/1007)) ([38ad079](https://github.com/panicboat/monorepo/commit/38ad07911cfe31549dab783576fc00cb4c46b57c))
* migrate identity management from self-hosted to Cognito ([#1016](https://github.com/panicboat/monorepo/issues/1016)) ([9295fa2](https://github.com/panicboat/monorepo/commit/9295fa2b2727839bd919387210f3d3d17ab81489))


### Bug Fixes

* **dystopia/frontend:** update dependency next to v16.3.2 ([#1014](https://github.com/panicboat/monorepo/issues/1014)) ([3c9957a](https://github.com/panicboat/monorepo/commit/3c9957acda9acc1a85a0d2a753dfb6eb945f9b03))
* **dystopia/frontend:** update dependency next to v16.3.3 ([#1020](https://github.com/panicboat/monorepo/issues/1020)) ([158a593](https://github.com/panicboat/monorepo/commit/158a593ff1e5c06159e4d7d318ae20d75cb5736c))

## [0.2.1](https://github.com/panicboat/monorepo/compare/frontend-v0.2.0...frontend-v0.2.1) (2026-05-17)


### Bug Fixes

* **frontend:** align gRPC backend env name with code ([#633](https://github.com/panicboat/monorepo/issues/633)) ([03c72c9](https://github.com/panicboat/monorepo/commit/03c72c9b461c14008ca57fdc997b687b41eba959))

## [0.2.0](https://github.com/panicboat/monorepo/compare/frontend-v0.1.0...frontend-v0.2.0) (2026-05-17)


### Features

* **flux:** cut over production deploy to semver image tags ([#624](https://github.com/panicboat/monorepo/issues/624)) ([cd6768f](https://github.com/panicboat/monorepo/commit/cd6768f0beb5246d076cc1175e2d8fb8bc15b680))

## 0.1.0 (2026-05-16)


### Features

* bootstrap release-please path routing (monolith / frontend) ([#610](https://github.com/panicboat/monorepo/issues/610)) ([540e959](https://github.com/panicboat/monorepo/commit/540e9595f33aac339904d1bca628eec497d6d31e))
