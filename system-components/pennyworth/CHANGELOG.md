# Changelog

## [1.2.3](https://github.com/panicboat/monorepo/compare/pennyworth-v1.2.2...pennyworth-v1.2.3) (2026-10-31)


### Bug Fixes

* **pennyworth:** read alert text in thread history ([#1881](https://github.com/panicboat/monorepo/issues/1881)) ([c47a82b](https://github.com/panicboat/monorepo/commit/c47a82b01cca33afbfbc1ca12279d3f5c9f75ca0))

## [1.2.2](https://github.com/panicboat/monorepo/compare/pennyworth-v1.2.1...pennyworth-v1.2.2) (2026-10-29)


### Miscellaneous Chores

* **pennyworth:** remove the release gate probe annotation ([#1848](https://github.com/panicboat/monorepo/issues/1848)) ([8452a7d](https://github.com/panicboat/monorepo/commit/8452a7db28160ca572b1322952abf2958e1d3301))

## [1.2.1](https://github.com/panicboat/monorepo/compare/pennyworth-v1.2.0...pennyworth-v1.2.1) (2026-10-29)


### Miscellaneous Chores

* **pennyworth:** add a release gate probe annotation ([#1846](https://github.com/panicboat/monorepo/issues/1846)) ([06249df](https://github.com/panicboat/monorepo/commit/06249df839167b1504113bb2ce465d8e132c2022))

## [1.2.0](https://github.com/panicboat/monorepo/compare/pennyworth-v1.1.0...pennyworth-v1.2.0) (2026-10-29)


### Features

* deploy kubernetes manifests together with service releases ([#1835](https://github.com/panicboat/monorepo/issues/1835)) ([d8fbfe2](https://github.com/panicboat/monorepo/commit/d8fbfe23c5d21d6897c5ff866865a06ce7e35940))


### Bug Fixes

* **system-components/pennyworth:** resolve Slack permalinks before asking HolmesGPT ([#1396](https://github.com/panicboat/monorepo/issues/1396)) ([76480e6](https://github.com/panicboat/monorepo/commit/76480e61d45120aa99809ce26939d0e94614bc18))


### Code Refactoring

* derive terragrunt state keys from the unit path ([#1828](https://github.com/panicboat/monorepo/issues/1828)) ([f6784b6](https://github.com/panicboat/monorepo/commit/f6784b69368dd3d7f049168604933a1e2569f2eb))


### Miscellaneous Chores

* normalize code comments ([#1275](https://github.com/panicboat/monorepo/issues/1275)) ([fb3d8ae](https://github.com/panicboat/monorepo/commit/fb3d8aeb5e3664540683668eace1a5d7bd4bc00d))
* **system-components/pennyworth/infrastructure/aws/modules:** update terraform aws to v6.66.0 ([#1321](https://github.com/panicboat/monorepo/issues/1321)) ([894deac](https://github.com/panicboat/monorepo/commit/894deac8a9879528f7dda2df6a1fd5bf82bc9d09))
* **system-components/pennyworth/infrastructure/aws/modules:** update terraform aws to v6.68.0 ([#1462](https://github.com/panicboat/monorepo/issues/1462)) ([2f8e613](https://github.com/panicboat/monorepo/commit/2f8e613e972ab3a3f52f0fc0b3b438fb32d07690))
* **system-components/pennyworth/infrastructure/aws/modules:** update terraform aws to v6.69.1 ([#1578](https://github.com/panicboat/monorepo/issues/1578)) ([5668965](https://github.com/panicboat/monorepo/commit/56689659af75eb81bc5ae23f877d0cd2939b4aac))
* **system-components/pennyworth/infrastructure/aws/modules:** update terraform aws to v6.70.0 ([#1765](https://github.com/panicboat/monorepo/issues/1765)) ([7f09fa6](https://github.com/panicboat/monorepo/commit/7f09fa61f5f7a7a138d49a453ab3cc2db4c17ad0))
* **system-components/pennyworth/infrastructure/aws/modules:** update terraform hashicorp/terraform to v1.13.0 ([#1376](https://github.com/panicboat/monorepo/issues/1376)) ([0526a56](https://github.com/panicboat/monorepo/commit/0526a56efcb7b6411d6585739e486318dbf18a2e))
* **system-components/pennyworth/infrastructure/aws/modules:** update terraform hashicorp/terraform to v1.13.1 ([#1388](https://github.com/panicboat/monorepo/issues/1388)) ([251f996](https://github.com/panicboat/monorepo/commit/251f996d728febe6d49fcdea7f032da0250c70ca))
* **system-components/pennyworth/infrastructure/aws/modules:** update terraform hashicorp/terraform to v1.13.2 ([#1650](https://github.com/panicboat/monorepo/issues/1650)) ([50d167e](https://github.com/panicboat/monorepo/commit/50d167e5fe30434b3885495b24b3e41dcac459a8))
* **system-components/pennyworth:** update golang docker tag to v1.27.2 ([#1454](https://github.com/panicboat/monorepo/issues/1454)) ([df0360a](https://github.com/panicboat/monorepo/commit/df0360aaf6b7ac2754c7e73cb95412a665dc4d4a))
* **system-components/pennyworth:** update golang docker tag to v1.27.3 ([#1627](https://github.com/panicboat/monorepo/issues/1627)) ([b0c5ad3](https://github.com/panicboat/monorepo/commit/b0c5ad39d75ee39c4ee8a7f1fe9ed88762626ea1))

## [1.1.0](https://github.com/panicboat/monorepo/compare/pennyworth-v1.0.0...pennyworth-v1.1.0) (2026-09-05)


### Features

* **system-components/pennyworth:** own Slack and GitHub App secrets ([#1055](https://github.com/panicboat/monorepo/issues/1055)) ([c81f194](https://github.com/panicboat/monorepo/commit/c81f19456531880eff8f98b133b1d781d23063b4))

## 1.0.0 (2026-09-05)


### Bug Fixes

* **system-components/pennyworth:** point Slack and GitHub secrets back at existing paths ([#1052](https://github.com/panicboat/monorepo/issues/1052)) ([513cf6c](https://github.com/panicboat/monorepo/commit/513cf6c367938a0c0d2da35f0809f0f7ca20f8d1))

## [0.6.1](https://github.com/panicboat/monorepo/compare/holmes-v0.6.0...holmes-v0.6.1) (2026-08-21)


### Bug Fixes

* **renovate:** keep a Go module's toolchain and builder image in lockstep ([#1000](https://github.com/panicboat/monorepo/issues/1000)) ([ead1414](https://github.com/panicboat/monorepo/commit/ead1414d7798ff839b66a252860693f256100dfe))

## [0.6.0](https://github.com/panicboat/monorepo/compare/holmes-v0.5.0...holmes-v0.6.0) (2026-08-16)


### Features

* **system-components/holmes:** link issues to their Slack thread and label by severity ([#992](https://github.com/panicboat/monorepo/issues/992)) ([6454918](https://github.com/panicboat/monorepo/commit/6454918c2a2817e5ddbaceb678657c145a32c06e))

## [0.5.0](https://github.com/panicboat/monorepo/compare/holmes-v0.4.0...holmes-v0.5.0) (2026-08-16)


### Features

* **system-components/holmes:** create GitHub issues from natural-language Slack requests ([#984](https://github.com/panicboat/monorepo/issues/984)) ([7bd7fec](https://github.com/panicboat/monorepo/commit/7bd7feced29ad69d7cb76667071c2e7fe5847c87))
* **system-components/holmes:** tell HolmesGPT about source investigation repos ([#972](https://github.com/panicboat/monorepo/issues/972)) ([c7883cb](https://github.com/panicboat/monorepo/commit/c7883cbbec62e89e41b8423d27764900c082c5e8))
