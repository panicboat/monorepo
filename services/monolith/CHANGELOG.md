# Changelog

## [0.3.0](https://github.com/panicboat/monorepo/compare/monolith-v0.2.1...monolith-v0.3.0) (2026-07-02)


### Features

* **account-durability:** self deactivation + 30-day grace + cron hard-delete ([#766](https://github.com/panicboat/monorepo/issues/766)) ([0133c03](https://github.com/panicboat/monorepo/commit/0133c038ff53b035d85fffb87263b6e55fd8cae6))
* **bookmarks:** proto + monolith slice (schema + repo + use_cases + handler, B1) ([#701](https://github.com/panicboat/monorepo/issues/701)) ([f5eb626](https://github.com/panicboat/monorepo/commit/f5eb6265a5faa0a538a723d1a9fea37288c0d9d7))
* **discovery:** proto + monolith slice (3 RPC + cross-slice search/rank, D1) ([#708](https://github.com/panicboat/monorepo/issues/708)) ([d7c43d4](https://github.com/panicboat/monorepo/commit/d7c43d45a85a1a51ad54309282824e2dcec0ceed))
* **discovery:** role filter for SearchUsers (全て/キャスト/ゲスト chips) ([#734](https://github.com/panicboat/monorepo/issues/734)) ([1adcf9f](https://github.com/panicboat/monorepo/commit/1adcf9f64ab0bb4246fa905bc54857dff3177440))
* **discovery:** suggested-users (おすすめユーザー) pane — Phase 1b-B PR2 ([#753](https://github.com/panicboat/monorepo/issues/753)) ([e4cf6f2](https://github.com/panicboat/monorepo/commit/e4cf6f290e60dd95f4482cac8c1035eea40a7706))
* **feed:** symmetric ListFeed handler + use_case + adapter methods ([#663](https://github.com/panicboat/monorepo/issues/663)) ([3fdef23](https://github.com/panicboat/monorepo/commit/3fdef236c58a459f1fcf70630c60fa1b71f8121d))
* **feed:** symmetric ListFeed proto contract + slice design spec ([#660](https://github.com/panicboat/monorepo/issues/660)) ([eebfd8a](https://github.com/panicboat/monorepo/commit/eebfd8aa0866b0b440bc905e3e7cd664abfb90e5))
* **footprints:** F1 monolith — proto + slice + use_cases + handler ([#728](https://github.com/panicboat/monorepo/issues/728)) ([bc3b9d1](https://github.com/panicboat/monorepo/commit/bc3b9d113ec41fc572f28216033a808b3bbf938b))
* **footprints:** visit count per visitor ([#754](https://github.com/panicboat/monorepo/issues/754)) ([67b0818](https://github.com/panicboat/monorepo/commit/67b0818dabc270232f2987417566aef9fe86ee00))
* **footprints:** visitor opt-out via notifications.preferences ([#742](https://github.com/panicboat/monorepo/issues/742)) ([645ab2f](https://github.com/panicboat/monorepo/commit/645ab2f4c1b79700414f1c628eae29feeda87777))
* **identity:** Account rename + RS256 JWT + frontend stub follow-up ([#649](https://github.com/panicboat/monorepo/issues/649)) ([00215b9](https://github.com/panicboat/monorepo/commit/00215b990289208cba3cdd5a046207b4b5077907))
* **identity:** auth hardening (single-use tokens, lockout, refresh digest, BFF cookies) ([#763](https://github.com/panicboat/monorepo/issues/763)) ([74b37e6](https://github.com/panicboat/monorepo/commit/74b37e681d4f8ff0b37baf022b3f0f28045a198f))
* **identity:** auth/onboarding rebuild — login/signup/onboarding/reset + AWS SNS SMS ([#761](https://github.com/panicboat/monorepo/issues/761)) ([3f6ba37](https://github.com/panicboat/monorepo/commit/3f6ba37537793350fb0306ce64c86f4681c8ac80))
* **karte:** Cast-only Guest review + trust slice destroy ([#765](https://github.com/panicboat/monorepo/issues/765)) ([7f5b75b](https://github.com/panicboat/monorepo/commit/7f5b75b211a1aa12a29e28826aec4f969d32ac88))
* **messaging:** proto + monolith slice (schema + repo + 7 unary use_cases + handler + NOTIFY publish, M1) ([#711](https://github.com/panicboat/monorepo/issues/711)) ([43485b3](https://github.com/panicboat/monorepo/commit/43485b39c57a099f4759020eb4bd9862ebda0ed2))
* **messaging:** StreamEvents server-streaming (PG LISTEN/NOTIFY subscriber, M2) ([#712](https://github.com/panicboat/monorepo/issues/712)) ([6d8f6c3](https://github.com/panicboat/monorepo/commit/6d8f6c3ec47c3fde6f8c7a0ef1db988fe80f3738))
* **notifications:** add MarkAllRead RPC and /notifications page button ([#740](https://github.com/panicboat/monorepo/issues/740)) ([1cb4928](https://github.com/panicboat/monorepo/commit/1cb4928e5b893235f6a807406551b5591f5bf838))
* **notifications:** add per-account notification preferences (settings 通知設定 tab) ([#738](https://github.com/panicboat/monorepo/issues/738)) ([aca8852](https://github.com/panicboat/monorepo/commit/aca88522805eb3db70decb342af2ded37d8c6570))
* **notifications:** add target_post_id for COMMENT/REPLY deep-link ([#741](https://github.com/panicboat/monorepo/issues/741)) ([3f71081](https://github.com/panicboat/monorepo/commit/3f710811dc837d56feb829590e63043ddeb643c0))
* **notifications:** cross-slice emit hooks (like/comment/reply/follow_request/follow_approved) ([#694](https://github.com/panicboat/monorepo/issues/694)) ([200f6e6](https://github.com/panicboat/monorepo/commit/200f6e6a2d73eba86fc2676864e53ced3cf5bc99))
* **notifications:** gate emit and drawer badge by notification preferences ([#739](https://github.com/panicboat/monorepo/issues/739)) ([b8c23c2](https://github.com/panicboat/monorepo/commit/b8c23c24d8124cdb87db4b00df84ec11ad153293))
* **notifications:** proto + monolith slice scaffold (N1) ([#692](https://github.com/panicboat/monorepo/issues/692)) ([8240d5e](https://github.com/panicboat/monorepo/commit/8240d5e52dd1606b8db4801fe8a3bee64cb076b0))
* **notifications:** use_cases + grpc handler (3 RPC live, N2) ([#693](https://github.com/panicboat/monorepo/issues/693)) ([a3c60a3](https://github.com/panicboat/monorepo/commit/a3c60a3316d0d5879d1ea23b7a1c3636d8f66590))
* **post:** add ListPostsByIds use_case for cross-slice hydration ([#661](https://github.com/panicboat/monorepo/issues/661)) ([c8ea518](https://github.com/panicboat/monorepo/commit/c8ea518c98d70c46c46cdf8d20973a905ea7ea24))
* **post:** proto + repo + use_cases for profile content tabs (media_only + ListCommentsByAuthor + ListLikedPostsByAccount, P1) ([#719](https://github.com/panicboat/monorepo/issues/719)) ([b85de1d](https://github.com/panicboat/monorepo/commit/b85de1d2c6cb2fe6d3f5c3786b7124638e7c7669))
* **posts:** symmetric posts backend — proto/schema/PostService/LikeService ([#652](https://github.com/panicboat/monorepo/issues/652)) ([12bc787](https://github.com/panicboat/monorepo/commit/12bc787d9e0584a2e3aa701c2763dbd8f3d40652))
* **post:** symmetric comment author resolution via ProfileService ([#655](https://github.com/panicboat/monorepo/issues/655)) ([a29378a](https://github.com/panicboat/monorepo/commit/a29378a1b686ca281359f66d5b8d5e9ab006b4e0))
* **post:** symmetric comment list author resolution via ProfileService ([#656](https://github.com/panicboat/monorepo/issues/656)) ([c493592](https://github.com/panicboat/monorepo/commit/c49359283042773b4edb86ca9e9f218439109782))
* **profile:** add ListAccountIdsByPrefecture use_case for cross-slice feed query ([#662](https://github.com/panicboat/monorepo/issues/662)) ([eae2061](https://github.com/panicboat/monorepo/commit/eae20610e5a104a28e802c1ac0d95965659b193f))
* **profile:** rebuild profile as full vertical slice (proto/monolith/frontend) ([#651](https://github.com/panicboat/monorepo/issues/651)) ([cda4c85](https://github.com/panicboat/monorepo/commit/cda4c85fd84f446df0d8f41c8d9f5d94ba97b697))
* **social:** cross-slice follow-gate (ViewerCanSeePost + FilterVisiblePosts) ([#679](https://github.com/panicboat/monorepo/issues/679)) ([5567668](https://github.com/panicboat/monorepo/commit/55676687c9dda1ef10a6f3937274479773caff76))
* **social:** follower/following count display on /u/[username] ([#689](https://github.com/panicboat/monorepo/issues/689)) ([11324ba](https://github.com/panicboat/monorepo/commit/11324ba9d747b78cdb700063fcdd6d97afe686e1))
* **social:** schema migration + slice base + relations + repositories ([#677](https://github.com/panicboat/monorepo/issues/677)) ([8826a14](https://github.com/panicboat/monorepo/commit/8826a14263bb2ab34e64402ac5631b3ff55c583a))
* **social:** symmetric Follow/Block proto contract + design spec ([#676](https://github.com/panicboat/monorepo/issues/676)) ([4baac9b](https://github.com/panicboat/monorepo/commit/4baac9b52f2bbb6aecf1d09fe76b8900393e3bae))
* **social:** use_cases + grpc handlers (14 RPC live) ([#678](https://github.com/panicboat/monorepo/issues/678)) ([69c9b7e](https://github.com/panicboat/monorepo/commit/69c9b7ed72385a1c71cc660cbd94a4fa454a1f6c))


### Bug Fixes

* **discovery:** present profiles through ProfilePresenter before proto assign ([#770](https://github.com/panicboat/monorepo/issues/770)) ([1615b90](https://github.com/panicboat/monorepo/commit/1615b90fad30568986c059b38bac28b28d92eaa2))
* **identity:** distinguish ACCOUNT_LOCKED from invalid credentials ([#768](https://github.com/panicboat/monorepo/issues/768)) ([d30b5c8](https://github.com/panicboat/monorepo/commit/d30b5c8f4b5ca57cf52625105d554fd7faad2001))
* **karte:** aggregate() must strip the relation's default ORDER BY ([#769](https://github.com/panicboat/monorepo/issues/769)) ([53fcd7c](https://github.com/panicboat/monorepo/commit/53fcd7ce8235ab7445f25649f0250272bbd7d526))
* **post:** qualify PostPresenter in ListPostsByIds (feed crashes) ([#722](https://github.com/panicboat/monorepo/issues/722)) ([59c92bd](https://github.com/panicboat/monorepo/commit/59c92bd36e5b66537cf9b96fe090a7087a3f7903))
* **post:** resolve Concerns::CursorPagination via top-level path to avoid Post::Concerns collision ([#697](https://github.com/panicboat/monorepo/issues/697)) ([5e145e8](https://github.com/panicboat/monorepo/commit/5e145e81898be914ff2d8620bbbc056c3c08d3de))
* **social:** present profiles through ProfilePresenter before proto assign ([#791](https://github.com/panicboat/monorepo/issues/791)) ([54a0e9c](https://github.com/panicboat/monorepo/commit/54a0e9cd195d09c3aad2b4ec4b4c91525579d236))
* **social:** present profiles through ProfilePresenter for singular fields ([#801](https://github.com/panicboat/monorepo/issues/801)) ([8d166d6](https://github.com/panicboat/monorepo/commit/8d166d64252b61659fd34ff5a64513330cfcfe15))
* **social:** use repo transaction in BlockRepository#block ([#731](https://github.com/panicboat/monorepo/issues/731)) ([a846c12](https://github.com/panicboat/monorepo/commit/a846c12f30a3f103c418f9229e37b8a21dda33af))

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
