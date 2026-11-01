# Changelog

## [0.10.0](https://github.com/panicboat/monorepo/compare/monolith-v0.9.0...monolith-v0.10.0) (2026-11-01)


### Features

* **dystopia:** hide schedules and reviews of a locked profile from viewers who do not follow ([#1870](https://github.com/panicboat/monorepo/issues/1870)) ([9b1dbd8](https://github.com/panicboat/monorepo/commit/9b1dbd8757eec82e5b4de0aee20e7b60a320aacb))
* **dystopia:** let users report content and profiles for the operator to review ([#1924](https://github.com/panicboat/monorepo/issues/1924)) ([bdffa43](https://github.com/panicboat/monorepo/commit/bdffa43702f94a384f99e52fe6bb17283fefc713))
* **dystopia:** pin a post to the top of a profile ([#1894](https://github.com/panicboat/monorepo/issues/1894)) ([b7caa26](https://github.com/panicboat/monorepo/commit/b7caa263e4e88dbd9b35acf8a5d99a99e8916850))
* **dystopia:** quote a post ([#1918](https://github.com/panicboat/monorepo/issues/1918)) ([bd2ec97](https://github.com/panicboat/monorepo/commit/bd2ec97f46a6a7fbb73106c5de85b5b968912f79))
* **dystopia:** remove the replies tab and post editing, and add deleting a post ([#1873](https://github.com/panicboat/monorepo/issues/1873)) ([48090b4](https://github.com/panicboat/monorepo/commit/48090b4281f3636d41cb6369bca56dfbb953d70f))


### Code Refactoring

* **dystopia/monolith:** create posts and comments in one transaction ([#1880](https://github.com/panicboat/monorepo/issues/1880)) ([05894f1](https://github.com/panicboat/monorepo/commit/05894f178925786a69b45f0daf0437c9c13a7e0c))
* **dystopia/monolith:** read list profiles in one query ([#1879](https://github.com/panicboat/monorepo/issues/1879)) ([d24cdbb](https://github.com/panicboat/monorepo/commit/d24cdbbc879cae862e783286598044bd8c1c07a9))


### Miscellaneous Chores

* **dystopia/monolith/infrastructure/aws/modules:** update terraform aws to v6.71.0 ([#1906](https://github.com/panicboat/monorepo/issues/1906)) ([7c06ec0](https://github.com/panicboat/monorepo/commit/7c06ec098f3b6411f135e44bac99edb999f5babf))
* **dystopia/monolith:** update dependency aws-sdk-cognitoidentityprovider to "~&gt; 1.159" ([#1904](https://github.com/panicboat/monorepo/issues/1904)) ([62998f2](https://github.com/panicboat/monorepo/commit/62998f28c5240fe1af9144afd612916798b29881))
* **dystopia/monolith:** update dependency aws-sdk-s3 to "~&gt; 1.237" ([#1905](https://github.com/panicboat/monorepo/issues/1905)) ([8246428](https://github.com/panicboat/monorepo/commit/8246428f999cd6aaf9de3139ba50de45df3360e9))
* **dystopia/monolith:** update dependency grpc-tools to v1.85.0 ([#1854](https://github.com/panicboat/monorepo/issues/1854)) ([d5dba8b](https://github.com/panicboat/monorepo/commit/d5dba8bed4d60e1b9dd095c9889c7d1c9909d78b))

## [0.9.0](https://github.com/panicboat/monorepo/compare/monolith-v0.8.0...monolith-v0.9.0) (2026-10-29)


### Features

* deploy kubernetes manifests together with service releases ([#1835](https://github.com/panicboat/monorepo/issues/1835)) ([d8fbfe2](https://github.com/panicboat/monorepo/commit/d8fbfe23c5d21d6897c5ff866865a06ce7e35940))
* **dystopia:** announce schedules with scheduled posts ([#1633](https://github.com/panicboat/monorepo/issues/1633)) ([ada7d30](https://github.com/panicboat/monorepo/commit/ada7d306468244c2cd5ec94b908878b396739559))
* **dystopia:** call schedules 予定 everywhere instead of 出勤 ([#1667](https://github.com/panicboat/monorepo/issues/1667)) ([a0f2b3c](https://github.com/panicboat/monorepo/commit/a0f2b3c9ea4c52f7c7623d5c43a01b27efaabbb5))
* **dystopia:** choose follow approval apart from the profile lock ([#1623](https://github.com/panicboat/monorepo/issues/1623)) ([bc8f76a](https://github.com/panicboat/monorepo/commit/bc8f76a1f77bdf2aa1d78af4aaae6b2a78610b8d))
* **dystopia:** choose which profiles each device receives push notifications for ([#1688](https://github.com/panicboat/monorepo/issues/1688)) ([b6e416f](https://github.com/panicboat/monorepo/commit/b6e416f3db6ad37e4232cc0451ab9c76e98a8772))
* **dystopia:** drop the legacy karte tables ([#1548](https://github.com/panicboat/monorepo/issues/1548)) ([cbb86d7](https://github.com/panicboat/monorepo/commit/cbb86d767b92dccfde1494ee43ab3758ec9e1de5))
* **dystopia:** hide cast schedules from profiles in a block relation ([#1824](https://github.com/panicboat/monorepo/issues/1824)) ([ab224ce](https://github.com/panicboat/monorepo/commit/ab224ce6ee29beaa6f52128893fcc16c1936745d))
* **dystopia:** implement [@username](https://github.com/username) mentions in posts, comments, and replies ([#1348](https://github.com/panicboat/monorepo/issues/1348)) ([6895572](https://github.com/panicboat/monorepo/commit/6895572f1fbdb57c9a7189cb9bb3581af36be535))
* **dystopia:** keep deactivated accounts for 90 days before purging ([#1702](https://github.com/panicboat/monorepo/issues/1702)) ([3bad26e](https://github.com/panicboat/monorepo/commit/3bad26e37579d44ea051d4779db14b5a762d243d))
* **dystopia:** keep reviews after a guest or a cast leaves ([#1705](https://github.com/panicboat/monorepo/issues/1705)) ([c7ef32a](https://github.com/panicboat/monorepo/commit/c7ef32a8f935eb364cff169275ef27022cace26d))
* **dystopia:** let the author edit a review or a karte entry ([#1496](https://github.com/panicboat/monorepo/issues/1496)) ([456549c](https://github.com/panicboat/monorepo/commit/456549c00e29bb9d88b3f4b683fdafe541808261))
* **dystopia:** list the posts of the viewer's followers on the home feed ([#1620](https://github.com/panicboat/monorepo/issues/1620)) ([3c5f3c6](https://github.com/panicboat/monorepo/commit/3c5f3c63f1867ff2084c0b2a690f11d1c5511462))
* **dystopia:** make the profile lock a badge only ([#1780](https://github.com/panicboat/monorepo/issues/1780)) ([679b737](https://github.com/panicboat/monorepo/commit/679b7373ce8309a08dd9ba04a068c554b3186769))
* **dystopia:** move the acting principal from the account to the profile ([#1403](https://github.com/panicboat/monorepo/issues/1403)) ([f71d417](https://github.com/panicboat/monorepo/commit/f71d417aeee6db931b5537cee129a59e9ada3731))
* **dystopia:** own karte entries by account and show the writing profile as author ([#1410](https://github.com/panicboat/monorepo/issues/1410)) ([e29abdb](https://github.com/panicboat/monorepo/commit/e29abdb9e64a63033544bd246f97965e4c69eaba))
* **dystopia:** profile lifecycle, per-profile purge and hiding of disabled profiles ([#1424](https://github.com/panicboat/monorepo/issues/1424)) ([abaed78](https://github.com/panicboat/monorepo/commit/abaed78ff5e248615d318db19588b80fa8a37324))
* **dystopia:** rebuild reviews as kuchikomi on the karte lifecycle ([#1555](https://github.com/panicboat/monorepo/issues/1555)) ([036dedd](https://github.com/panicboat/monorepo/commit/036dedd344c1a80af04eeee621dab083ead2c3fe))
* **dystopia:** rebuild the karte screens around summary cards and a detail sheet ([#1544](https://github.com/panicboat/monorepo/issues/1544)) ([6a607a0](https://github.com/panicboat/monorepo/commit/6a607a015d3cf490ff21880ca7dbfcd673b6276a))
* **dystopia:** record a karte as one booking-to-aftercare series with events ([#1542](https://github.com/panicboat/monorepo/issues/1542)) ([72f419c](https://github.com/panicboat/monorepo/commit/72f419c2fcbcbfd8357b0246d8338b83d559eef2))
* **dystopia:** record the owning account of a media file and key its object by the uploading profile ([#1443](https://github.com/panicboat/monorepo/issues/1443)) ([3008360](https://github.com/panicboat/monorepo/commit/300836072952d9c8b80b73fcf7132c741dae9002))
* **dystopia:** remove the website from profiles ([#1663](https://github.com/panicboat/monorepo/issues/1663)) ([60b8947](https://github.com/panicboat/monorepo/commit/60b8947a7b64f08311330df191a907ea1a613be0))
* **dystopia:** search schedules by main area and industry ([#1653](https://github.com/panicboat/monorepo/issues/1653)) ([1d32a74](https://github.com/panicboat/monorepo/commit/1d32a7472e3cad16fe8cd44955c0426094c2befc))
* **dystopia:** search schedules from the search screen ([#1635](https://github.com/panicboat/monorepo/issues/1635)) ([ea4a04f](https://github.com/panicboat/monorepo/commit/ea4a04f46f5b5ce4857addd4206ee2b0e6f1e664))
* **dystopia:** send notifications to devices with web push ([#1641](https://github.com/panicboat/monorepo/issues/1641)) ([935ac69](https://github.com/panicboat/monorepo/commit/935ac6973a9d914afa51cb4d4e467e1961551be2))
* **dystopia:** show followers-only posts to followers ([#1565](https://github.com/panicboat/monorepo/issues/1565)) ([7dfdf2e](https://github.com/panicboat/monorepo/commit/7dfdf2ed5ba617f7fb7fe0f9d3623ae757c56b8a))
* **dystopia:** show posts only within their display window ([#1632](https://github.com/panicboat/monorepo/issues/1632)) ([5bd8c0e](https://github.com/panicboat/monorepo/commit/5bd8c0e2c28451ba22de7a5db5e6ddb74d9ccd3c))
* **dystopia:** show the lock mark next to every profile name ([#1564](https://github.com/panicboat/monorepo/issues/1564)) ([e4b3b47](https://github.com/panicboat/monorepo/commit/e4b3b47a82c2d1d9e47d95ac16b8bfac3418aecb))
* **dystopia:** suggest followed profiles while typing a mention ([#1647](https://github.com/panicboat/monorepo/issues/1647)) ([2536985](https://github.com/panicboat/monorepo/commit/2536985680a9c761fcf4613f8ff62db95a0a47be))
* **dystopia:** turn the tags written in a post into links that find posts with the same tag ([#1501](https://github.com/panicboat/monorepo/issues/1501)) ([ff167b8](https://github.com/panicboat/monorepo/commit/ff167b8452098d534621f5b88b67e71be288d4e2))


### Bug Fixes

* **dystopia/frontend:** show the industry of a cast as an icon ([#1490](https://github.com/panicboat/monorepo/issues/1490)) ([924baae](https://github.com/panicboat/monorepo/commit/924baaea4bf7c9b24181b72a14f1825b1fedfbd0))
* **dystopia/monolith:** allow only cast accounts to save and delete schedules ([#1681](https://github.com/panicboat/monorepo/issues/1681)) ([afbe279](https://github.com/panicboat/monorepo/commit/afbe27999c077ed952f658ce4a0c8eaafff52b70))
* **dystopia/monolith:** authenticate media requests and let only the uploader delete a media file ([#1435](https://github.com/panicboat/monorepo/issues/1435)) ([49fcbc9](https://github.com/panicboat/monorepo/commit/49fcbc944f918f157ea8704118cce87f45528c1b))
* **dystopia/monolith:** count each notification actor once ([#1819](https://github.com/panicboat/monorepo/issues/1819)) ([8223480](https://github.com/panicboat/monorepo/commit/822348062c99c20d633b241f7664e7f488a98f8e))
* **dystopia/monolith:** count only listed visitors in the footprint unread count ([#1817](https://github.com/panicboat/monorepo/issues/1817)) ([8d8c5e8](https://github.com/panicboat/monorepo/commit/8d8c5e88f8c6a70cf945a5f29324e19a78ceffe5))
* **dystopia/monolith:** count unread messages and notifications only from visible senders ([#1818](https://github.com/panicboat/monorepo/issues/1818)) ([e3fe8af](https://github.com/panicboat/monorepo/commit/e3fe8aff1f116da37a636aa360f4675417c393c7))
* **dystopia/monolith:** decide has_more after dropping rows the viewer cannot see ([#1820](https://github.com/panicboat/monorepo/issues/1820)) ([908d160](https://github.com/panicboat/monorepo/commit/908d1606df7781817ea792162603f321b01f8e58))
* **dystopia/monolith:** deliver messaging stream events instead of failing on the first one ([#1430](https://github.com/panicboat/monorepo/issues/1430)) ([c5d09dd](https://github.com/panicboat/monorepo/commit/c5d09dda2f896015e6428eaeddc337afd0d41b9e))
* **dystopia/monolith:** exclude blocked profiles from post like and comment counts ([#1816](https://github.com/panicboat/monorepo/issues/1816)) ([fa216aa](https://github.com/panicboat/monorepo/commit/fa216aa1c96bc1cc1f9f82fc70e79749f60e89b5))
* **dystopia/monolith:** hide the karte list of a target others cannot see ([#1813](https://github.com/panicboat/monorepo/issues/1813)) ([973571a](https://github.com/panicboat/monorepo/commit/973571ae620dd69e163b7ba5a01622fc0a049a13))
* **dystopia/monolith:** record the request context in the gRPC access log ([#1680](https://github.com/panicboat/monorepo/issues/1680)) ([cb56575](https://github.com/panicboat/monorepo/commit/cb56575c74170f2efb7efc75ed5967f7f0cb9ecc))
* **dystopia/monolith:** reject profile lifecycle RPCs from a deactivated account ([#1815](https://github.com/panicboat/monorepo/issues/1815)) ([5fd31b2](https://github.com/panicboat/monorepo/commit/5fd31b2e48f779351de23bf38bec0a369a95c0d3))
* **dystopia/monolith:** save notification preferences on every update ([#1427](https://github.com/panicboat/monorepo/issues/1427)) ([cdc0bbb](https://github.com/panicboat/monorepo/commit/cdc0bbbe8e0ae9dad1355a4d9c61d3536e9fa4c7))
* **dystopia/monolith:** seed the follows and the block the seed summary describes ([#1432](https://github.com/panicboat/monorepo/issues/1432)) ([eda3800](https://github.com/panicboat/monorepo/commit/eda38007d8a45c3a6e74b6ea797a7753db2b55a6))
* **dystopia/monolith:** stop gruf from taking a reload lock on every request ([#1428](https://github.com/panicboat/monorepo/issues/1428)) ([eaa3906](https://github.com/panicboat/monorepo/commit/eaa39069839b15e48c82245db134b8ba82a410d1))
* **dystopia/monolith:** store the kind of a media file instead of always storing unknown ([#1450](https://github.com/panicboat/monorepo/issues/1450)) ([1180da0](https://github.com/panicboat/monorepo/commit/1180da0eb899908f9083be80747b3aca13d99d25))
* **dystopia:** allow resubscription and stop billing on deactivation and purge ([#1826](https://github.com/panicboat/monorepo/issues/1826)) ([1e3cb30](https://github.com/panicboat/monorepo/commit/1e3cb30e658f1a369fbb4f386e4f69c7dfb49f50))
* **dystopia:** answer NOT_FOUND from GetProfile for a profile that does not exist ([#1433](https://github.com/panicboat/monorepo/issues/1433)) ([cefcad8](https://github.com/panicboat/monorepo/commit/cefcad86dc7699537b6443fa1e90cd983b1f9e6c))
* **dystopia:** close gaps on the bookmark, footprint, profile and home screens ([#1793](https://github.com/panicboat/monorepo/issues/1793)) ([1a5f0a9](https://github.com/panicboat/monorepo/commit/1a5f0a9ef36d375168adb1df4eb1b53d94047cbc))
* **dystopia:** delete the Cognito user by the username that has the sub ([#1683](https://github.com/panicboat/monorepo/issues/1683)) ([df5c85c](https://github.com/panicboat/monorepo/commit/df5c85cfe1180fe46a9ae2b85e90d7ca600e96bb))
* **dystopia:** delete uploads that were never registered when purging a profile ([#1713](https://github.com/panicboat/monorepo/issues/1713)) ([0bc19a5](https://github.com/panicboat/monorepo/commit/0bc19a5d42f05947111d2fdfc1c685a57cd1591c))
* **dystopia:** derive the area feed prefecture from the viewer's profile ([#1812](https://github.com/panicboat/monorepo/issues/1812)) ([88955f2](https://github.com/panicboat/monorepo/commit/88955f29c1b83839c3158e277e3b79b995636a70))
* **dystopia:** feed and ranking errors, local dev sign-in ([#1380](https://github.com/panicboat/monorepo/issues/1380)) ([7e68c92](https://github.com/panicboat/monorepo/commit/7e68c9221bd7ccf1e5b85c137215ad1867aee4f7))
* **dystopia:** gate message button by role-based follow requirement ([#1301](https://github.com/panicboat/monorepo/issues/1301)) ([68f1563](https://github.com/panicboat/monorepo/commit/68f1563fede3044976a07e17b65682a5debc554b))
* **dystopia:** keep media whose files were not deleted, and clear attachments when a post is saved without any ([#1791](https://github.com/panicboat/monorepo/issues/1791)) ([d5b79c4](https://github.com/panicboat/monorepo/commit/d5b79c48d3b0601c81041c94d7eca67e1d00712d))
* **dystopia:** keep rows of the same second across pages and treat a malformed cursor id as the first page ([#1784](https://github.com/panicboat/monorepo/issues/1784)) ([ffec1cc](https://github.com/panicboat/monorepo/commit/ffec1ccbcbd252b7819b60e4b4157fbc814ae84e))
* **dystopia:** leave a blocked author's comments out of their replies tab ([#1787](https://github.com/panicboat/monorepo/issues/1787)) ([1661ff5](https://github.com/panicboat/monorepo/commit/1661ff586e769e4e6230dea7c66a651c5a86b6aa))
* **dystopia:** let incomplete sign-ups register again and purge them after a day ([#1825](https://github.com/panicboat/monorepo/issues/1825)) ([8f748ad](https://github.com/panicboat/monorepo/commit/8f748ad000ee7ea8f055eb01e6544faba63a0512))
* **dystopia:** let karte and review authors delete events in any state ([#1584](https://github.com/panicboat/monorepo/issues/1584)) ([00c4f51](https://github.com/panicboat/monorepo/commit/00c4f51f73002baebe6355b2abf37a6b7f54c964))
* **dystopia:** match % and _ in search terms literally ([#1786](https://github.com/panicboat/monorepo/issues/1786)) ([61e4133](https://github.com/panicboat/monorepo/commit/61e4133c5784cadc30d42a41693255627ca6a5c8))
* **dystopia:** narrow schedule search by the hours worked ([#1636](https://github.com/panicboat/monorepo/issues/1636)) ([2f78aec](https://github.com/panicboat/monorepo/commit/2f78aec2c4f893bfca4530798f550c42a45e5668))
* **dystopia:** page the ranking by likes and keep hidden posts out of its cursor ([#1785](https://github.com/panicboat/monorepo/issues/1785)) ([4a28061](https://github.com/panicboat/monorepo/commit/4a28061ee05f88eacdd0d94bed4a1749286eadcd))
* **dystopia:** purge deactivated accounts every day and delete their uploaded files ([#1685](https://github.com/panicboat/monorepo/issues/1685)) ([cbfaf22](https://github.com/panicboat/monorepo/commit/cbfaf22f480a3ffdd3654a262545d0517819d63c))
* **dystopia:** rank only posts that someone has liked ([#1638](https://github.com/panicboat/monorepo/issues/1638)) ([17b565d](https://github.com/panicboat/monorepo/commit/17b565d9173bbb316fbbec3d2300e9bb67f384e3))
* **dystopia:** read follow requests, blocked accounts and threads past the first page ([#1792](https://github.com/panicboat/monorepo/issues/1792)) ([ce48371](https://github.com/panicboat/monorepo/commit/ce48371d0d605c2d2bde3ddcc72c2237fd546e81))
* **dystopia:** refresh an open conversation by polling and remove the event stream ([#1441](https://github.com/panicboat/monorepo/issues/1441)) ([7b9417a](https://github.com/panicboat/monorepo/commit/7b9417accc5f5682a4cc0ae38418da45d9904e33))
* **dystopia:** refuse self follows and self blocks, and keep approved follows out of reject and cancel ([#1788](https://github.com/panicboat/monorepo/issues/1788)) ([41b4ea6](https://github.com/panicboat/monorepo/commit/41b4ea64933f267842da476274c6e70b08cb4ae4))
* **dystopia:** replace the LINE sns link with lit.link ([#1700](https://github.com/panicboat/monorepo/issues/1700)) ([46ac558](https://github.com/panicboat/monorepo/commit/46ac5583e01975324f4b0a71a192237713a8b7c4))
* **dystopia:** seed accounts that own a second profile and make the README seed steps match the schema ([#1451](https://github.com/panicboat/monorepo/issues/1451)) ([09db2a8](https://github.com/panicboat/monorepo/commit/09db2a8d0c276693dc8d82b6fd36c20dd542e823))
* **dystopia:** serve media only through what it is attached to ([#1781](https://github.com/panicboat/monorepo/issues/1781)) ([11b0304](https://github.com/panicboat/monorepo/commit/11b0304bb91b229177d13be50050f56ce4eddbc3))
* **dystopia:** show the author's own followers-only posts on the home feed ([#1566](https://github.com/panicboat/monorepo/issues/1566)) ([2a4fc90](https://github.com/panicboat/monorepo/commit/2a4fc904b827417ff1ec93a53d5b57e959b247fb))
* **dystopia:** show who a conversation is with and say why a reply cannot be sent ([#1493](https://github.com/panicboat/monorepo/issues/1493)) ([79269bc](https://github.com/panicboat/monorepo/commit/79269bcf71f54df3d722783db0ef4a68af6cb8d6))
* **dystopia:** treat Unicode whitespace as blank input ([#1814](https://github.com/panicboat/monorepo/issues/1814)) ([9100843](https://github.com/panicboat/monorepo/commit/9100843aa53966ca61429d96ee2a0b37ab367235))
* **dystopia:** validate post visibility, upload content types, read positions and schedule dates in the API ([#1789](https://github.com/panicboat/monorepo/issues/1789)) ([6d9a28d](https://github.com/panicboat/monorepo/commit/6d9a28d4fa1090bcb45624a936d608ecc23feeb1))


### Performance Improvements

* **dystopia:** shrink post photos with a thumbnail and keep media URLs stable ([#1622](https://github.com/panicboat/monorepo/issues/1622)) ([d5c030d](https://github.com/panicboat/monorepo/commit/d5c030da51ddb13ec84b0679d2303366a666a39c))


### Code Refactoring

* derive terragrunt state keys from the unit path ([#1828](https://github.com/panicboat/monorepo/issues/1828)) ([f6784b6](https://github.com/panicboat/monorepo/commit/f6784b69368dd3d7f049168604933a1e2569f2eb))
* **dystopia/monolith:** drop the push_enabled column ([#1689](https://github.com/panicboat/monorepo/issues/1689)) ([669de13](https://github.com/panicboat/monorepo/commit/669de136f9d3a8de3fc89f510cbf21251463058b))
* **dystopia:** drop the open and closed status from kartes and reviews ([#1619](https://github.com/panicboat/monorepo/issues/1619)) ([d322a9d](https://github.com/panicboat/monorepo/commit/d322a9da11aa9cb0eb2a125e154d2dfc3d9d556f))
* **dystopia:** name footprint, bookmark, schedule and media actor columns, fields and arguments after the profile ([#1415](https://github.com/panicboat/monorepo/issues/1415)) ([199a576](https://github.com/panicboat/monorepo/commit/199a576d06826d46673abd9c68c3213b85c74bf1))
* **dystopia:** name messaging and notification actor columns, fields and arguments after the profile ([#1414](https://github.com/panicboat/monorepo/issues/1414)) ([505c69c](https://github.com/panicboat/monorepo/commit/505c69c602c9733192fe5673c16913d7581c6f4b))
* **dystopia:** name post actor columns, fields and arguments after the profile ([#1412](https://github.com/panicboat/monorepo/issues/1412)) ([02cd44f](https://github.com/panicboat/monorepo/commit/02cd44f5503e775a42d7ae865b8987a8f714b38e))
* **dystopia:** name review, discovery and feed actor columns, fields and arguments after the profile ([#1423](https://github.com/panicboat/monorepo/issues/1423)) ([8f414de](https://github.com/panicboat/monorepo/commit/8f414decfec25841e8c12ef6adb82b4fd6566373))
* **dystopia:** name social actor columns, fields and arguments after the profile ([#1413](https://github.com/panicboat/monorepo/issues/1413)) ([4c5f3b6](https://github.com/panicboat/monorepo/commit/4c5f3b67c84c3c887807a8274a8e353567193afc))
* **dystopia:** return karte and review parties as profile summaries ([#1563](https://github.com/panicboat/monorepo/issues/1563)) ([762793a](https://github.com/panicboat/monorepo/commit/762793accf25a2b8df655beafa692feefb1b85d1))
* **dystopia:** return post and comment authors as profile summaries ([#1561](https://github.com/panicboat/monorepo/issues/1561)) ([cb9b57e](https://github.com/panicboat/monorepo/commit/cb9b57e709f52d7aaf90abe9d66d55632e0ae0a4))
* **dystopia:** return profile summaries from profile-embedding services ([#1560](https://github.com/panicboat/monorepo/issues/1560)) ([92f2c91](https://github.com/panicboat/monorepo/commit/92f2c91ca3d0ce959acbc0bb6c526a235dfc2fec))


### Miscellaneous Chores

* **dystopia/monolith/infrastructure/aws/modules:** update terraform aws to v6.70.0 ([#1764](https://github.com/panicboat/monorepo/issues/1764)) ([f36d95f](https://github.com/panicboat/monorepo/commit/f36d95f517aded50679a1efd9c31e1bd697f412c))
* **dystopia/monolith:** update dependency aws-sdk-cognitoidentityprovider to "~&gt; 1.154" ([#1458](https://github.com/panicboat/monorepo/issues/1458)) ([d7628a3](https://github.com/panicboat/monorepo/commit/d7628a3b241610d10a3fa4153c6c25eb99ea599e))
* **dystopia/monolith:** update dependency aws-sdk-cognitoidentityprovider to "~&gt; 1.156" ([#1654](https://github.com/panicboat/monorepo/issues/1654)) ([f8bd3e1](https://github.com/panicboat/monorepo/commit/f8bd3e12f1ecf4ad01a9f47f582838425a30fd70))
* **dystopia/monolith:** update dependency aws-sdk-cognitoidentityprovider to "~&gt; 1.157" ([#1757](https://github.com/panicboat/monorepo/issues/1757)) ([4807e68](https://github.com/panicboat/monorepo/commit/4807e6861aa1d66117efc8c5c7291b4549bf8457))
* **dystopia/monolith:** update dependency aws-sdk-s3 to "~&gt; 1.232", "&gt;= 1.232.3" ([#1350](https://github.com/panicboat/monorepo/issues/1350)) ([10216fa](https://github.com/panicboat/monorepo/commit/10216fafec9455f7ac0eb0d521953d9ff26f941d))
* **dystopia/monolith:** update dependency aws-sdk-s3 to "~&gt; 1.233", "&gt;= 1.233.2" ([#1459](https://github.com/panicboat/monorepo/issues/1459)) ([bc464b7](https://github.com/panicboat/monorepo/commit/bc464b7529a1bfa3b182dac9a35ea2d95f9cff5a))
* **dystopia/monolith:** update dependency aws-sdk-s3 to "~&gt; 1.235" ([#1655](https://github.com/panicboat/monorepo/issues/1655)) ([92aa9b6](https://github.com/panicboat/monorepo/commit/92aa9b6e669c375acbdbb2ed817c7656f4868478))
* **dystopia/monolith:** update dependency grpc-tools to v1.84.1 ([#1758](https://github.com/panicboat/monorepo/issues/1758)) ([a254229](https://github.com/panicboat/monorepo/commit/a254229c6e267f7f85a8d96e6d556a249fa04123))
* **dystopia/monolith:** update dependency opentelemetry-exporter-otlp to "~&gt; 0.36" ([#1320](https://github.com/panicboat/monorepo/issues/1320)) ([719cdf0](https://github.com/panicboat/monorepo/commit/719cdf04790df3017b4989b658396c420aa2454b))
* **dystopia/monolith:** update dependency opentelemetry-exporter-otlp to "~&gt; 0.37" ([#1372](https://github.com/panicboat/monorepo/issues/1372)) ([5095e9c](https://github.com/panicboat/monorepo/commit/5095e9c52b22b64ffdeb0ecfa87c08df6cb07ba3))
* **dystopia/monolith:** update dependency opentelemetry-instrumentation-all to "~&gt; 0.97" ([#1375](https://github.com/panicboat/monorepo/issues/1375)) ([06290c3](https://github.com/panicboat/monorepo/commit/06290c30a48164172ccd89cfba58c71aa042de3b))
* **dystopia/monolith:** update dependency opentelemetry-instrumentation-all to "~&gt; 0.98" ([#1460](https://github.com/panicboat/monorepo/issues/1460)) ([5cb87c2](https://github.com/panicboat/monorepo/commit/5cb87c2637a7fd7d8db09b4a501d3d01b8a77fc9))
* **dystopia/monolith:** update dependency opentelemetry-instrumentation-all to "~&gt; 0.99" ([#1610](https://github.com/panicboat/monorepo/issues/1610)) ([ee18541](https://github.com/panicboat/monorepo/commit/ee18541ff6eab0f0f3f45a301d3a5956b4a583ec))
* **dystopia/monolith:** update dependency sqlite3 to v2.9.6 [security] ([#1390](https://github.com/panicboat/monorepo/issues/1390)) ([e34f4bf](https://github.com/panicboat/monorepo/commit/e34f4bf6f5a0aada40275e6e282613ac1335d39e))
* **dystopia/monolith:** update docker/dockerfile docker tag to v1.28 ([#1461](https://github.com/panicboat/monorepo/issues/1461)) ([a74ac10](https://github.com/panicboat/monorepo/commit/a74ac103db7bcd62db076c4927d5e5ee4bc54175))
* **dystopia:** drop the legacy review tables ([#1556](https://github.com/panicboat/monorepo/issues/1556)) ([9e25906](https://github.com/panicboat/monorepo/commit/9e259067e221e9b650dc422964c1a46d65b95798))
* **monolith:** bump image to ghcr.io/panicboat/monorepo/monolith:v0.8.0 ([9aad11c](https://github.com/panicboat/monorepo/commit/9aad11c11bb4109a40da695b19860f694b903e71))

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
