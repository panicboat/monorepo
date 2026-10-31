# Changelog

## [0.12.0](https://github.com/panicboat/monorepo/compare/frontend-v0.11.0...frontend-v0.12.0) (2026-10-31)


### Features

* **dystopia/frontend:** keep opened replies open ([#1884](https://github.com/panicboat/monorepo/issues/1884)) ([0561c84](https://github.com/panicboat/monorepo/commit/0561c84b14516028cd1867e8227843bf5c9d235a))
* **dystopia:** hide schedules and reviews of a locked profile from viewers who do not follow ([#1870](https://github.com/panicboat/monorepo/issues/1870)) ([9b1dbd8](https://github.com/panicboat/monorepo/commit/9b1dbd8757eec82e5b4de0aee20e7b60a320aacb))
* **dystopia:** keep feature behavior out of the terms and the privacy policy ([#1869](https://github.com/panicboat/monorepo/issues/1869)) ([3f94bc1](https://github.com/panicboat/monorepo/commit/3f94bc193ced5a2530f57751df8e57124fad2ef9))
* **dystopia:** remove the replies tab and post editing, and add deleting a post ([#1873](https://github.com/panicboat/monorepo/issues/1873)) ([48090b4](https://github.com/panicboat/monorepo/commit/48090b4281f3636d41cb6369bca56dfbb953d70f))


### Bug Fixes

* **dystopia/frontend:** tell the user when a follow, block or reaction fails ([#1877](https://github.com/panicboat/monorepo/issues/1877)) ([cf8ce38](https://github.com/panicboat/monorepo/commit/cf8ce388606da266e40eee9cc7393bd69750feac))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1158.0 ([#1855](https://github.com/panicboat/monorepo/issues/1855)) ([835286f](https://github.com/panicboat/monorepo/commit/835286f307ca3255584e01be081dfc33e3c4901d))
* **dystopia/frontend:** update dependency @connectrpc/connect to ^2.3.0 ([#1856](https://github.com/panicboat/monorepo/issues/1856)) ([716e21c](https://github.com/panicboat/monorepo/commit/716e21c348563c2a2249f5fa6ffe0e3ec3cc8351))
* **dystopia/frontend:** update dependency @connectrpc/connect-node to ^2.3.0 ([#1857](https://github.com/panicboat/monorepo/issues/1857)) ([2c179e0](https://github.com/panicboat/monorepo/commit/2c179e06872bbc682d3573aa63d522545508be43))


### Code Refactoring

* **dystopia/frontend:** remove code nothing reaches ([#1874](https://github.com/panicboat/monorepo/issues/1874)) ([f903ce3](https://github.com/panicboat/monorepo/commit/f903ce3248b60924b10de537037efc82d5bdbc85))
* **dystopia/frontend:** send every profile-scoped request through authFetch ([#1875](https://github.com/panicboat/monorepo/issues/1875)) ([c5a9526](https://github.com/panicboat/monorepo/commit/c5a952687db0da9f7af870a1f343547e31014bd2))
* **dystopia/frontend:** share one hook across the cursor paginated lists ([#1876](https://github.com/panicboat/monorepo/issues/1876)) ([67d213e](https://github.com/panicboat/monorepo/commit/67d213e6e70379b4a8927180ba8ec6efa76667d7))
* **dystopia/frontend:** untangle the profile module, nav badges and useAuth ([#1878](https://github.com/panicboat/monorepo/issues/1878)) ([81699e7](https://github.com/panicboat/monorepo/commit/81699e7e32b50df6e4d24aceae97a6341e702fef))


### Miscellaneous Chores

* **dystopia:** add an empty terragrunt stack to frontend ([#1871](https://github.com/panicboat/monorepo/issues/1871)) ([8c115fd](https://github.com/panicboat/monorepo/commit/8c115fd57774f850ffda88dfde51b9a452233e7e))

## [0.11.0](https://github.com/panicboat/monorepo/compare/frontend-v0.10.0...frontend-v0.11.0) (2026-10-29)


### Features

* deploy kubernetes manifests together with service releases ([#1835](https://github.com/panicboat/monorepo/issues/1835)) ([d8fbfe2](https://github.com/panicboat/monorepo/commit/d8fbfe23c5d21d6897c5ff866865a06ce7e35940))
* **dystopia/frontend:** choose what to write and to whom from the compose button ([#1506](https://github.com/panicboat/monorepo/issues/1506)) ([bd96a3d](https://github.com/panicboat/monorepo/commit/bd96a3d60728243e99f902dbbcff09bf2cb25724))
* **dystopia/frontend:** choose, switch and manage profiles ([#1426](https://github.com/panicboat/monorepo/issues/1426)) ([ba76d91](https://github.com/panicboat/monorepo/commit/ba76d9198f76cc4b3069c8ed5dc8691d31228552))
* **dystopia/frontend:** list the profile right after home in the side nav ([#1837](https://github.com/panicboat/monorepo/issues/1837)) ([dfad72e](https://github.com/panicboat/monorepo/commit/dfad72ecb775076f480b83aff51d6d9717bc0bfc))
* **dystopia/frontend:** make the site installable to the home screen ([#1498](https://github.com/panicboat/monorepo/issues/1498)) ([a5e958a](https://github.com/panicboat/monorepo/commit/a5e958aa813c1e36512900e631e8ef43aa67f73f))
* **dystopia/frontend:** open a lightbox when a post image is clicked ([#1366](https://github.com/panicboat/monorepo/issues/1366)) ([29e1e84](https://github.com/panicboat/monorepo/commit/29e1e845dd7b945ba23e52c18a58b4740ad953e5))
* **dystopia/frontend:** rebuild the landing page around who it is for ([#1500](https://github.com/panicboat/monorepo/issues/1500)) ([ff7198f](https://github.com/panicboat/monorepo/commit/ff7198f6bab634e77e7bbe7ac5c0d896f486ed12))
* **dystopia/frontend:** remove the sign-out feature ([#1483](https://github.com/panicboat/monorepo/issues/1483)) ([98b8148](https://github.com/panicboat/monorepo/commit/98b8148e1a7f9b61cf092a36b5f23d76923ff571))
* **dystopia/frontend:** strip location metadata from uploaded photos and videos ([#1687](https://github.com/panicboat/monorepo/issues/1687)) ([81e79a6](https://github.com/panicboat/monorepo/commit/81e79a6eba99881108ae0bf8154de5a496c46b79))
* **dystopia:** add age check and usage notices for legal compliance ([#1661](https://github.com/panicboat/monorepo/issues/1661)) ([f5779d8](https://github.com/panicboat/monorepo/commit/f5779d81c6dcc8241508c08b4fc8c02841f67c8b))
* **dystopia:** add the terms of service and the privacy policy ([#1672](https://github.com/panicboat/monorepo/issues/1672)) ([0e86f84](https://github.com/panicboat/monorepo/commit/0e86f84690bfa6b594fa14f282f0bd9dbf9f4b96))
* **dystopia:** align messages, footprints, ranking and settings with the mock ([#1547](https://github.com/panicboat/monorepo/issues/1547)) ([5a8486f](https://github.com/panicboat/monorepo/commit/5a8486fda625ad322f35b05b49be14214d9cdb10))
* **dystopia:** announce schedules with scheduled posts ([#1633](https://github.com/panicboat/monorepo/issues/1633)) ([ada7d30](https://github.com/panicboat/monorepo/commit/ada7d306468244c2cd5ec94b908878b396739559))
* **dystopia:** arrange profile actions by follow state ([#1551](https://github.com/panicboat/monorepo/issues/1551)) ([358239b](https://github.com/panicboat/monorepo/commit/358239bcfe36d34dca86960eb0b02cd14ca6a855))
* **dystopia:** call schedules 予定 everywhere instead of 出勤 ([#1667](https://github.com/panicboat/monorepo/issues/1667)) ([a0f2b3c](https://github.com/panicboat/monorepo/commit/a0f2b3c9ea4c52f7c7623d5c43a01b27efaabbb5))
* **dystopia:** choose follow approval apart from the profile lock ([#1623](https://github.com/panicboat/monorepo/issues/1623)) ([bc8f76a](https://github.com/panicboat/monorepo/commit/bc8f76a1f77bdf2aa1d78af4aaae6b2a78610b8d))
* **dystopia:** choose the industry in schedule search by its icon ([#1662](https://github.com/panicboat/monorepo/issues/1662)) ([04b4bbd](https://github.com/panicboat/monorepo/commit/04b4bbd71bbf0a7b6a08c8ab9c3f52b67e443373))
* **dystopia:** choose which profiles each device receives push notifications for ([#1688](https://github.com/panicboat/monorepo/issues/1688)) ([b6e416f](https://github.com/panicboat/monorepo/commit/b6e416f3db6ad37e4232cc0451ab9c76e98a8772))
* **dystopia:** handle follow requests from a tab on the viewer's own lists ([#1580](https://github.com/panicboat/monorepo/issues/1580)) ([839e4d5](https://github.com/panicboat/monorepo/commit/839e4d53d76ee0d07a951e5301cc32fe73c99231))
* **dystopia:** hide cast schedules from profiles in a block relation ([#1824](https://github.com/panicboat/monorepo/issues/1824)) ([ab224ce](https://github.com/panicboat/monorepo/commit/ab224ce6ee29beaa6f52128893fcc16c1936745d))
* **dystopia:** implement [@username](https://github.com/username) mentions in posts, comments, and replies ([#1348](https://github.com/panicboat/monorepo/issues/1348)) ([6895572](https://github.com/panicboat/monorepo/commit/6895572f1fbdb57c9a7189cb9bb3581af36be535))
* **dystopia:** keep reviews after a guest or a cast leaves ([#1705](https://github.com/panicboat/monorepo/issues/1705)) ([c7ef32a](https://github.com/panicboat/monorepo/commit/c7ef32a8f935eb364cff169275ef27022cace26d))
* **dystopia:** let the author edit a review or a karte entry ([#1496](https://github.com/panicboat/monorepo/issues/1496)) ([456549c](https://github.com/panicboat/monorepo/commit/456549c00e29bb9d88b3f4b683fdafe541808261))
* **dystopia:** list the posts of the viewer's followers on the home feed ([#1620](https://github.com/panicboat/monorepo/issues/1620)) ([3c5f3c6](https://github.com/panicboat/monorepo/commit/3c5f3c63f1867ff2084c0b2a690f11d1c5511462))
* **dystopia:** make the profile lock a badge only ([#1780](https://github.com/panicboat/monorepo/issues/1780)) ([679b737](https://github.com/panicboat/monorepo/commit/679b7373ce8309a08dd9ba04a068c554b3186769))
* **dystopia:** move the acting principal from the account to the profile ([#1403](https://github.com/panicboat/monorepo/issues/1403)) ([f71d417](https://github.com/panicboat/monorepo/commit/f71d417aeee6db931b5537cee129a59e9ada3731))
* **dystopia:** open post details in a sheet and fade tab content ([#1545](https://github.com/panicboat/monorepo/issues/1545)) ([de7d7af](https://github.com/panicboat/monorepo/commit/de7d7afeb38b9167188baad565a8426d09f83594))
* **dystopia:** own karte entries by account and show the writing profile as author ([#1410](https://github.com/panicboat/monorepo/issues/1410)) ([e29abdb](https://github.com/panicboat/monorepo/commit/e29abdb9e64a63033544bd246f97965e4c69eaba))
* **dystopia:** profile lifecycle, per-profile purge and hiding of disabled profiles ([#1424](https://github.com/panicboat/monorepo/issues/1424)) ([abaed78](https://github.com/panicboat/monorepo/commit/abaed78ff5e248615d318db19588b80fa8a37324))
* **dystopia:** rebuild reviews as kuchikomi on the karte lifecycle ([#1555](https://github.com/panicboat/monorepo/issues/1555)) ([036dedd](https://github.com/panicboat/monorepo/commit/036dedd344c1a80af04eeee621dab083ead2c3fe))
* **dystopia:** rebuild the karte screens around summary cards and a detail sheet ([#1544](https://github.com/panicboat/monorepo/issues/1544)) ([6a607a0](https://github.com/panicboat/monorepo/commit/6a607a015d3cf490ff21880ca7dbfcd673b6276a))
* **dystopia:** rebuild the profile screens with shift and review sheets ([#1546](https://github.com/panicboat/monorepo/issues/1546)) ([325f3b8](https://github.com/panicboat/monorepo/commit/325f3b805d46c49da9aaf9ac0c4d55b0c2bf04ab))
* **dystopia:** record a karte as one booking-to-aftercare series with events ([#1542](https://github.com/panicboat/monorepo/issues/1542)) ([72f419c](https://github.com/panicboat/monorepo/commit/72f419c2fcbcbfd8357b0246d8338b83d559eef2))
* **dystopia:** remove the website from profiles ([#1663](https://github.com/panicboat/monorepo/issues/1663)) ([60b8947](https://github.com/panicboat/monorepo/commit/60b8947a7b64f08311330df191a907ea1a613be0))
* **dystopia:** restructure the terms and the privacy policy ([#1749](https://github.com/panicboat/monorepo/issues/1749)) ([bb6c5d6](https://github.com/panicboat/monorepo/commit/bb6c5d68d39451ac808076403b2b488d012e08d1))
* **dystopia:** search schedules by main area and industry ([#1653](https://github.com/panicboat/monorepo/issues/1653)) ([1d32a74](https://github.com/panicboat/monorepo/commit/1d32a7472e3cad16fe8cd44955c0426094c2befc))
* **dystopia:** search schedules from the search screen ([#1635](https://github.com/panicboat/monorepo/issues/1635)) ([ea4a04f](https://github.com/panicboat/monorepo/commit/ea4a04f46f5b5ce4857addd4206ee2b0e6f1e664))
* **dystopia:** send notifications to devices with web push ([#1641](https://github.com/panicboat/monorepo/issues/1641)) ([935ac69](https://github.com/panicboat/monorepo/commit/935ac6973a9d914afa51cb4d4e467e1961551be2))
* **dystopia:** show followers-only posts to followers ([#1565](https://github.com/panicboat/monorepo/issues/1565)) ([7dfdf2e](https://github.com/panicboat/monorepo/commit/7dfdf2ed5ba617f7fb7fe0f9d3623ae757c56b8a))
* **dystopia:** show footprints, notifications and messages as cards ([#1570](https://github.com/panicboat/monorepo/issues/1570)) ([a891802](https://github.com/panicboat/monorepo/commit/a89180260198371e0a108745ce7bf7def977839c))
* **dystopia:** show posts only within their display window ([#1632](https://github.com/panicboat/monorepo/issues/1632)) ([5bd8c0e](https://github.com/panicboat/monorepo/commit/5bd8c0e2c28451ba22de7a5db5e6ddb74d9ccd3c))
* **dystopia:** show the acting profile above every composer ([#1553](https://github.com/panicboat/monorepo/issues/1553)) ([82af1d9](https://github.com/panicboat/monorepo/commit/82af1d9f7851ace6dc46de07f36de05886b25a22))
* **dystopia:** show the lock mark next to every profile name ([#1564](https://github.com/panicboat/monorepo/issues/1564)) ([e4b3b47](https://github.com/panicboat/monorepo/commit/e4b3b47a82c2d1d9e47d95ac16b8bfac3418aecb))
* **dystopia:** start posts from a locked profile as followers only ([#1701](https://github.com/panicboat/monorepo/issues/1701)) ([4f711cd](https://github.com/panicboat/monorepo/commit/4f711cdeb30e3f45841581a5b6e058ac394d8f64))
* **dystopia:** start schedule search from the acting profile's main area ([#1666](https://github.com/panicboat/monorepo/issues/1666)) ([0b4500f](https://github.com/panicboat/monorepo/commit/0b4500fdab0daddfadb406a7617db46bc063a8d5))
* **dystopia:** suggest followed profiles while typing a mention ([#1647](https://github.com/panicboat/monorepo/issues/1647)) ([2536985](https://github.com/panicboat/monorepo/commit/2536985680a9c761fcf4613f8ff62db95a0a47be))
* **dystopia:** turn the tags written in a post into links that find posts with the same tag ([#1501](https://github.com/panicboat/monorepo/issues/1501)) ([ff167b8](https://github.com/panicboat/monorepo/commit/ff167b8452098d534621f5b88b67e71be288d4e2))


### Bug Fixes

* **dystopia/frontend:** align the settings copy with how deletion, privacy and notifications work ([#1686](https://github.com/panicboat/monorepo/issues/1686)) ([ee0a336](https://github.com/panicboat/monorepo/commit/ee0a33678a2d3152313a2257b5c6a6e7a751080c))
* **dystopia/frontend:** draw icons as line icons instead of emoji ([#1512](https://github.com/panicboat/monorepo/issues/1512)) ([637dd12](https://github.com/panicboat/monorepo/commit/637dd128470cf611870021fc4f436b90d96ea28c))
* **dystopia/frontend:** draw the home screen icon without a caption ([#1514](https://github.com/panicboat/monorepo/issues/1514)) ([31b5ff0](https://github.com/panicboat/monorepo/commit/31b5ff047fbfbd75698235f5f5ba0cbbfc8924cd))
* **dystopia/frontend:** fetch bookmark and follow status for a list in one request ([#1836](https://github.com/panicboat/monorepo/issues/1836)) ([b8a68bf](https://github.com/panicboat/monorepo/commit/b8a68bf7ff348a1f11f25d7600787342a3e28750))
* **dystopia/frontend:** invite a cast to work and a guest to play in the city ([#1515](https://github.com/panicboat/monorepo/issues/1515)) ([3b013f7](https://github.com/panicboat/monorepo/commit/3b013f777c467a8e46a2383d021f1d73e101a9e1))
* **dystopia/frontend:** keep keyboard focus out of the closed drawer ([#1434](https://github.com/panicboat/monorepo/issues/1434)) ([a790f78](https://github.com/panicboat/monorepo/commit/a790f7837b4dae9cbe4554889b7f1b5e64644112))
* **dystopia/frontend:** keep the message composer above the bottom tab bar on narrow screens ([#1431](https://github.com/panicboat/monorepo/issues/1431)) ([ab79077](https://github.com/panicboat/monorepo/commit/ab7907798200c9d2f40030ca98d510df04128717))
* **dystopia/frontend:** link follow counts in the mobile drawer menu ([#1382](https://github.com/panicboat/monorepo/issues/1382)) ([fbb0794](https://github.com/panicboat/monorepo/commit/fbb0794310fec1b3be3a6e8437cbec7fbb0a23e1))
* **dystopia/frontend:** link profile avatars and names consistently ([#1381](https://github.com/panicboat/monorepo/issues/1381)) ([5abd0f6](https://github.com/panicboat/monorepo/commit/5abd0f6e7e673d77f873467715780aa4a678516d))
* **dystopia/frontend:** link the people on a review or karte entry to their profiles ([#1487](https://github.com/panicboat/monorepo/issues/1487)) ([0229b48](https://github.com/panicboat/monorepo/commit/0229b486417971f08ce9a45fbf5a1da0341a761d))
* **dystopia/frontend:** list the side nav and the drawer from one ordered menu ([#1484](https://github.com/panicboat/monorepo/issues/1484)) ([b65be49](https://github.com/panicboat/monorepo/commit/b65be4932ca7ca02ab2d92928b3e2fe3b4a4aea1))
* **dystopia/frontend:** mark locked profiles and move the private post mark next to the time ([#1492](https://github.com/panicboat/monorepo/issues/1492)) ([3a01b97](https://github.com/panicboat/monorepo/commit/3a01b97972afebb8b6f0164ef009fd443ecc0d93))
* **dystopia/frontend:** pick working hours from hour and minute lists ([#1497](https://github.com/panicboat/monorepo/issues/1497)) ([17a65a4](https://github.com/panicboat/monorepo/commit/17a65a449e95f7539ed1f13b1491f034bd3d0836))
* **dystopia/frontend:** play a video attached to a post ([#1494](https://github.com/panicboat/monorepo/issues/1494)) ([5635803](https://github.com/panicboat/monorepo/commit/56358039806e6d85ed6cf57aba2d56019e4af71c))
* **dystopia/frontend:** present the lock as a setting of each profile ([#1499](https://github.com/panicboat/monorepo/issues/1499)) ([9046c13](https://github.com/panicboat/monorepo/commit/9046c13ea86d926462f2b63a4a10f9421f6812da))
* **dystopia/frontend:** put the profile actions beside the avatar and space out the schedule ([#1491](https://github.com/panicboat/monorepo/issues/1491)) ([af28822](https://github.com/panicboat/monorepo/commit/af28822b45a3116e256401e71bbb607463a67c7e))
* **dystopia/frontend:** register the OpenTelemetry instrumentations the server uses instead of the auto-instrumentations bundle ([#1485](https://github.com/panicboat/monorepo/issues/1485)) ([73b4433](https://github.com/panicboat/monorepo/commit/73b4433867686927d5f3ef6bf7bbb276102810a6))
* **dystopia/frontend:** render post composer modal via Radix Dialog portal ([#1346](https://github.com/panicboat/monorepo/issues/1346)) ([06b8f2e](https://github.com/panicboat/monorepo/commit/06b8f2e8578d3915fe688b6673e562c220c165ca))
* **dystopia/frontend:** require COGNITO_ADAPTER to be aws or fake ([#1811](https://github.com/panicboat/monorepo/issues/1811)) ([5bd5e5f](https://github.com/panicboat/monorepo/commit/5bd5e5f3dda34306868cb9cac824e8ca92f52273))
* **dystopia/frontend:** scroll tabs horizontally instead of wrapping labels ([#1429](https://github.com/panicboat/monorepo/issues/1429)) ([986b91e](https://github.com/panicboat/monorepo/commit/986b91eeaf35f002972bf72b33c49798ef9b8680))
* **dystopia/frontend:** show password requirements on signup and reset ([#1395](https://github.com/panicboat/monorepo/issues/1395)) ([57e3b40](https://github.com/panicboat/monorepo/commit/57e3b40d1fd7658853a71a5acbe89f969fc07b9a))
* **dystopia/frontend:** show ratings as five stars and take whole ratings for a review ([#1486](https://github.com/panicboat/monorepo/issues/1486)) ([a82660c](https://github.com/panicboat/monorepo/commit/a82660c6c4d5729f6418ef63735ab200612acfff))
* **dystopia/frontend:** show the height of a cast apart from the three sizes ([#1488](https://github.com/panicboat/monorepo/issues/1488)) ([658ec8d](https://github.com/panicboat/monorepo/commit/658ec8db744cc896e130b6330a087a9792ead4f2))
* **dystopia/frontend:** show the industry of a cast as an icon ([#1490](https://github.com/panicboat/monorepo/issues/1490)) ([924baae](https://github.com/panicboat/monorepo/commit/924baaea4bf7c9b24181b72a14f1825b1fedfbd0))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1141.0 ([#1324](https://github.com/panicboat/monorepo/issues/1324)) ([51a320b](https://github.com/panicboat/monorepo/commit/51a320b8ecfa2b1ded6f16f181c575b7811b946c))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1142.0 ([#1363](https://github.com/panicboat/monorepo/issues/1363)) ([0c08bac](https://github.com/panicboat/monorepo/commit/0c08bac6f0434229311687fe84d7d6c09d8752ec))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1143.0 ([#1378](https://github.com/panicboat/monorepo/issues/1378)) ([49a79d0](https://github.com/panicboat/monorepo/commit/49a79d0940b2965453e5f240f02d236375975ee7))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1148.0 ([#1463](https://github.com/panicboat/monorepo/issues/1463)) ([31ceaeb](https://github.com/panicboat/monorepo/commit/31ceaeb12b60ddd6b4e0a3a9f654c0bad39a0094))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1149.0 ([#1529](https://github.com/panicboat/monorepo/issues/1529)) ([563bbcd](https://github.com/panicboat/monorepo/commit/563bbcdac14f397c31bb1ba3ff7693f17a940078))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1152.0 ([#1571](https://github.com/panicboat/monorepo/issues/1571)) ([96e6505](https://github.com/panicboat/monorepo/commit/96e6505abe0060c6dad6be4ccb0b8633cf7a447e))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1154.0 ([#1656](https://github.com/panicboat/monorepo/issues/1656)) ([5311d1f](https://github.com/panicboat/monorepo/commit/5311d1fb616364fc1627e649e34f6d2b5cae9a42))
* **dystopia/frontend:** update dependency @aws-sdk/client-cognito-identity-provider to ^3.1156.0 ([#1766](https://github.com/panicboat/monorepo/issues/1766)) ([64bb362](https://github.com/panicboat/monorepo/commit/64bb36279060203449fc8a207f113a80630f1948))
* **dystopia/frontend:** update dependency @bufbuild/buf to v1.73.0 ([#1325](https://github.com/panicboat/monorepo/issues/1325)) ([4610bf1](https://github.com/panicboat/monorepo/commit/4610bf1a06c2d3e897601cff4733895ad9b06a52))
* **dystopia/frontend:** update dependency @bufbuild/buf to v1.74.0 ([#1572](https://github.com/panicboat/monorepo/issues/1572)) ([bd20dd5](https://github.com/panicboat/monorepo/commit/bd20dd5837c3e0e28f54ccd31bb5778b5198de9d))
* **dystopia/frontend:** update dependency @bufbuild/buf to v1.75.0 ([#1767](https://github.com/panicboat/monorepo/issues/1767)) ([a9faea5](https://github.com/panicboat/monorepo/commit/a9faea50a91deafed177040b3f5e9c6802520e20))
* **dystopia/frontend:** update dependency @bufbuild/protobuf to ^2.15.0 ([#1326](https://github.com/panicboat/monorepo/issues/1326)) ([4f39da0](https://github.com/panicboat/monorepo/commit/4f39da01f96a01ba0631d05b06da5099139ebece))
* **dystopia/frontend:** update dependency @bufbuild/protobuf to ^2.16.0 ([#1364](https://github.com/panicboat/monorepo/issues/1364)) ([b9c2cf9](https://github.com/panicboat/monorepo/commit/b9c2cf93124ec428be19a2a683283d0d270a5c48))
* **dystopia/frontend:** update dependency @connectrpc/connect to ^2.2.0 ([#1327](https://github.com/panicboat/monorepo/issues/1327)) ([af692dc](https://github.com/panicboat/monorepo/commit/af692dcaccaf4c50caf2419c820d9179b6d1dc87))
* **dystopia/frontend:** update dependency @connectrpc/connect-node to ^2.2.0 ([#1328](https://github.com/panicboat/monorepo/issues/1328)) ([6e300c6](https://github.com/panicboat/monorepo/commit/6e300c698bf5d537ccdcd4862d0c8a9b5715bf05))
* **dystopia/frontend:** update dependency @opentelemetry/api to ^1.10.0 ([#1657](https://github.com/panicboat/monorepo/issues/1657)) ([fa9250e](https://github.com/panicboat/monorepo/commit/fa9250e9a49fffcf5c9f9417328ded4af7454460))
* **dystopia/frontend:** update dependency @opentelemetry/auto-instrumentations-node to ^0.80.0 ([#1329](https://github.com/panicboat/monorepo/issues/1329)) ([9caaa7d](https://github.com/panicboat/monorepo/commit/9caaa7d3c2119f4c897cef8f25a38565f79985cd))
* **dystopia/frontend:** update dependency @opentelemetry/exporter-trace-otlp-grpc to ^0.222.0 ([#1330](https://github.com/panicboat/monorepo/issues/1330)) ([84fd926](https://github.com/panicboat/monorepo/commit/84fd926d83949cebf7fd5990300735637834a9a3))
* **dystopia/frontend:** update dependency @opentelemetry/exporter-trace-otlp-grpc to ^0.223.0 ([#1465](https://github.com/panicboat/monorepo/issues/1465)) ([5cbfcfb](https://github.com/panicboat/monorepo/commit/5cbfcfb11b4c7a3907f6c553e8a0a368ea3c6418))
* **dystopia/frontend:** update dependency @opentelemetry/exporter-trace-otlp-grpc to ^0.300.0 ([#1658](https://github.com/panicboat/monorepo/issues/1658)) ([04d79c9](https://github.com/panicboat/monorepo/commit/04d79c9deb96847d603b97b6fc9d16d6306ea618))
* **dystopia/frontend:** update dependency @opentelemetry/instrumentation-aws-sdk to ^0.79.0 ([#1664](https://github.com/panicboat/monorepo/issues/1664)) ([a7e0a1e](https://github.com/panicboat/monorepo/commit/a7e0a1efa9839952acf799fbe32b7dc866fbbdbb))
* **dystopia/frontend:** update dependency @opentelemetry/instrumentation-http to ^0.300.0 ([#1665](https://github.com/panicboat/monorepo/issues/1665)) ([632da2f](https://github.com/panicboat/monorepo/commit/632da2ff39772ff3cc603cbdd32011a1ac7093ae))
* **dystopia/frontend:** update dependency @opentelemetry/instrumentation-undici to ^0.34.0 ([#1668](https://github.com/panicboat/monorepo/issues/1668)) ([72f8f71](https://github.com/panicboat/monorepo/commit/72f8f716426cb3d86ad5da0b5b09431231d23f2b))
* **dystopia/frontend:** update dependency @opentelemetry/sdk-node to ^0.222.0 ([#1331](https://github.com/panicboat/monorepo/issues/1331)) ([037ae96](https://github.com/panicboat/monorepo/commit/037ae9621d9c40e1da6145652d99c8726841c53b))
* **dystopia/frontend:** update dependency @opentelemetry/sdk-node to ^0.223.0 ([#1466](https://github.com/panicboat/monorepo/issues/1466)) ([200d4e3](https://github.com/panicboat/monorepo/commit/200d4e317c7f0e07efd9e3920741bf3ecb3ea410))
* **dystopia/frontend:** update dependency @opentelemetry/sdk-node to ^0.300.0 ([#1669](https://github.com/panicboat/monorepo/issues/1669)) ([327a84d](https://github.com/panicboat/monorepo/commit/327a84d70035beec5044531f8c0eb87e1575ef08))
* **dystopia/frontend:** update dependency @radix-ui/react-avatar to ^1.2.7 ([#1416](https://github.com/panicboat/monorepo/issues/1416)) ([0da8f0d](https://github.com/panicboat/monorepo/commit/0da8f0d1464585f17e6cbe9784b68d045b40c8d7))
* **dystopia/frontend:** update dependency @radix-ui/react-avatar to ^1.3.0 ([#1534](https://github.com/panicboat/monorepo/issues/1534)) ([47f35d4](https://github.com/panicboat/monorepo/commit/47f35d413e1b0d0fadbe00f7d6de720a16dfec72))
* **dystopia/frontend:** update dependency @radix-ui/react-avatar to ^1.3.1 ([#1593](https://github.com/panicboat/monorepo/issues/1593)) ([6e8f0e7](https://github.com/panicboat/monorepo/commit/6e8f0e70a499df62af40d16437d157d4beb20761))
* **dystopia/frontend:** update dependency @radix-ui/react-dialog to ^1.2.0 ([#1467](https://github.com/panicboat/monorepo/issues/1467)) ([7f2e6b4](https://github.com/panicboat/monorepo/commit/7f2e6b45575be9b99dc14cc3db53c6f73f988ba7))
* **dystopia/frontend:** update dependency @radix-ui/react-dialog to ^1.3.0 ([#1535](https://github.com/panicboat/monorepo/issues/1535)) ([a38849d](https://github.com/panicboat/monorepo/commit/a38849dae06799c8547c64018eb314f9a96fe697))
* **dystopia/frontend:** update dependency @radix-ui/react-dropdown-menu to ^2.1.25 ([#1417](https://github.com/panicboat/monorepo/issues/1417)) ([593acbb](https://github.com/panicboat/monorepo/commit/593acbbe7bee24933c6308b8ab14653230a9f279))
* **dystopia/frontend:** update dependency @radix-ui/react-dropdown-menu to ^2.2.0 ([#1536](https://github.com/panicboat/monorepo/issues/1536)) ([07d1436](https://github.com/panicboat/monorepo/commit/07d14360eee39107ce085872b80e8a3025aadc17))
* **dystopia/frontend:** update dependency @radix-ui/react-dropdown-menu to ^2.2.1 ([#1594](https://github.com/panicboat/monorepo/issues/1594)) ([35ffa83](https://github.com/panicboat/monorepo/commit/35ffa83cb4bacd9ac81e34594d99383fa0c96607))
* **dystopia/frontend:** update dependency @radix-ui/react-scroll-area to ^1.3.0 ([#1468](https://github.com/panicboat/monorepo/issues/1468)) ([8421d82](https://github.com/panicboat/monorepo/commit/8421d821e557904ec53e2c7d1845cd5fb8d2ea75))
* **dystopia/frontend:** update dependency @radix-ui/react-scroll-area to ^1.4.0 ([#1573](https://github.com/panicboat/monorepo/issues/1573)) ([b713cc4](https://github.com/panicboat/monorepo/commit/b713cc4f59a2ed02e559358fbf2109e27ec311b2))
* **dystopia/frontend:** update dependency @radix-ui/react-separator to ^1.1.16 ([#1418](https://github.com/panicboat/monorepo/issues/1418)) ([7f5f41f](https://github.com/panicboat/monorepo/commit/7f5f41f4bb0b043107944edc685e485caae55e88))
* **dystopia/frontend:** update dependency @radix-ui/react-separator to ^1.2.0 ([#1574](https://github.com/panicboat/monorepo/issues/1574)) ([13e03d8](https://github.com/panicboat/monorepo/commit/13e03d87145bc4b92b905afc45806855366bb0a2))
* **dystopia/frontend:** update dependency @radix-ui/react-slot to ^1.4.0 ([#1469](https://github.com/panicboat/monorepo/issues/1469)) ([5dcb77a](https://github.com/panicboat/monorepo/commit/5dcb77a608a833005b7cb725fb277d499f1e49ab))
* **dystopia/frontend:** update dependency @radix-ui/react-slot to ^1.5.0 ([#1575](https://github.com/panicboat/monorepo/issues/1575)) ([7b9e43e](https://github.com/panicboat/monorepo/commit/7b9e43e7fa70b59d4c2228a70f8fad945ba5479a))
* **dystopia/frontend:** update dependency jose to ^6.2.13 ([#1628](https://github.com/panicboat/monorepo/issues/1628)) ([91508ed](https://github.com/panicboat/monorepo/commit/91508edc6924b86a1a08ebc5b4182188ac23581f))
* **dystopia/frontend:** update dependency lucide-react to ^1.48.0 ([#1332](https://github.com/panicboat/monorepo/issues/1332)) ([9b9bc7e](https://github.com/panicboat/monorepo/commit/9b9bc7e449cf6550e80321040deb52816c66cbe0))
* **dystopia/frontend:** update dependency lucide-react to ^1.53.0 ([#1470](https://github.com/panicboat/monorepo/issues/1470)) ([5e06d3b](https://github.com/panicboat/monorepo/commit/5e06d3bbc0f213f05c1eeaf09203f4a32dc0da52))
* **dystopia/frontend:** update dependency lucide-react to ^1.55.0 ([#1530](https://github.com/panicboat/monorepo/issues/1530)) ([76822f6](https://github.com/panicboat/monorepo/commit/76822f620e2d5cbd6dc7a26926d45b1541b58bdf))
* **dystopia/frontend:** update dependency lucide-react to ^1.58.0 ([#1576](https://github.com/panicboat/monorepo/issues/1576)) ([11413bc](https://github.com/panicboat/monorepo/commit/11413bc712fa47f95e3b8a0b4616ecc2edb83da4))
* **dystopia/frontend:** update dependency lucide-react to ^1.59.0 ([#1611](https://github.com/panicboat/monorepo/issues/1611)) ([0127834](https://github.com/panicboat/monorepo/commit/01278341403f20cf72418470b8dbb3f3fb1c98a9))
* **dystopia/frontend:** update dependency lucide-react to ^1.61.0 ([#1670](https://github.com/panicboat/monorepo/issues/1670)) ([2828338](https://github.com/panicboat/monorepo/commit/28283389a05a6ae7432971fa5eee2855919686e2))
* **dystopia/frontend:** update dependency motion to ^13.4.6 ([#1351](https://github.com/panicboat/monorepo/issues/1351)) ([1949674](https://github.com/panicboat/monorepo/commit/19496745ea0d8a615f20bfc3071bae8f6265e08c))
* **dystopia/frontend:** update dependency motion to ^13.4.6 ([#1374](https://github.com/panicboat/monorepo/issues/1374)) ([b34af9c](https://github.com/panicboat/monorepo/commit/b34af9c2b416fec3fa87d21c21b2b352dcb95ebb))
* **dystopia/frontend:** update dependency motion to ^13.5.1 ([#1471](https://github.com/panicboat/monorepo/issues/1471)) ([cbcdcd1](https://github.com/panicboat/monorepo/commit/cbcdcd11a31cdfb266f8b5de31a1a6cc6fe1eb9d))
* **dystopia/frontend:** update dependency motion to ^14.1.0 ([#1531](https://github.com/panicboat/monorepo/issues/1531)) ([07217e7](https://github.com/panicboat/monorepo/commit/07217e78ebfc7467e15c3be09349f08342749ade))
* **dystopia/frontend:** update dependency motion to v13 ([#1342](https://github.com/panicboat/monorepo/issues/1342)) ([75d77b2](https://github.com/panicboat/monorepo/commit/75d77b249119c6d3c34532a6cf35bffffd44b40e))
* **dystopia/frontend:** update dependency motion to v14 ([#1473](https://github.com/panicboat/monorepo/issues/1473)) ([fb9deb0](https://github.com/panicboat/monorepo/commit/fb9deb0c3e49673cefefc3358d55de2bcabdaa42))
* **dystopia/frontend:** update dependency next to v16.3.7 ([#1352](https://github.com/panicboat/monorepo/issues/1352)) ([a73b6d8](https://github.com/panicboat/monorepo/commit/a73b6d8e01d9c5d1396dfaa894eec9cce3b97d3a))
* **dystopia/frontend:** update dependency next to v16.3.8 ([#1391](https://github.com/panicboat/monorepo/issues/1391)) ([316f4fc](https://github.com/panicboat/monorepo/commit/316f4fc10516a3461bd829f2a84ed3d029318a83))
* **dystopia/frontend:** update dependency next to v16.4.0 ([#1472](https://github.com/panicboat/monorepo/issues/1472)) ([7a4783b](https://github.com/panicboat/monorepo/commit/7a4783bd0116f764628431af751f684274b53474))
* **dystopia/frontend:** update dependency next to v16.4.2 ([#1595](https://github.com/panicboat/monorepo/issues/1595)) ([4d0aa73](https://github.com/panicboat/monorepo/commit/4d0aa73a935c84042e4cb2a302bc5b4c74c1636c))
* **dystopia/frontend:** update dependency next to v16.4.3 ([#1759](https://github.com/panicboat/monorepo/issues/1759)) ([5b9835d](https://github.com/panicboat/monorepo/commit/5b9835d750779c2df923f3eed9215291642f3177))
* **dystopia/frontend:** update dependency react to v19.3.0 ([#1333](https://github.com/panicboat/monorepo/issues/1333)) ([9c952ec](https://github.com/panicboat/monorepo/commit/9c952ece81e085c3affb42c0894384aabdea6d97))
* **dystopia/frontend:** update dependency react to v19.3.1 ([#1599](https://github.com/panicboat/monorepo/issues/1599)) ([3627598](https://github.com/panicboat/monorepo/commit/362759894c57c964ce6ad3129e13f1b983938359))
* **dystopia/frontend:** update dependency react-dom to v19.3.0 ([#1334](https://github.com/panicboat/monorepo/issues/1334)) ([0782462](https://github.com/panicboat/monorepo/commit/078246230f8e09f578d71bd5e5314348cb891d9a))
* **dystopia/frontend:** update dependency react-dom to v19.3.1 ([#1600](https://github.com/panicboat/monorepo/issues/1600)) ([eb754bc](https://github.com/panicboat/monorepo/commit/eb754bcc95c470280bc6c8419814e6d78074c2c0))
* **dystopia/frontend:** update dependency tailwind-merge to ^3.7.0 ([#1335](https://github.com/panicboat/monorepo/issues/1335)) ([480e34d](https://github.com/panicboat/monorepo/commit/480e34ded55a47e2bef131f342a12d89bb44790c))
* **dystopia/frontend:** update dependency zustand to ^5.0.16 ([#1760](https://github.com/panicboat/monorepo/issues/1760)) ([d2aace4](https://github.com/panicboat/monorepo/commit/d2aace48fb327b7f8ccaa0fbcbfc517e60bd9d1a))
* **dystopia:** align the terms, the privacy policy and the specs with merged changes ([#1709](https://github.com/panicboat/monorepo/issues/1709)) ([4f88184](https://github.com/panicboat/monorepo/commit/4f88184c893bacc0b1d058df2ed60bf0ac812ae4))
* **dystopia:** answer NOT_FOUND from GetProfile for a profile that does not exist ([#1433](https://github.com/panicboat/monorepo/issues/1433)) ([cefcad8](https://github.com/panicboat/monorepo/commit/cefcad86dc7699537b6443fa1e90cd983b1f9e6c))
* **dystopia:** close gaps on the bookmark, footprint, profile and home screens ([#1793](https://github.com/panicboat/monorepo/issues/1793)) ([1a5f0a9](https://github.com/panicboat/monorepo/commit/1a5f0a9ef36d375168adb1df4eb1b53d94047cbc))
* **dystopia:** derive the area feed prefecture from the viewer's profile ([#1812](https://github.com/panicboat/monorepo/issues/1812)) ([88955f2](https://github.com/panicboat/monorepo/commit/88955f29c1b83839c3158e277e3b79b995636a70))
* **dystopia:** describe the home karte and review tabs the same way ([#1596](https://github.com/panicboat/monorepo/issues/1596)) ([5b12f68](https://github.com/panicboat/monorepo/commit/5b12f6866d44684e06c86cd3ae0cdc9261b60141))
* **dystopia:** drop the weekly summary and open schedule links on the schedule tab ([#1637](https://github.com/panicboat/monorepo/issues/1637)) ([1fd5b2e](https://github.com/panicboat/monorepo/commit/1fd5b2eacff2ef0baf9dd71ad5ccbff42f3fd937))
* **dystopia:** feed and ranking errors, local dev sign-in ([#1380](https://github.com/panicboat/monorepo/issues/1380)) ([7e68c92](https://github.com/panicboat/monorepo/commit/7e68c9221bd7ccf1e5b85c137215ad1867aee4f7))
* **dystopia:** gate message button by role-based follow requirement ([#1301](https://github.com/panicboat/monorepo/issues/1301)) ([68f1563](https://github.com/panicboat/monorepo/commit/68f1563fede3044976a07e17b65682a5debc554b))
* **dystopia:** keep users signed in past the one-hour access token ([#1569](https://github.com/panicboat/monorepo/issues/1569)) ([ea1e5d6](https://github.com/panicboat/monorepo/commit/ea1e5d675e0fa5531791e127e593b84c5c7cfb41))
* **dystopia:** let incomplete sign-ups register again and purge them after a day ([#1825](https://github.com/panicboat/monorepo/issues/1825)) ([8f748ad](https://github.com/panicboat/monorepo/commit/8f748ad000ee7ea8f055eb01e6544faba63a0512))
* **dystopia:** let karte and review authors delete events in any state ([#1584](https://github.com/panicboat/monorepo/issues/1584)) ([00c4f51](https://github.com/panicboat/monorepo/commit/00c4f51f73002baebe6355b2abf37a6b7f54c964))
* **dystopia:** link karte and review authors to their profiles ([#1558](https://github.com/panicboat/monorepo/issues/1558)) ([d571c3e](https://github.com/panicboat/monorepo/commit/d571c3e216e2538355462f4d445e25affaa746e0))
* **dystopia:** list the days in the bulk plan sheet one per row ([#1559](https://github.com/panicboat/monorepo/issues/1559)) ([909e154](https://github.com/panicboat/monorepo/commit/909e154fcf0c1f5948bd92ee339d3d76293e497b))
* **dystopia:** list the schedule as cards and call it plans ([#1557](https://github.com/panicboat/monorepo/issues/1557)) ([1d39c5d](https://github.com/panicboat/monorepo/commit/1d39c5d68edcca2db68688943620e9ba5d10cac5))
* **dystopia:** match the specs, the terms and the privacy policy to the implementation ([#1715](https://github.com/panicboat/monorepo/issues/1715)) ([ba7b2c1](https://github.com/panicboat/monorepo/commit/ba7b2c117a1feeae4ea2a5687ff6a1f0a0faaebe))
* **dystopia:** narrow schedule search by the hours worked ([#1636](https://github.com/panicboat/monorepo/issues/1636)) ([2f78aec](https://github.com/panicboat/monorepo/commit/2f78aec2c4f893bfca4530798f550c42a45e5668))
* **dystopia:** open home for notifications to a profile the account cannot act as ([#1644](https://github.com/panicboat/monorepo/issues/1644)) ([afa9585](https://github.com/panicboat/monorepo/commit/afa9585207601d73ce71b2092ebf9ed16344ee88))
* **dystopia:** open the notification list for notifications to a profile the account cannot act as ([#1642](https://github.com/panicboat/monorepo/issues/1642)) ([3a4297f](https://github.com/panicboat/monorepo/commit/3a4297f206ca264e8570a1a5043293bcdc06422a))
* **dystopia:** purge deactivated accounts every day and delete their uploaded files ([#1685](https://github.com/panicboat/monorepo/issues/1685)) ([cbfaf22](https://github.com/panicboat/monorepo/commit/cbfaf22f480a3ffdd3654a262545d0517819d63c))
* **dystopia:** read follow requests, blocked accounts and threads past the first page ([#1792](https://github.com/panicboat/monorepo/issues/1792)) ([ce48371](https://github.com/panicboat/monorepo/commit/ce48371d0d605c2d2bde3ddcc72c2237fd546e81))
* **dystopia:** refresh an open conversation by polling and remove the event stream ([#1441](https://github.com/panicboat/monorepo/issues/1441)) ([7b9417a](https://github.com/panicboat/monorepo/commit/7b9417accc5f5682a4cc0ae38418da45d9904e33))
* **dystopia:** refresh author lists and feed comment counts after writes ([#1550](https://github.com/panicboat/monorepo/issues/1550)) ([3d98ebe](https://github.com/panicboat/monorepo/commit/3d98ebeca8d79f6f4b2de98af212ebc7880ae28a))
* **dystopia:** refresh the notification badge as soon as notifications are read ([#1618](https://github.com/panicboat/monorepo/issues/1618)) ([ed1cffa](https://github.com/panicboat/monorepo/commit/ed1cffa9744969b0640866640112d456a665ea4a))
* **dystopia:** replace the LINE sns link with lit.link ([#1700](https://github.com/panicboat/monorepo/issues/1700)) ([46ac558](https://github.com/panicboat/monorepo/commit/46ac5583e01975324f4b0a71a192237713a8b7c4))
* **dystopia:** seed accounts that own a second profile and make the README seed steps match the schema ([#1451](https://github.com/panicboat/monorepo/issues/1451)) ([09db2a8](https://github.com/panicboat/monorepo/commit/09db2a8d0c276693dc8d82b6fd36c20dd542e823))
* **dystopia:** serve media only through what it is attached to ([#1781](https://github.com/panicboat/monorepo/issues/1781)) ([11b0304](https://github.com/panicboat/monorepo/commit/11b0304bb91b229177d13be50050f56ce4eddbc3))
* **dystopia:** show schedules the same way on posts and in schedule search ([#1639](https://github.com/panicboat/monorepo/issues/1639)) ([d032a81](https://github.com/panicboat/monorepo/commit/d032a81532916e8e054d2fc69eea3c18611eba01))
* **dystopia:** show who a conversation is with and say why a reply cannot be sent ([#1493](https://github.com/panicboat/monorepo/issues/1493)) ([79269bc](https://github.com/panicboat/monorepo/commit/79269bcf71f54df3d722783db0ef4a68af6cb8d6))
* **dystopia:** treat Unicode whitespace as blank input ([#1814](https://github.com/panicboat/monorepo/issues/1814)) ([9100843](https://github.com/panicboat/monorepo/commit/9100843aa53966ca61429d96ee2a0b37ab367235))


### Performance Improvements

* **dystopia:** shrink post photos with a thumbnail and keep media URLs stable ([#1622](https://github.com/panicboat/monorepo/issues/1622)) ([d5c030d](https://github.com/panicboat/monorepo/commit/d5c030da51ddb13ec84b0679d2303366a666a39c))


### Code Refactoring

* **dystopia/frontend:** adopt the mock's palette, side sheet and route fade ([#1521](https://github.com/panicboat/monorepo/issues/1521)) ([7a39906](https://github.com/panicboat/monorepo/commit/7a3990624cd1c39fa6d77016557d71ad0844246b))
* **dystopia:** drop the open and closed status from kartes and reviews ([#1619](https://github.com/panicboat/monorepo/issues/1619)) ([d322a9d](https://github.com/panicboat/monorepo/commit/d322a9da11aa9cb0eb2a125e154d2dfc3d9d556f))
* **dystopia:** name footprint, bookmark, schedule and media actor columns, fields and arguments after the profile ([#1415](https://github.com/panicboat/monorepo/issues/1415)) ([199a576](https://github.com/panicboat/monorepo/commit/199a576d06826d46673abd9c68c3213b85c74bf1))
* **dystopia:** name messaging and notification actor columns, fields and arguments after the profile ([#1414](https://github.com/panicboat/monorepo/issues/1414)) ([505c69c](https://github.com/panicboat/monorepo/commit/505c69c602c9733192fe5673c16913d7581c6f4b))
* **dystopia:** name post actor columns, fields and arguments after the profile ([#1412](https://github.com/panicboat/monorepo/issues/1412)) ([02cd44f](https://github.com/panicboat/monorepo/commit/02cd44f5503e775a42d7ae865b8987a8f714b38e))
* **dystopia:** name review, discovery and feed actor columns, fields and arguments after the profile ([#1423](https://github.com/panicboat/monorepo/issues/1423)) ([8f414de](https://github.com/panicboat/monorepo/commit/8f414decfec25841e8c12ef6adb82b4fd6566373))
* **dystopia:** name social actor columns, fields and arguments after the profile ([#1413](https://github.com/panicboat/monorepo/issues/1413)) ([4c5f3b6](https://github.com/panicboat/monorepo/commit/4c5f3b67c84c3c887807a8274a8e353567193afc))
* **dystopia:** reduce settings to profile and appearance tabs ([#1579](https://github.com/panicboat/monorepo/issues/1579)) ([a743100](https://github.com/panicboat/monorepo/commit/a7431004c917c4bd31c6704ab4feee565cf552d1))
* **dystopia:** return karte and review parties as profile summaries ([#1563](https://github.com/panicboat/monorepo/issues/1563)) ([762793a](https://github.com/panicboat/monorepo/commit/762793accf25a2b8df655beafa692feefb1b85d1))
* **dystopia:** return post and comment authors as profile summaries ([#1561](https://github.com/panicboat/monorepo/issues/1561)) ([cb9b57e](https://github.com/panicboat/monorepo/commit/cb9b57e709f52d7aaf90abe9d66d55632e0ae0a4))
* **dystopia:** return profile summaries from profile-embedding services ([#1560](https://github.com/panicboat/monorepo/issues/1560)) ([92f2c91](https://github.com/panicboat/monorepo/commit/92f2c91ca3d0ce959acbc0bb6c526a235dfc2fec))
* **dystopia:** share the rating, chip and status ui with the review ([#1554](https://github.com/panicboat/monorepo/issues/1554)) ([175d563](https://github.com/panicboat/monorepo/commit/175d5637da8d0ff9b95e05c431f5c324f667e004))


### Miscellaneous Chores

* **dystopia/frontend:** update dependency @bufbuild/protoc-gen-es to v2.16.0 ([#1353](https://github.com/panicboat/monorepo/issues/1353)) ([40ce383](https://github.com/panicboat/monorepo/commit/40ce383e13f564b9556c0e33fdb22df14ecea43b))
* **dystopia/frontend:** update dependency @types/node to ^24.19.0 ([#1316](https://github.com/panicboat/monorepo/issues/1316)) ([d72b572](https://github.com/panicboat/monorepo/commit/d72b572ff51fc7363d6d573d0fb711c24e2469fc))
* **dystopia/frontend:** update dependency @types/node to ^24.19.1 ([#1385](https://github.com/panicboat/monorepo/issues/1385)) ([0ffeb10](https://github.com/panicboat/monorepo/commit/0ffeb1004373ca8a3ca6ce1232b69d1f3f150766))
* **dystopia/frontend:** update dependency @types/node to ^24.19.2 ([#1525](https://github.com/panicboat/monorepo/issues/1525)) ([a0c5238](https://github.com/panicboat/monorepo/commit/a0c52384c703f68f1dfa5e4496b02e16ad32bbc0))
* **dystopia/frontend:** update dependency @typescript-eslint/eslint-plugin to ^8.71.0 ([#1354](https://github.com/panicboat/monorepo/issues/1354)) ([430fec6](https://github.com/panicboat/monorepo/commit/430fec645ba95c810ce623bb973a2fc24588f29f))
* **dystopia/frontend:** update dependency @typescript-eslint/eslint-plugin to ^8.71.1 ([#1398](https://github.com/panicboat/monorepo/issues/1398)) ([0d43599](https://github.com/panicboat/monorepo/commit/0d4359908b6f7a913bfc2151d6b6ad9fbfdf2577))
* **dystopia/frontend:** update dependency @typescript-eslint/eslint-plugin to ^8.71.2 ([#1537](https://github.com/panicboat/monorepo/issues/1537)) ([4eb0082](https://github.com/panicboat/monorepo/commit/4eb0082ed9fd1036671b47bb91ddf72639969b3a))
* **dystopia/frontend:** update dependency @typescript-eslint/eslint-plugin to ^8.72.0 ([#1613](https://github.com/panicboat/monorepo/issues/1613)) ([3c5cec8](https://github.com/panicboat/monorepo/commit/3c5cec82b8f385ba38ff6a9fcf6c2758198369a6))
* **dystopia/frontend:** update dependency @typescript-eslint/eslint-plugin to ^8.72.1 ([#1830](https://github.com/panicboat/monorepo/issues/1830)) ([4f5789c](https://github.com/panicboat/monorepo/commit/4f5789c7593ca993da95c9651b540dc058307c74))
* **dystopia/frontend:** update dependency @typescript-eslint/parser to ^8.71.0 ([#1355](https://github.com/panicboat/monorepo/issues/1355)) ([cfacdcd](https://github.com/panicboat/monorepo/commit/cfacdcd3c697d8893c4720629ba2644fc9afa2e6))
* **dystopia/frontend:** update dependency @typescript-eslint/parser to ^8.71.1 ([#1399](https://github.com/panicboat/monorepo/issues/1399)) ([3c9d52e](https://github.com/panicboat/monorepo/commit/3c9d52eeacff01494887fca2a457497091257834))
* **dystopia/frontend:** update dependency @typescript-eslint/parser to ^8.71.2 ([#1538](https://github.com/panicboat/monorepo/issues/1538)) ([f18b0e9](https://github.com/panicboat/monorepo/commit/f18b0e92d88fbbcbe0b69f0ba1c153d3ee701839))
* **dystopia/frontend:** update dependency @typescript-eslint/parser to ^8.72.0 ([#1614](https://github.com/panicboat/monorepo/issues/1614)) ([d5d25d9](https://github.com/panicboat/monorepo/commit/d5d25d9de77130c6f545e3ed721e4d059479e818))
* **dystopia/frontend:** update dependency @typescript-eslint/parser to ^8.72.1 ([#1831](https://github.com/panicboat/monorepo/issues/1831)) ([2d7338e](https://github.com/panicboat/monorepo/commit/2d7338eca7470b5a0035f5dc5d7e78afa8823a1a))
* **dystopia/frontend:** update dependency @typescript-eslint/scope-manager to ^8.71.0 ([#1356](https://github.com/panicboat/monorepo/issues/1356)) ([8f8f49a](https://github.com/panicboat/monorepo/commit/8f8f49ae2748640eba22d5ea38f86a7b32e6314d))
* **dystopia/frontend:** update dependency @typescript-eslint/scope-manager to ^8.71.1 ([#1400](https://github.com/panicboat/monorepo/issues/1400)) ([d182271](https://github.com/panicboat/monorepo/commit/d182271f9c6270401e4254d1cebdf39b8ebb9dfa))
* **dystopia/frontend:** update dependency @typescript-eslint/scope-manager to ^8.71.2 ([#1539](https://github.com/panicboat/monorepo/issues/1539)) ([85a45c0](https://github.com/panicboat/monorepo/commit/85a45c00324cd8f10e5aa4c615cae01d26442f9c))
* **dystopia/frontend:** update dependency @typescript-eslint/scope-manager to ^8.72.0 ([#1615](https://github.com/panicboat/monorepo/issues/1615)) ([b6efd67](https://github.com/panicboat/monorepo/commit/b6efd6731315268fbbff8ec44dd8e9192e4e8ef7))
* **dystopia/frontend:** update dependency @typescript-eslint/scope-manager to ^8.72.1 ([#1832](https://github.com/panicboat/monorepo/issues/1832)) ([5c093d5](https://github.com/panicboat/monorepo/commit/5c093d593f22ea5f7e782899b216f417d8be973d))
* **dystopia/frontend:** update dependency @typescript-eslint/type-utils to ^8.71.0 ([#1357](https://github.com/panicboat/monorepo/issues/1357)) ([3c1fad9](https://github.com/panicboat/monorepo/commit/3c1fad9225ade1922d48b927756c6a5b5cfed221))
* **dystopia/frontend:** update dependency @typescript-eslint/type-utils to ^8.71.1 ([#1401](https://github.com/panicboat/monorepo/issues/1401)) ([ec946da](https://github.com/panicboat/monorepo/commit/ec946da020f89d9a5e06f6792a077e4228c34fee))
* **dystopia/frontend:** update dependency @typescript-eslint/type-utils to ^8.71.2 ([#1540](https://github.com/panicboat/monorepo/issues/1540)) ([3f97f70](https://github.com/panicboat/monorepo/commit/3f97f70c107340e3c53efae80ecce3e57e1605f7))
* **dystopia/frontend:** update dependency @typescript-eslint/type-utils to ^8.72.0 ([#1616](https://github.com/panicboat/monorepo/issues/1616)) ([d5fdfff](https://github.com/panicboat/monorepo/commit/d5fdfff3e0b7ec92bc69f2cd140be52492014f3b))
* **dystopia/frontend:** update dependency @typescript-eslint/type-utils to ^8.72.1 ([#1833](https://github.com/panicboat/monorepo/issues/1833)) ([9cb657c](https://github.com/panicboat/monorepo/commit/9cb657c8ecb8397607f92999a1d90092cd119a88))
* **dystopia/frontend:** update dependency @typescript-eslint/types to ^8.71.0 ([#1358](https://github.com/panicboat/monorepo/issues/1358)) ([87dbc83](https://github.com/panicboat/monorepo/commit/87dbc83cbb17c81d8699d2deeac7cd85ed531006))
* **dystopia/frontend:** update dependency @typescript-eslint/types to ^8.71.1 ([#1402](https://github.com/panicboat/monorepo/issues/1402)) ([9d6a1b7](https://github.com/panicboat/monorepo/commit/9d6a1b7c5d9f0869585cb1742b2adf12d8fae3d8))
* **dystopia/frontend:** update dependency @typescript-eslint/types to ^8.71.2 ([#1541](https://github.com/panicboat/monorepo/issues/1541)) ([55b796f](https://github.com/panicboat/monorepo/commit/55b796fa8bc3b92f15f024cff331b4b488e58b59))
* **dystopia/frontend:** update dependency @typescript-eslint/types to ^8.72.0 ([#1617](https://github.com/panicboat/monorepo/issues/1617)) ([6e9dca5](https://github.com/panicboat/monorepo/commit/6e9dca564f476f3ff7d2d39306011a6bc2321a06))
* **dystopia/frontend:** update dependency @typescript-eslint/types to ^8.72.1 ([#1834](https://github.com/panicboat/monorepo/issues/1834)) ([cc1cba0](https://github.com/panicboat/monorepo/commit/cc1cba0984bce5e89071101ab09e11f05b284888))
* **dystopia/frontend:** update dependency @typescript-eslint/typescript-estree to ^8.71.0 ([#1359](https://github.com/panicboat/monorepo/issues/1359)) ([c3f6093](https://github.com/panicboat/monorepo/commit/c3f6093c52ad82a18b8125a54ba3f7fc5567317b))
* **dystopia/frontend:** update dependency @typescript-eslint/typescript-estree to ^8.71.1 ([#1405](https://github.com/panicboat/monorepo/issues/1405)) ([2b9a38a](https://github.com/panicboat/monorepo/commit/2b9a38aec7ae886d570dc3b1e5a282c8db295a2a))
* **dystopia/frontend:** update dependency @typescript-eslint/typescript-estree to ^8.71.2 ([#1586](https://github.com/panicboat/monorepo/issues/1586)) ([23f88d1](https://github.com/panicboat/monorepo/commit/23f88d19a564264585f5c2ede2e3232d398bb6c1))
* **dystopia/frontend:** update dependency @typescript-eslint/typescript-estree to ^8.72.0 ([#1629](https://github.com/panicboat/monorepo/issues/1629)) ([ee523c4](https://github.com/panicboat/monorepo/commit/ee523c4426e81a0cb1614915702ec8a749143084))
* **dystopia/frontend:** update dependency @typescript-eslint/typescript-estree to ^8.72.1 ([#1838](https://github.com/panicboat/monorepo/issues/1838)) ([9a79b78](https://github.com/panicboat/monorepo/commit/9a79b7866d2fe260ae1c9e5f8d39b3bbf197b08c))
* **dystopia/frontend:** update dependency @typescript-eslint/utils to ^8.71.0 ([#1360](https://github.com/panicboat/monorepo/issues/1360)) ([3edaf93](https://github.com/panicboat/monorepo/commit/3edaf934e8e5e8c8245e7edd7bce517d0ee759a8))
* **dystopia/frontend:** update dependency @typescript-eslint/utils to ^8.71.1 ([#1406](https://github.com/panicboat/monorepo/issues/1406)) ([98f2bb4](https://github.com/panicboat/monorepo/commit/98f2bb4c693dc294d3d1a00e98431b5cc75f7af8))
* **dystopia/frontend:** update dependency @typescript-eslint/utils to ^8.71.2 ([#1587](https://github.com/panicboat/monorepo/issues/1587)) ([ad0b3d5](https://github.com/panicboat/monorepo/commit/ad0b3d5249e4d7273eafc96035c034e51412c37d))
* **dystopia/frontend:** update dependency @typescript-eslint/utils to ^8.72.0 ([#1630](https://github.com/panicboat/monorepo/issues/1630)) ([b88dd4a](https://github.com/panicboat/monorepo/commit/b88dd4a538fb4db7bbd4c899469f37ad98eafcde))
* **dystopia/frontend:** update dependency @typescript-eslint/utils to ^8.72.1 ([#1839](https://github.com/panicboat/monorepo/issues/1839)) ([122b1c5](https://github.com/panicboat/monorepo/commit/122b1c5ed4056ea5c82162226e54463bf6ee2c6e))
* **dystopia/frontend:** update dependency @typescript-eslint/visitor-keys to ^8.71.0 ([#1361](https://github.com/panicboat/monorepo/issues/1361)) ([046e536](https://github.com/panicboat/monorepo/commit/046e536e42c1dfb27e3e8f1fccb1f8845d730817))
* **dystopia/frontend:** update dependency @typescript-eslint/visitor-keys to ^8.71.1 ([#1407](https://github.com/panicboat/monorepo/issues/1407)) ([a780e2d](https://github.com/panicboat/monorepo/commit/a780e2d7747dc8d81647dbe202c67d0e21580d94))
* **dystopia/frontend:** update dependency @typescript-eslint/visitor-keys to ^8.71.2 ([#1588](https://github.com/panicboat/monorepo/issues/1588)) ([f39c598](https://github.com/panicboat/monorepo/commit/f39c598f8eda2d2043676195d9343e3b4d2a31e1))
* **dystopia/frontend:** update dependency @typescript-eslint/visitor-keys to ^8.72.0 ([#1631](https://github.com/panicboat/monorepo/issues/1631)) ([6363bbe](https://github.com/panicboat/monorepo/commit/6363bbe0d2830c73adff0aea06c71a5df53faa47))
* **dystopia/frontend:** update dependency @typescript-eslint/visitor-keys to ^8.72.1 ([#1840](https://github.com/panicboat/monorepo/issues/1840)) ([69a47c1](https://github.com/panicboat/monorepo/commit/69a47c1e7692e5112349691b71092f6d7283fd73))
* **dystopia/frontend:** update dependency @vitest/coverage-v8 to ^5.0.3 ([#1368](https://github.com/panicboat/monorepo/issues/1368)) ([3442700](https://github.com/panicboat/monorepo/commit/34427000d07db4bbbf754cc947faea59888fe04a))
* **dystopia/frontend:** update dependency @vitest/coverage-v8 to ^5.0.4 ([#1532](https://github.com/panicboat/monorepo/issues/1532)) ([9f2da97](https://github.com/panicboat/monorepo/commit/9f2da97555b209966b7617846ffa113f5b1cc5c7))
* **dystopia/frontend:** update dependency @vitest/coverage-v8 to ^5.0.5 ([#1589](https://github.com/panicboat/monorepo/issues/1589)) ([8fb6113](https://github.com/panicboat/monorepo/commit/8fb611316f50bf30abcb6b7993fe7ff0c30a2ad6))
* **dystopia/frontend:** update dependency @vitest/coverage-v8 to v5 ([#1338](https://github.com/panicboat/monorepo/issues/1338)) ([e7e3792](https://github.com/panicboat/monorepo/commit/e7e37925f402d08dd74908e1655e62df40c6edc5))
* **dystopia/frontend:** update dependency eslint to ^10.11.0 ([#1317](https://github.com/panicboat/monorepo/issues/1317)) ([f08a4f1](https://github.com/panicboat/monorepo/commit/f08a4f1549aad768ba44deecfd7ce20ff1ab06b4))
* **dystopia/frontend:** update dependency eslint to ^10.12.0 ([#1394](https://github.com/panicboat/monorepo/issues/1394)) ([f4ae1f2](https://github.com/panicboat/monorepo/commit/f4ae1f2f182863fde676b5fe6d800acedf652c58))
* **dystopia/frontend:** update dependency eslint to ^10.13.0 ([#1604](https://github.com/panicboat/monorepo/issues/1604)) ([e5a6f8f](https://github.com/panicboat/monorepo/commit/e5a6f8fbf040defb1f0688dd12ce7dfbc282587d))
* **dystopia/frontend:** update dependency eslint-config-next to v16.3.7 ([#1349](https://github.com/panicboat/monorepo/issues/1349)) ([457491a](https://github.com/panicboat/monorepo/commit/457491a2d9230c011842dace2a9da8b506c7a1b9))
* **dystopia/frontend:** update dependency eslint-config-next to v16.3.8 ([#1386](https://github.com/panicboat/monorepo/issues/1386)) ([1c92f00](https://github.com/panicboat/monorepo/commit/1c92f00fecb996e57712fbaf88be736bb5161b1a))
* **dystopia/frontend:** update dependency eslint-config-next to v16.4.0 ([#1422](https://github.com/panicboat/monorepo/issues/1422)) ([cf47f66](https://github.com/panicboat/monorepo/commit/cf47f66f341ee18dec6b1385019a737d9dfdd0a7))
* **dystopia/frontend:** update dependency eslint-config-next to v16.4.2 ([#1590](https://github.com/panicboat/monorepo/issues/1590)) ([7ef03a9](https://github.com/panicboat/monorepo/commit/7ef03a9c2b576025a545590f49b11283f8e4925d))
* **dystopia/frontend:** update dependency eslint-config-next to v16.4.3 ([#1753](https://github.com/panicboat/monorepo/issues/1753)) ([7ab4c35](https://github.com/panicboat/monorepo/commit/7ab4c358079cbd78969c7c32125692641369a5ee))
* **dystopia/frontend:** update dependency happy-dom to ^20.14.6 ([#1526](https://github.com/panicboat/monorepo/issues/1526)) ([6be6413](https://github.com/panicboat/monorepo/commit/6be6413e99125e597d05d161df19556348d90c0c))
* **dystopia/frontend:** update dependency happy-dom to ^21.0.4 ([#1648](https://github.com/panicboat/monorepo/issues/1648)) ([9a7c43c](https://github.com/panicboat/monorepo/commit/9a7c43c5df3d7968feff8cd9b499c98b2814ec7c))
* **dystopia/frontend:** update dependency happy-dom to v21 ([#1577](https://github.com/panicboat/monorepo/issues/1577)) ([44bf970](https://github.com/panicboat/monorepo/commit/44bf970f6305456879fda2aa049c49dde106df15))
* **dystopia/frontend:** update dependency prettier to ^3.9.10 ([#1527](https://github.com/panicboat/monorepo/issues/1527)) ([3f0948f](https://github.com/panicboat/monorepo/commit/3f0948fbf23cb03145a8ef4206ab1895e7395229))
* **dystopia/frontend:** update dependency typescript to v7 ([#1339](https://github.com/panicboat/monorepo/issues/1339)) ([ddb9979](https://github.com/panicboat/monorepo/commit/ddb9979bf83647f0252719c0971680d49d6dc4b1))
* **dystopia/frontend:** update dependency typescript-eslint to ^8.71.0 ([#1362](https://github.com/panicboat/monorepo/issues/1362)) ([6728e6b](https://github.com/panicboat/monorepo/commit/6728e6b807f3e4551ba740252dd4356259b58974))
* **dystopia/frontend:** update dependency typescript-eslint to ^8.71.1 ([#1408](https://github.com/panicboat/monorepo/issues/1408)) ([3cee4cd](https://github.com/panicboat/monorepo/commit/3cee4cd7573cbb56350784992fc072d9768acc1e))
* **dystopia/frontend:** update dependency typescript-eslint to ^8.71.2 ([#1591](https://github.com/panicboat/monorepo/issues/1591)) ([94a4bb2](https://github.com/panicboat/monorepo/commit/94a4bb2d1e0d0c2d8740d58ad36b9f81e27d8af3))
* **dystopia/frontend:** update dependency typescript-eslint to ^8.72.0 ([#1651](https://github.com/panicboat/monorepo/issues/1651)) ([1fd2ab8](https://github.com/panicboat/monorepo/commit/1fd2ab87499e6179e2b6e94f3657b11b0c0b58e3))
* **dystopia/frontend:** update dependency typescript-eslint to ^8.72.1 ([#1841](https://github.com/panicboat/monorepo/issues/1841)) ([864cdfb](https://github.com/panicboat/monorepo/commit/864cdfb6fe6293c986278f8a9a4b3372ea3a65f1))
* **dystopia/frontend:** update dependency vitest to ^5.0.3 ([#1369](https://github.com/panicboat/monorepo/issues/1369)) ([8b19a18](https://github.com/panicboat/monorepo/commit/8b19a183e4b001e78ff0a95cc4ab4a6017f85de0))
* **dystopia/frontend:** update dependency vitest to ^5.0.4 ([#1533](https://github.com/panicboat/monorepo/issues/1533)) ([bc8b33e](https://github.com/panicboat/monorepo/commit/bc8b33ef30db665e184d3852e746174230257abd))
* **dystopia/frontend:** update dependency vitest to ^5.0.5 ([#1592](https://github.com/panicboat/monorepo/issues/1592)) ([879bd17](https://github.com/panicboat/monorepo/commit/879bd17fd22d3a76a5541cddfa6871fd1d4bcf8e))
* **dystopia/frontend:** update dependency vitest to v5 ([#1340](https://github.com/panicboat/monorepo/issues/1340)) ([883ed0f](https://github.com/panicboat/monorepo/commit/883ed0f0196b800da49664ea49a93fb29bec7b56))
* **dystopia/frontend:** update node.js to v24.22.0 ([#1605](https://github.com/panicboat/monorepo/issues/1605)) ([acea765](https://github.com/panicboat/monorepo/commit/acea76539c3c4fd8bb869992aea8cf8904228a21))
* **dystopia/frontend:** update node.js to v24.22.1 ([#1754](https://github.com/panicboat/monorepo/issues/1754)) ([3be2e5b](https://github.com/panicboat/monorepo/commit/3be2e5b72d7f4cd4ca0ecc9012a2a33db9d47786))
* **dystopia/frontend:** update pnpm to v11.28.1 ([#1318](https://github.com/panicboat/monorepo/issues/1318)) ([6ae9db8](https://github.com/panicboat/monorepo/commit/6ae9db8f83bbecd00c6f59df57ba8eec9928e82e))
* **dystopia/frontend:** update pnpm to v12 ([#1341](https://github.com/panicboat/monorepo/issues/1341)) ([f0c8e6c](https://github.com/panicboat/monorepo/commit/f0c8e6c9e71eb62aacb1a3593096060757b6e880))
* **dystopia/frontend:** update pnpm to v12.10.1 ([#1455](https://github.com/panicboat/monorepo/issues/1455)) ([5e80353](https://github.com/panicboat/monorepo/commit/5e80353b3902d35e9a560f45258fc5aed285653a))
* **dystopia/frontend:** update pnpm to v12.11.2 ([#1528](https://github.com/panicboat/monorepo/issues/1528)) ([4cb5eb4](https://github.com/panicboat/monorepo/commit/4cb5eb491a745dee4401b10b613459973d16237f))
* **dystopia/frontend:** update pnpm to v12.14.0 ([#1606](https://github.com/panicboat/monorepo/issues/1606)) ([97cd026](https://github.com/panicboat/monorepo/commit/97cd026f9be8674c15d6df463105ac1df0a73bb1))
* **dystopia/frontend:** update pnpm to v12.15.0 ([#1652](https://github.com/panicboat/monorepo/issues/1652)) ([bd390fb](https://github.com/panicboat/monorepo/commit/bd390fbc986f3db20cc924a03573d9601e52dae4))
* **dystopia/frontend:** update pnpm to v12.16.1 ([#1842](https://github.com/panicboat/monorepo/issues/1842)) ([0cec1a3](https://github.com/panicboat/monorepo/commit/0cec1a3a8ad0887bbd911a8195da5d80ecfff2ef))
* **dystopia/frontend:** update pnpm to v12.8.1 ([#1370](https://github.com/panicboat/monorepo/issues/1370)) ([fa5c2ad](https://github.com/panicboat/monorepo/commit/fa5c2ad7c0816f92f54bee0d746e60d05975015c))
* **frontend:** bump image to ghcr.io/panicboat/monorepo/frontend:v0.10.0 ([a46fca8](https://github.com/panicboat/monorepo/commit/a46fca884a5245316bdfb490b7b669ab32d0567d))

## [0.10.0](https://github.com/panicboat/monorepo/compare/frontend-v0.9.1...frontend-v0.10.0) (2026-09-29)


### Features

* **dystopia/frontend:** navigate to post detail on card tap ([#1294](https://github.com/panicboat/monorepo/issues/1294)) ([da550e1](https://github.com/panicboat/monorepo/commit/da550e19e4e726b0612406c7cc86c0b2618d2265))
* **dystopia/frontend:** open the drawer with a right swipe on mobile ([#1287](https://github.com/panicboat/monorepo/issues/1287)) ([a48fb55](https://github.com/panicboat/monorepo/commit/a48fb55f5cfc714004fd7f17727e38fa3ea3814f))
* **dystopia/frontend:** scroll to top when the home tab is tapped while active ([#1295](https://github.com/panicboat/monorepo/issues/1295)) ([2a186e1](https://github.com/panicboat/monorepo/commit/2a186e1c5e94af2640bdb93e5a9948a67e4ff4d4))
* **dystopia:** add karte and review tabs to Home ([#1297](https://github.com/panicboat/monorepo/issues/1297)) ([b0ace3c](https://github.com/panicboat/monorepo/commit/b0ace3c1dbd585976be2814d1f2a3c3e81d663ce))


### Bug Fixes

* **dystopia/frontend:** remove followers avatar row from home ([#1290](https://github.com/panicboat/monorepo/issues/1290)) ([3912bf5](https://github.com/panicboat/monorepo/commit/3912bf5fa9c27eff1b573bc1b95bc24fcea47ebf))
* **dystopia/frontend:** update dependency next to v16.3.6 ([#1281](https://github.com/panicboat/monorepo/issues/1281)) ([8ca980c](https://github.com/panicboat/monorepo/commit/8ca980cd2ec40e112160fb757301604bf33d97ff))
* **dystopia:** show target identity in review and karte lists ([#1292](https://github.com/panicboat/monorepo/issues/1292)) ([f75485f](https://github.com/panicboat/monorepo/commit/f75485f1d09a4dc77fa8edd004cd36107721818e))

## [0.9.1](https://github.com/panicboat/monorepo/compare/frontend-v0.9.0...frontend-v0.9.1) (2026-09-27)


### Bug Fixes

* **dystopia/frontend:** add karte and review tabs to the footer menu ([#1269](https://github.com/panicboat/monorepo/issues/1269)) ([0480316](https://github.com/panicboat/monorepo/commit/0480316ffb1943bc179b94924a94bb3fbce379ef))
* **dystopia/frontend:** describe a follow notification as being followed ([#1268](https://github.com/panicboat/monorepo/issues/1268)) ([5d2526c](https://github.com/panicboat/monorepo/commit/5d2526cb52914a4ff978577153308380324a9200))
* **dystopia/frontend:** drop removed areas field from PrivacySettings test mock ([#1267](https://github.com/panicboat/monorepo/issues/1267)) ([930f5ba](https://github.com/panicboat/monorepo/commit/930f5bae36ed89bd32ceb56e3b76e3bd7eaf6ce9))
* **dystopia/frontend:** drop the direction word from the profile reviews tab label ([#1266](https://github.com/panicboat/monorepo/issues/1266)) ([140be78](https://github.com/panicboat/monorepo/commit/140be78270ccab240025f8977e3f6d8c0aa9c55e))
* **dystopia/frontend:** drop the standalone oshi menu, link profile counts to it instead ([#1270](https://github.com/panicboat/monorepo/issues/1270)) ([1149c5d](https://github.com/panicboat/monorepo/commit/1149c5d32ea0c811eb301b05dae502989ea79ba3))
* **dystopia/frontend:** explain every main destination's header ([#1265](https://github.com/panicboat/monorepo/issues/1265)) ([a412a35](https://github.com/panicboat/monorepo/commit/a412a35730a02c8e4c84e2575f461711771af92f))
* **dystopia/frontend:** give /u/[username] a self-edit affordance and retire /profile ([#1257](https://github.com/panicboat/monorepo/issues/1257)) ([fb2c830](https://github.com/panicboat/monorepo/commit/fb2c83013fdeaa013be1ad0335c9b96b922dc7ff))
* **dystopia/frontend:** label profiles キャスト/ゲスト instead of セラピスト/ユーザー ([#1264](https://github.com/panicboat/monorepo/issues/1264)) ([eb69e9c](https://github.com/panicboat/monorepo/commit/eb69e9c3c525337f321a2bd95ba6a6305ec5c6e6))
* **dystopia/frontend:** link to the blocked accounts list from settings ([#1256](https://github.com/panicboat/monorepo/issues/1256)) ([82c8f54](https://github.com/panicboat/monorepo/commit/82c8f541e400243a7377156ccf936faee31a0ebc))
* **dystopia/frontend:** show karte link in the desktop side nav ([#1254](https://github.com/panicboat/monorepo/issues/1254)) ([faaf8ad](https://github.com/panicboat/monorepo/commit/faaf8ad246409caf32fef60809760847f74383c5))
* **dystopia/frontend:** stub SocialCountsLinks in u/[username] page test mock ([#1272](https://github.com/panicboat/monorepo/issues/1272)) ([f9117f5](https://github.com/panicboat/monorepo/commit/f9117f5b7f2f36a2bf502683d72017d2604b7fd8))
* **dystopia/frontend:** surface message send failures in the composer ([#1258](https://github.com/panicboat/monorepo/issues/1258)) ([01c44a8](https://github.com/panicboat/monorepo/commit/01c44a8bcdb5708a0b532b0c602850d2544075d9))
* **dystopia:** link comment and reply avatars to author profile ([#1260](https://github.com/panicboat/monorepo/issues/1260)) ([301a742](https://github.com/panicboat/monorepo/commit/301a742a8005380e1cb09418470dd4fc326d755f))
* **dystopia:** reject cross-account likes-list requests ([#1271](https://github.com/panicboat/monorepo/issues/1271)) ([389c27b](https://github.com/panicboat/monorepo/commit/389c27b07f32ed0db05e67759e0f820b1cd44dac))
* **dystopia:** remove unused cast area setting ([#1259](https://github.com/panicboat/monorepo/issues/1259)) ([e08aafa](https://github.com/panicboat/monorepo/commit/e08aafabc5d84fec86c0344591a95c29803bc6a2))

## [0.9.0](https://github.com/panicboat/monorepo/compare/frontend-v0.8.3...frontend-v0.9.0) (2026-09-26)


### Features

* **review:** add Guest→Cast review feature ([#1232](https://github.com/panicboat/monorepo/issues/1232)) ([#1234](https://github.com/panicboat/monorepo/issues/1234)) ([7043d79](https://github.com/panicboat/monorepo/commit/7043d79a7e5f2d0e1718c29b50657035ed264102))


### Bug Fixes

* **dystopia/frontend:** onboarding form loses input and never submits ([#1238](https://github.com/panicboat/monorepo/issues/1238)) ([7981769](https://github.com/panicboat/monorepo/commit/79817692eb6ace7c2e26fb5143c051b57ddbd6f9))

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
