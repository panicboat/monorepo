# Changelog

## [0.3.0](https://github.com/panicboat/monorepo/compare/frontend-v0.2.1...frontend-v0.3.0) (2026-07-23)


### Features

* **account-durability:** self deactivation + 30-day grace + cron hard-delete ([#766](https://github.com/panicboat/monorepo/issues/766)) ([0133c03](https://github.com/panicboat/monorepo/commit/0133c038ff53b035d85fffb87263b6e55fd8cae6))
* **bookmarks:** frontend full vertical (types + hooks + BFFs + PostCard + /bookmarks page, B2) ([#702](https://github.com/panicboat/monorepo/issues/702)) ([ffa71aa](https://github.com/panicboat/monorepo/commit/ffa71aaea5d798dd8c2848ff66bc8685a6b181fc))
* **bookmarks:** proto + monolith slice (schema + repo + use_cases + handler, B1) ([#701](https://github.com/panicboat/monorepo/issues/701)) ([f5eb626](https://github.com/panicboat/monorepo/commit/f5eb6265a5faa0a538a723d1a9fea37288c0d9d7))
* **discovery:** frontend full vertical (types + hooks + BFFs + /search + /ranking, D2) ([#709](https://github.com/panicboat/monorepo/issues/709)) ([fe1056b](https://github.com/panicboat/monorepo/commit/fe1056bed2f427e5c214759f809fae4977529d98))
* **discovery:** proto + monolith slice (3 RPC + cross-slice search/rank, D1) ([#708](https://github.com/panicboat/monorepo/issues/708)) ([d7c43d4](https://github.com/panicboat/monorepo/commit/d7c43d45a85a1a51ad54309282824e2dcec0ceed))
* **discovery:** role filter for SearchUsers (全て/キャスト/ゲスト chips) ([#734](https://github.com/panicboat/monorepo/issues/734)) ([1adcf9f](https://github.com/panicboat/monorepo/commit/1adcf9f64ab0bb4246fa905bc54857dff3177440))
* **discovery:** suggested-users (おすすめユーザー) pane — Phase 1b-B PR2 ([#753](https://github.com/panicboat/monorepo/issues/753)) ([e4cf6f2](https://github.com/panicboat/monorepo/commit/e4cf6f290e60dd95f4482cac8c1035eea40a7706))
* **feed:** add symmetric feed frontend data layer (BFF + hook) ([#664](https://github.com/panicboat/monorepo/issues/664)) ([eb49753](https://github.com/panicboat/monorepo/commit/eb497533b4529c91cecb069272086d9e34576caf))
* **feed:** symmetric feed home (3-tab) + /dev/ui mock ([#665](https://github.com/panicboat/monorepo/issues/665)) ([bc3ed63](https://github.com/panicboat/monorepo/commit/bc3ed635a5177daaded41c5b1a6e6e6159c73042))
* **feed:** symmetric ListFeed proto contract + slice design spec ([#660](https://github.com/panicboat/monorepo/issues/660)) ([eebfd8a](https://github.com/panicboat/monorepo/commit/eebfd8aa0866b0b440bc905e3e7cd664abfb90e5))
* **footprints:** F1 monolith — proto + slice + use_cases + handler ([#728](https://github.com/panicboat/monorepo/issues/728)) ([bc3b9d1](https://github.com/panicboat/monorepo/commit/bc3b9d113ec41fc572f28216033a808b3bbf938b))
* **footprints:** F2 frontend data — 4 hooks + 4 BFFs + grpc client ([#729](https://github.com/panicboat/monorepo/issues/729)) ([b02ad36](https://github.com/panicboat/monorepo/commit/b02ad36948dc47376541db54c8144d23b1b8c4b6))
* **footprints:** F3 frontend UI — page + visit trigger + drawer badge ([#730](https://github.com/panicboat/monorepo/issues/730)) ([249fd6b](https://github.com/panicboat/monorepo/commit/249fd6b9c86589ed758b2b3c27250ed496093681))
* **footprints:** visit count per visitor ([#754](https://github.com/panicboat/monorepo/issues/754)) ([67b0818](https://github.com/panicboat/monorepo/commit/67b0818dabc270232f2987417566aef9fe86ee00))
* **footprints:** visitor opt-out via notifications.preferences ([#742](https://github.com/panicboat/monorepo/issues/742)) ([645ab2f](https://github.com/panicboat/monorepo/commit/645ab2f4c1b79700414f1c628eae29feeda87777))
* **frontend:** add horizontal oshi row of following accounts above home feed ([#725](https://github.com/panicboat/monorepo/issues/725)) ([4548e37](https://github.com/panicboat/monorepo/commit/4548e3767d2f8fc501b38a14a25f059af38be1ee))
* **frontend:** add notification bell to top header ([#726](https://github.com/panicboat/monorepo/issues/726)) ([3348fb2](https://github.com/panicboat/monorepo/commit/3348fb26fd8b8aac689f82b5c2b440de3e69a253))
* **frontend:** desktop left nav sidebar (Phase 1b-B PR1) ([#752](https://github.com/panicboat/monorepo/issues/752)) ([be5c7c4](https://github.com/panicboat/monorepo/commit/be5c7c4054d0469e683c625ebdd87736a3caab5d))
* **frontend:** drop placeholder header text and rename feed tab to 全国 ([#724](https://github.com/panicboat/monorepo/issues/724)) ([20bf4bd](https://github.com/panicboat/monorepo/commit/20bf4bd5e57b3b7adeb726fe73a76c76990f0cd9))
* **frontend:** dystopia.city brand mark in shell ([#757](https://github.com/panicboat/monorepo/issues/757)) ([6dbef38](https://github.com/panicboat/monorepo/commit/6dbef386234b363b1024c499b48a59c98e8fd60f))
* **frontend:** introduce rx-sns design tokens and Noto Sans JP (Phase 0) ([bd67c61](https://github.com/panicboat/monorepo/commit/bd67c61667bfbd4b1d94dbb062e4c341792e53cf))
* **frontend:** mount profile content tabs on /profile own page ([#723](https://github.com/panicboat/monorepo/issues/723)) ([889c509](https://github.com/panicboat/monorepo/commit/889c5097f9284077a32b763b818785796749d0f1))
* **frontend:** Phase 1a presentation demolition + component vocabulary ([#647](https://github.com/panicboat/monorepo/issues/647)) ([d06e1c4](https://github.com/panicboat/monorepo/commit/d06e1c4db6bcb64313d3a8499b0ed4ffdeeb2dfe))
* **frontend:** profile content tabs UI (posts/replies/media/likes) ([#721](https://github.com/panicboat/monorepo/issues/721)) ([f044d3d](https://github.com/panicboat/monorepo/commit/f044d3d7048ae68a37322317119f98113330d723))
* **frontend:** profile tabs data layer (media filter, comments-by-author, liked-by) ([#720](https://github.com/panicboat/monorepo/issues/720)) ([9eea9d5](https://github.com/panicboat/monorepo/commit/9eea9d54b33ad06b4f21d6cd1ee57b43280d53f2))
* **frontend:** theme switcher — light mode + Settings 外観 tab ([#101](https://github.com/panicboat/monorepo/issues/101)) ([#758](https://github.com/panicboat/monorepo/issues/758)) ([0a72fdf](https://github.com/panicboat/monorepo/commit/0a72fdfcac2b6ee2e26f096955b16e489d7f262e))
* **identity:** Account rename + RS256 JWT + frontend stub follow-up ([#649](https://github.com/panicboat/monorepo/issues/649)) ([00215b9](https://github.com/panicboat/monorepo/commit/00215b990289208cba3cdd5a046207b4b5077907))
* **identity:** auth hardening (single-use tokens, lockout, refresh digest, BFF cookies) ([#763](https://github.com/panicboat/monorepo/issues/763)) ([74b37e6](https://github.com/panicboat/monorepo/commit/74b37e681d4f8ff0b37baf022b3f0f28045a198f))
* **identity:** auth/onboarding rebuild — login/signup/onboarding/reset + AWS SNS SMS ([#761](https://github.com/panicboat/monorepo/issues/761)) ([3f6ba37](https://github.com/panicboat/monorepo/commit/3f6ba37537793350fb0306ce64c86f4681c8ac80))
* **karte:** Cast-only Guest review + trust slice destroy ([#765](https://github.com/panicboat/monorepo/issues/765)) ([7f5b75b](https://github.com/panicboat/monorepo/commit/7f5b75b211a1aa12a29e28826aec4f969d32ac88))
* **messaging:** frontend data + SSE bridge (types + hooks + 8 BFFs + Provider, M3) ([#713](https://github.com/panicboat/monorepo/issues/713)) ([a89d866](https://github.com/panicboat/monorepo/commit/a89d8668aeb4dcddbf45a438bfcadedf560b7054))
* **messaging:** frontend UI (/messages inbox + /messages/[id] chat + composer + typing + badges, M4) ([#714](https://github.com/panicboat/monorepo/issues/714)) ([4d43e14](https://github.com/panicboat/monorepo/commit/4d43e14dd65f4036b86ebb856df328a4784acbe4))
* **messaging:** proto + monolith slice (schema + repo + 7 unary use_cases + handler + NOTIFY publish, M1) ([#711](https://github.com/panicboat/monorepo/issues/711)) ([43485b3](https://github.com/panicboat/monorepo/commit/43485b39c57a099f4759020eb4bd9862ebda0ed2))
* **messaging:** StartChatButton on /u/[username] (GetOrCreateThread + navigate) ([#715](https://github.com/panicboat/monorepo/issues/715)) ([b8ba4fa](https://github.com/panicboat/monorepo/commit/b8ba4fad74122be02cd0e7174ebf9ffd7cb9574d))
* **notifications:** add MarkAllRead RPC and /notifications page button ([#740](https://github.com/panicboat/monorepo/issues/740)) ([1cb4928](https://github.com/panicboat/monorepo/commit/1cb4928e5b893235f6a807406551b5591f5bf838))
* **notifications:** add per-account notification preferences (settings 通知設定 tab) ([#738](https://github.com/panicboat/monorepo/issues/738)) ([aca8852](https://github.com/panicboat/monorepo/commit/aca88522805eb3db70decb342af2ded37d8c6570))
* **notifications:** add target_post_id for COMMENT/REPLY deep-link ([#741](https://github.com/panicboat/monorepo/issues/741)) ([3f71081](https://github.com/panicboat/monorepo/commit/3f710811dc837d56feb829590e63043ddeb643c0))
* **notifications:** frontend data layer (types + hooks + BFFs, N4) ([#695](https://github.com/panicboat/monorepo/issues/695)) ([3b61558](https://github.com/panicboat/monorepo/commit/3b615588b18439a5ba5387bfe518408b3a69b394))
* **notifications:** frontend UI (NotificationBell + /notifications + /dev/ui mock, N5) ([#696](https://github.com/panicboat/monorepo/issues/696)) ([abbf212](https://github.com/panicboat/monorepo/commit/abbf212e2861f79d83217ec9af51c2c690ecff6c))
* **notifications:** gate emit and drawer badge by notification preferences ([#739](https://github.com/panicboat/monorepo/issues/739)) ([b8c23c2](https://github.com/panicboat/monorepo/commit/b8c23c24d8124cdb87db4b00df84ec11ad153293))
* **notifications:** proto + monolith slice scaffold (N1) ([#692](https://github.com/panicboat/monorepo/issues/692)) ([8240d5e](https://github.com/panicboat/monorepo/commit/8240d5e52dd1606b8db4801fe8a3bee64cb076b0))
* **notifications:** tap-through navigation to target resource ([#736](https://github.com/panicboat/monorepo/issues/736)) ([d07346e](https://github.com/panicboat/monorepo/commit/d07346e753ee93e753a28c2ab6cff14dc1a432ae))
* **post:** add comment reply composer with parent_id ([#735](https://github.com/panicboat/monorepo/issues/735)) ([91a3712](https://github.com/panicboat/monorepo/commit/91a371242f69ba44d42a03a9da1b28d4df0f0a09))
* **post:** comment composer on /posts/[id] (add via AddComment RPC) ([#705](https://github.com/panicboat/monorepo/issues/705)) ([0d6c288](https://github.com/panicboat/monorepo/commit/0d6c288388a56f15a8fbefb3b93d9841b20c8134))
* **post:** comment delete + replies expansion on /posts/[id] ([#706](https://github.com/panicboat/monorepo/issues/706)) ([03175af](https://github.com/panicboat/monorepo/commit/03175af9d4f5b8fd6efd8d9fba0e7569fac6eba0))
* **post:** comment list on /posts/[id] (P5 deferred resolved) ([#704](https://github.com/panicboat/monorepo/issues/704)) ([b1f124d](https://github.com/panicboat/monorepo/commit/b1f124d7881d936b84f059f991a67ae7aef7b413))
* **post:** composer modal wired to FAB (savePost + SWR refresh) ([#703](https://github.com/panicboat/monorepo/issues/703)) ([6cd596f](https://github.com/panicboat/monorepo/commit/6cd596f48732e7029201d0e43174c8c7db4815b6))
* **post:** proto + repo + use_cases for profile content tabs (media_only + ListCommentsByAuthor + ListLikedPostsByAccount, P1) ([#719](https://github.com/panicboat/monorepo/issues/719)) ([b85de1d](https://github.com/panicboat/monorepo/commit/b85de1d2c6cb2fe6d3f5c3786b7124638e7c7669))
* **posts:** symmetric posts backend — proto/schema/PostService/LikeService ([#652](https://github.com/panicboat/monorepo/issues/652)) ([12bc787](https://github.com/panicboat/monorepo/commit/12bc787d9e0584a2e3aa701c2763dbd8f3d40652))
* **posts:** symmetric posts frontend (Q4: data layer + UI) ([#653](https://github.com/panicboat/monorepo/issues/653)) ([069c99e](https://github.com/panicboat/monorepo/commit/069c99e539f2a695741a85d7b38f5fd71945496e))
* **profile:** rebuild profile as full vertical slice (proto/monolith/frontend) ([#651](https://github.com/panicboat/monorepo/issues/651)) ([cda4c85](https://github.com/panicboat/monorepo/commit/cda4c85fd84f446df0d8f41c8d9f5d94ba97b697))
* **shell:** Phase 1b-A app shell (TopBar + BottomTab + Drawer + FAB + 5 stubs) ([#699](https://github.com/panicboat/monorepo/issues/699)) ([276db9e](https://github.com/panicboat/monorepo/commit/276db9ea452f43452885e825f9f1da23faf05223))
* **social:** /oshi cursor pagination (load-more button) ([#688](https://github.com/panicboat/monorepo/issues/688)) ([14f610f](https://github.com/panicboat/monorepo/commit/14f610f3cc35cef615b00fca79db7b0f3ad39320))
* **social:** block UI (BlockButton + /settings/blocks + dev/ui mock) ([#687](https://github.com/panicboat/monorepo/issues/687)) ([693326e](https://github.com/panicboat/monorepo/commit/693326e3718d59f4751e3b3a4084eb8183bc5009))
* **social:** follower/following count display on /u/[username] ([#689](https://github.com/panicboat/monorepo/issues/689)) ([11324ba](https://github.com/panicboat/monorepo/commit/11324ba9d747b78cdb700063fcdd6d97afe686e1))
* **social:** frontend data layer (types + hooks + BFFs) ([#680](https://github.com/panicboat/monorepo/issues/680)) ([65428d5](https://github.com/panicboat/monorepo/commit/65428d5cb08fafff292451ec0336e57e4a0e9864))
* **social:** frontend UI (FollowButton + /oshi + follow-requests + dev/ui mock) ([#681](https://github.com/panicboat/monorepo/issues/681)) ([b6b731f](https://github.com/panicboat/monorepo/commit/b6b731f5dce5526a7c60d10237f5307d31cd2004))
* **social:** symmetric Follow/Block proto contract + design spec ([#676](https://github.com/panicboat/monorepo/issues/676)) ([4baac9b](https://github.com/panicboat/monorepo/commit/4baac9b52f2bbb6aecf1d09fe76b8900393e3bae))
* **ui:** visual polish tier 1 (bg-bg-secondary token + Drawer animation + search clear button) ([#716](https://github.com/panicboat/monorepo/issues/716)) ([5c4ccda](https://github.com/panicboat/monorepo/commit/5c4ccdaecbd3e485db3ba17a35122932c11729d4))
* **ui:** visual polish tier 2 (role badge + 登録日 + drawer profile link to /u/[me]) ([#717](https://github.com/panicboat/monorepo/issues/717)) ([89bb51d](https://github.com/panicboat/monorepo/commit/89bb51ddd31a646a0e39fde935e37647c317282a))


### Bug Fixes

* **frontend:** deadline every BFF -&gt; monolith and client fetch call ([#807](https://github.com/panicboat/monorepo/issues/807)) ([be7ff66](https://github.com/panicboat/monorepo/commit/be7ff667d9f1e14510a3620ecebee5a9ceaee5e2))
* **identity:** distinguish ACCOUNT_LOCKED from invalid credentials ([#768](https://github.com/panicboat/monorepo/issues/768)) ([d30b5c8](https://github.com/panicboat/monorepo/commit/d30b5c8f4b5ca57cf52625105d554fd7faad2001))
* **messaging:** swap SSE for polling to end the home-feed connection wedge ([#814](https://github.com/panicboat/monorepo/issues/814)) ([31e881a](https://github.com/panicboat/monorepo/commit/31e881a64769fdb773bb1fec296d21b341a91568))
* **services/frontend/workspace:** update dependency @bufbuild/protobuf to ^2.12.1 ([#809](https://github.com/panicboat/monorepo/issues/809)) ([80dfdfb](https://github.com/panicboat/monorepo/commit/80dfdfb252403e57d729fbbe443834e620bc6c5a))
* **services/frontend/workspace:** update dependency @connectrpc/connect to ^2.1.2 ([#810](https://github.com/panicboat/monorepo/issues/810)) ([ae57031](https://github.com/panicboat/monorepo/commit/ae570319cce10faf87dfba40126e68dc35f294cc))
* **services/frontend/workspace:** update dependency @connectrpc/connect-node to ^2.1.2 ([#811](https://github.com/panicboat/monorepo/issues/811)) ([91530b8](https://github.com/panicboat/monorepo/commit/91530b8ab03e4b8f5d298debd606b34347fba8c9))
* **services/frontend/workspace:** update dependency @radix-ui/react-dialog to ^1.1.18 ([#812](https://github.com/panicboat/monorepo/issues/812)) ([74c488e](https://github.com/panicboat/monorepo/commit/74c488ed592812311d39dede51640f7902883879))
* **services/frontend/workspace:** update dependency @radix-ui/react-dialog to ^1.1.19 ([#825](https://github.com/panicboat/monorepo/issues/825)) ([c20a828](https://github.com/panicboat/monorepo/commit/c20a828122a1671da8dbfd24dc6ba683e713680e))
* **services/frontend/workspace:** update dependency @radix-ui/react-dialog to ^1.1.20 ([#845](https://github.com/panicboat/monorepo/issues/845)) ([9bed22e](https://github.com/panicboat/monorepo/commit/9bed22ecd824477af3e851840380765de783520b))
* **services/frontend/workspace:** update dependency @radix-ui/react-dropdown-menu to ^2.1.19 ([#816](https://github.com/panicboat/monorepo/issues/816)) ([d5406d5](https://github.com/panicboat/monorepo/commit/d5406d517552ecd6750d59f8baadb75eb451adfe))
* **services/frontend/workspace:** update dependency @radix-ui/react-dropdown-menu to ^2.1.20 ([#826](https://github.com/panicboat/monorepo/issues/826)) ([68da224](https://github.com/panicboat/monorepo/commit/68da2241df869f0082b94ddc0d9208b058216443))
* **services/frontend/workspace:** update dependency @radix-ui/react-dropdown-menu to ^2.1.21 ([#846](https://github.com/panicboat/monorepo/issues/846)) ([05f1fea](https://github.com/panicboat/monorepo/commit/05f1fea1ede0122829d05b006f83d833d05f0bf0))
* **services/frontend/workspace:** update dependency @radix-ui/react-scroll-area to ^1.2.13 ([#817](https://github.com/panicboat/monorepo/issues/817)) ([4fb3dc0](https://github.com/panicboat/monorepo/commit/4fb3dc0c90aba1a9b736821f11858f18f649f730))
* **services/frontend/workspace:** update dependency @radix-ui/react-scroll-area to ^1.2.14 ([#827](https://github.com/panicboat/monorepo/issues/827)) ([2291664](https://github.com/panicboat/monorepo/commit/22916648000edd00acb89ccf92c58d7b3b494d18))
* **services/frontend/workspace:** update dependency @radix-ui/react-scroll-area to ^1.2.15 ([#847](https://github.com/panicboat/monorepo/issues/847)) ([34f1745](https://github.com/panicboat/monorepo/commit/34f1745eb6bc9ecd6e5f875963e00b720bfa8a87))
* **services/frontend/workspace:** update dependency @radix-ui/react-separator to ^1.1.11 ([#818](https://github.com/panicboat/monorepo/issues/818)) ([126ba99](https://github.com/panicboat/monorepo/commit/126ba99ea927b343e915f222bee14dfa7e65da1e))
* **services/frontend/workspace:** update dependency @radix-ui/react-separator to ^1.1.12 ([#848](https://github.com/panicboat/monorepo/issues/848)) ([25d6caf](https://github.com/panicboat/monorepo/commit/25d6cafc7a72315e13fbaddd5ad92c88fb7ff78e))
* **services/frontend/workspace:** update dependency date-fns to ^4.4.0 ([#819](https://github.com/panicboat/monorepo/issues/819)) ([a0c8b33](https://github.com/panicboat/monorepo/commit/a0c8b337ea4ba0afdbbddee859bb4b91b1c7154d))
* **services/frontend/workspace:** update dependency next to v16.2.10 ([#820](https://github.com/panicboat/monorepo/issues/820)) ([b689e03](https://github.com/panicboat/monorepo/commit/b689e031da328b6d5199fd73a9c8de0cf50bb16f))
* **services/frontend/workspace:** update dependency next to v16.2.11 ([#852](https://github.com/panicboat/monorepo/issues/852)) ([88bae50](https://github.com/panicboat/monorepo/commit/88bae5052a452d02f979514b2556f3f4defe4f6a))
* **services/frontend/workspace:** update dependency next to v16.2.6 [security] ([#771](https://github.com/panicboat/monorepo/issues/771)) ([e497517](https://github.com/panicboat/monorepo/commit/e497517877934e8a1d1343b147f69e68b2f70f86))
* **services/frontend/workspace:** update dependency react to v19.2.7 ([#778](https://github.com/panicboat/monorepo/issues/778)) ([7206611](https://github.com/panicboat/monorepo/commit/7206611e4df09bbba4a631211c32adc04c82ccaa))
* **services/frontend/workspace:** update dependency react to v19.2.8 ([#853](https://github.com/panicboat/monorepo/issues/853)) ([433ba3b](https://github.com/panicboat/monorepo/commit/433ba3bab1937d0cf004d50069be754113de8e19))
* **services/frontend/workspace:** update dependency react-dom to v19.2.7 ([#779](https://github.com/panicboat/monorepo/issues/779)) ([e72fc39](https://github.com/panicboat/monorepo/commit/e72fc39a93ff922a2075bd68000651340bba6b3d))
* **services/frontend/workspace:** update dependency react-dom to v19.2.8 ([#854](https://github.com/panicboat/monorepo/issues/854)) ([e1a1e28](https://github.com/panicboat/monorepo/commit/e1a1e283fd75638a5e7cf0e83fb0acbcdec7796d))
* **services/frontend/workspace:** update dependency swr to ^2.4.2 ([#821](https://github.com/panicboat/monorepo/issues/821)) ([330d4a5](https://github.com/panicboat/monorepo/commit/330d4a568de9ccdb9dd430791f0ab09f7262aca5))
* **services/frontend/workspace:** update dependency tailwind-merge to ^3.6.0 ([#780](https://github.com/panicboat/monorepo/issues/780)) ([e83a643](https://github.com/panicboat/monorepo/commit/e83a64379378193dd5c0643cf58214e3caaa8f44))
* **services/frontend/workspace:** update dependency zustand to ^5.0.14 ([#822](https://github.com/panicboat/monorepo/issues/822)) ([b87f660](https://github.com/panicboat/monorepo/commit/b87f6607482c0edfd205910a4ed282a031291cc3))

## [0.2.1](https://github.com/panicboat/monorepo/compare/frontend-v0.2.0...frontend-v0.2.1) (2026-05-17)


### Bug Fixes

* **frontend:** align gRPC backend env name with code ([#633](https://github.com/panicboat/monorepo/issues/633)) ([03c72c9](https://github.com/panicboat/monorepo/commit/03c72c9b461c14008ca57fdc997b687b41eba959))

## [0.2.0](https://github.com/panicboat/monorepo/compare/frontend-v0.1.0...frontend-v0.2.0) (2026-05-17)


### Features

* **flux:** cut over production deploy to semver image tags ([#624](https://github.com/panicboat/monorepo/issues/624)) ([cd6768f](https://github.com/panicboat/monorepo/commit/cd6768f0beb5246d076cc1175e2d8fb8bc15b680))

## 0.1.0 (2026-05-16)


### Features

* bootstrap release-please path routing (monolith / frontend) ([#610](https://github.com/panicboat/monorepo/issues/610)) ([540e959](https://github.com/panicboat/monorepo/commit/540e9595f33aac339904d1bca628eec497d6d31e))
