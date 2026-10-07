# Multiple profiles per account

Origin: 「1 ユーザーにつきプロフィールを複数保有できるようにしたい」という依頼(2026-10-08)。トラッキングされた issue は無い。

前提として [`2026-09-23-profile-cast-guest-model-design.md`](./2026-09-23-profile-cast-guest-model-design.md) を読んでいること。`profile.profiles` / `profile.casts` の現在の役割分担は同 spec が定めている。

## Problem

cast は店舗や源氏名ごとに別の人格として活動したいが、現在は構造上 1 ログイン = 1 人格に固定されている。

- `profile.profiles` の PK が `account_id` そのもので、1 account に profile を 2 行持てない。
- `identity.accounts.id` は Cognito の `sub` であり、frontend BFF が `x-user-id` として渡した値を monolith が `Current.user_id` に載せ、全 handler が行為者として使う。つまり「ログインした主体」と「行為する主体」が同じ 1 つの ID になっている。
- 13 slice の行為者カラム(約 30 カラム)と 89 箇所の `current_user_id` 呼び出しが、この同一視に依存している。

## Goal

1 回のログインで複数の独立した人格を持ち、切り替えて活動できる。人格ごとに username・投稿・フォロワー・DM が分かれ、**本人以外からは同一人物の人格同士だと分からない**。

## Decisions

brainstorming で合意した製品判断。

| 論点 | 決定 | 理由 |
|---|---|---|
| 複数人格を持てる role | cast のみ。guest は 1 account 1 profile | guest が紐付かない別人格を持てると、karte に記録された相手が人格を替えて再接触でき、自己防衛の柱が崩れる |
| モデル | account 1 : N profile。行為者 ID を profile に移す | 「ユーザーが複数プロフィールを持つ」という語彙に一致させる |
| karte の記録 | 所有は account、著者表示は書いた人格 | どの人格からでも自分の記録を読める必要がある。一方 karte は cast 間で共有され著者が表示されるため、著者を account にすると紐付きが漏れる |
| ブロック | 人格単位 | 全人格に効かせると、guest が複数人格から同時に弾かれることで紐付きを推測できる |
| 課金 | account 単位のまま | 1 契約で全人格が有効。billing slice は変更しない |
| 人格数の上限 | cast は 5、guest は 1 | account 単位課金のもとで人格を無制限に増やせること、いいね・フォローの水増し、username の大量確保を抑える。5 という値に実測の根拠は無く、運用で見直す |
| 人格の削除 | 無効化(可逆)→ 削除(不可逆)の 2 段階 | 誤操作で人格を失わないようにする |
| 退会後の可視性 | 退会した時点で全人格を他人から見えなくする | 現状は purge まで見えたままになっている(Evidence 参照) |
| 既存データ | 移行しない | まだ運用していないため破壊的変更でよい |

## Target design

### Ownership boundary

行為(投稿・フォロー・DM・閲覧)の主体は profile、権利と責任(ログイン・課金・通報・退会)の主体は account とする。

**account に残るもの**

- `identity.accounts`。`role` も account に置く。cast の account が持つ profile はすべて cast として扱う。
- `billing.customers` / `billing.subscriptions`
- `karte.access`(karte の利用権)
- `karte.reports.reporter_account_id`
- `karte.entries.author_account_id`(所有権)

通報を account 単位に残すのは、通報 3 件で記録に flag が付く(`Karte::UseCases::ListEntriesByTarget::MIN_FLAG_REPORTS`)ためである。人格単位にすると、1 人が人格 3 つで任意の記録を単独で flag でき、自分の記録を別人格から通報することもできてしまう。

**profile に移るもの**

上記以外の行為者カラムすべて。一覧は Schema changes を参照。

**漏洩を防ぐ規則**

`account_id` を返すのは本人向けの identity / billing レスポンスだけとする。他人が取得しうるレスポンスには profile の id だけを載せる。

### Data model

- `profile.profiles` は独自の `id`(uuid)を PK とし、`account_id` は非ユニークな参照にする。`id` は 1 つ目の profile も含めて新規に採番し、account の id と一致させない。
- `username` は従来どおり全体で一意(大文字小文字を区別しない)。
- `profile.profiles.disabled_at` を追加する。null でなければ無効。
- `profile.casts` の PK は `profile_id`。年齢・体型・業種・SNS リンクは人格ごとに持つ。
- 人格数の上限は DB 制約にせず、`CreateProfile` の use case で検査する。運用で変える値のため。無効な人格も数に含める(無効化で上限を回避できないようにする)。

### Request context

操作中の人格はクライアントが保持し、リクエストごとに `x-profile-id` ヘッダで送る。BFF は `buildGrpcHeaders` で monolith へ転送する。

httpOnly cookie に持たせない理由: cookie は全タブ共有のため、タブ 1 で人格を切り替えると、別の人格を表示したままのタブ 2 の操作が切替後の人格として実行される。ヘッダ方式は「画面に出ている人格 = 行為する人格」をタブ単位で保つ。

`AuthenticationInterceptor` の解決規則:

1. `x-user-id` があれば `Current.account_id` に設定する。
2. `x-profile-id` があれば、その profile が存在し、`account_id` が一致し、無効でないことを照合する。満たさなければ `PERMISSION_DENIED` で拒否する。満たせば `Current.profile_id` に設定する。
3. `x-profile-id` が無く、account の有効な profile が 1 つだけなら、それを `Current.profile_id` に設定する。
4. `x-profile-id` が無く、有効な profile が 0 または 2 つ以上なら、`Current.profile_id` は空のままにする。行為者を必要とする RPC は `FAILED_PRECONDITION` を返す。

規則 4 により、曖昧なときに既定の人格へ自動で倒さない。ヘッダの付け忘れは、誤った人格での実行ではなくエラーとして表面化する。

`Grpc::Authenticatable#current_user_id` は削除し、`current_account_id` と `current_profile_id` に分ける。89 箇所の呼び出しごとに、Ownership boundary を基準としてどちらを使うかを選び直す。

認証済みリクエストごとに profile の参照が 1 回増える。

### Role resolution

role は account に置くが、各 slice が手にしているのは行為者である profile の id になる。現在は行為者の id でそのまま `identity.accounts` を引いて role を判定している箇所が identity slice の外に 18 箇所あり、id の種類が変わるとすべて該当なしになる。

profile の id から role を得る入口を profile slice に 1 つ設け(単体と一括の両方)、他 slice はそれを使う。profile slice は `profiles.account_id` を介して `identity.accounts.role` を引く。`ProfileRepository` の `role_filter` も同じ結合に改める。

他 slice が行為者の id で `Identity::Slice["repositories.account_repository"]` を直接引くことはやめる。account の id を扱う billing は従来どおり直接引く。

### API contract

**`profile.v1`**

- `Profile.account_id` を `id`(profile の id)に改名する。
- `Profile` に無効状態を表すフィールドを追加する。`ListMyProfiles` でのみ値が入る。
- 追加する RPC:
  - `ListMyProfiles`: 自分の全人格(無効なものを含む)を返す。
  - `CreateProfile`: 表示名と username を受けて人格を作る。
  - `DisableProfile` / `EnableProfile`
  - `DeleteProfile`
- 追加する 5 つの RPC は account を主体として動作し、操作中の人格を必要としない。対象の profile を引数で受けるものは、その profile が呼び出した account のものであることを照合する。人格が 0 件の onboarding と、人格選択前の状態から呼べる必要があるため。
- `SaveProfile` / `SaveProfileMedia` は操作中の人格の更新専用にする。行が無ければ作る upsert は廃止し、作成は `CreateProfile` に一本化する。
- `GetProfileRequest.account_id` を `profile_id` に改名する。

**その他の proto**

`*account_id` 系のフィールドを `*profile_id` に改名する。フィールド番号は変えない。対象は footprints / karte / messaging / post(post・comment・like)/ review / schedule / social(follow・block)。

**`karte.v1.KarteEntry`**

- `author_account_id` を `author_profile_id` に、`target_account_id` を `target_profile_id` に改名する。
- `is_mine` を追加する。別の人格で書いた自分の記録にも編集・削除を出すための判定で、account を参照できるのは server だけなので server で計算する。

**`identity.v1`**

変更しない。`GetAccount` は本人に account の id と role を返す。

### Profile lifecycle

状態遷移は「有効 ⇄ 無効 → 削除」とする。

**作成**

- guest は 1 つ目のみ、cast は 5 つまで。超過は `FAILED_PRECONDITION`。
- onboarding は `CreateProfile` を呼ぶ。

**無効化(即時・可逆)**

- 無効な人格は操作中の人格に選べない(Request context の規則 2)。
- データと username は保持する。
- 最後の 1 つの有効な人格は無効化できない。guest には無効化の UI を出さない。
- 自動削除のタイマーは付けない。本人が有効に戻すか削除するまで残る。

**削除(即時・不可逆)**

- 無効な人格に対してのみ実行できる。有効な人格への `DeleteProfile` は `FAILED_PRECONDITION`。
- 各 slice の `PurgeAccount` を profile 単位の purge に作り替えて実行する。
- 複数 slice をまたぐため 1 トランザクションにならない。profile の行を最後に消す順序にし、途中で失敗したら人格は無効のまま残り、再実行で続きから消せるようにする。
- karte の記録は残す。所有権が account にあるので、他の人格から引き続き一覧・編集できる。著者表示は空になる。
- username は解放される。

**退会**

- account 単位のまま(停止 → 猶予期間後に purge)。purge は account の全 profile を順に削除する。

### Visibility

規則: **無効な人格、および停止中の account に属する人格は、本人以外からは存在しない人格と同じに見える。**

実現の集約点は 2 つある。

- profile の参照系(id・username・検索・新着・都道府県別)は、該当する人格を返さない。他 slice は表示用の解決に `Profile::UseCases::GetProfile` を使っているため、ここで一括して効く。
- 投稿の可視判定(`Social::UseCases::FilterVisiblePosts` / `ViewerCanSeePost`)は「著者の profile が見つからなければ不可視」に改める。現状は見つからない場合に公開扱いになる。

karte の記録はこの規則の対象外とする。記録そのものは target や著者の状態にかかわらず残り、表示名とアバターだけが空になる。

### Frontend flows

`authStore` は `accountId`・`role`・`activeProfileId` を持つ。「ログイン済みか」の判定は `accountId`、「これは自分か」の比較は `activeProfileId` を使う。`authFetch` が `x-profile-id` を付ける。

| 場面 | 動作 |
|---|---|
| ログイン直後 | `ListMyProfiles` を呼ぶ。有効な人格が 0 件 → onboarding、1 件 → その人格で開始、2 件以上 → 前回の人格が有効な一覧にあればそれ、無ければ人格選択画面 |
| 切替 | `activeProfileId` を更新し、SWR キャッシュと人格依存の store を全消去してトップへ遷移する |
| 追加 | 設定画面から onboarding と同じ入力(表示名・username)で作成し、そのまま切り替える。cast のみ表示 |
| 無効化・有効化・削除 | 設定画面の人格一覧から。削除は無効な人格にのみ表示し、確認ダイアログを挟む |

切替時にキャッシュを消去しないと、前の人格の DM・通知が切替後の画面に残って見える。

### Errors

1 つの status に複数の意味を載せない。

| 状況 | gRPC status |
|---|---|
| `x-profile-id` が他人のもの、存在しない、または無効な人格 | `PERMISSION_DENIED` |
| 行為者が必要な RPC で `Current.profile_id` が空 | `FAILED_PRECONDITION` |
| 上限超過、有効な人格の削除、最後の有効な人格の無効化 | `FAILED_PRECONDITION`(メッセージで区別) |
| username の重複・形式不正 | 既存の `Errors::ValidationError` |

frontend は上 2 つを受けたら `ListMyProfiles` を取り直し、人格選択へ戻す。

## Evidence

コード読解と grep による(REASONED)。実行して確認したものは VERIFIED と明記する。

- `profile.profiles` の PK: `slices/profile/relations/profiles.rb` の `primary_key :account_id`。
- 行為者の入口: `lib/interceptors/authentication_interceptor.rb` が `x-user-id` を `Current.user_id` に設定し、`lib/grpc/authenticatable.rb#current_user_id` がそれを返す。frontend 側は `src/lib/request.ts#buildGrpcHeaders` が Cognito の `sub` を載せる。
- `current_user_id` の呼び出し数(VERIFIED: `grep -rn -c 'current_user_id' monolith/slices`): post 20 / social 15 / review 10 / messaging 8 / karte 8 / notifications 6 / profile 4 / footprints 4 / bookmarks 4 / discovery 3 / billing 3 / schedule 2 / feed 2。
- 行為者の id で role を引いている箇所(VERIFIED: `grep -rn -E 'Identity::Slice\[|identity__accounts|get_user_type' slices` から identity slice を除いた結果): post の `AccountAdapter`、footprints / discovery / social / messaging / notifications / profile の handler、`SuggestUsers`、`SaveProfile`、review と karte の `CreateEntry`、`AuthorizeCastAccess`、`AuthorizeMessage`、`ProfileRepository` の `role_filter`。billing の `CreateCheckoutSession` は account の id で引いており対象外。
- gRPC を呼ぶのは BFF だけ(VERIFIED: `@/lib/grpc` と `buildGrpcHeaders` の参照は `src/app/api/` 配下と `src/lib/` のみ)。79 route 中 74 が `buildGrpcHeaders` を通る。
- frontend は `authStore.userId` を「ログイン済みか」と「閲覧者の id」の両方に使っている。後者は `FollowButton` / `BlockButton` / `CommentList` / `ReplyList` / `AppShell` / `u/[username]/page.tsx` / `messages/[id]/page.tsx` などの `viewerId`。
- karte は cast 間で共有され著者が表示される: `slices/karte/use_cases/list_entries_by_target.rb` が `author_username` / `author_avatar_url` を返す。
- 退会は可視性に影響していない(VERIFIED: `grep -rn 'deactivated' slices lib` の結果は identity slice 内の書き込みと presenter のみ)。停止中の account の profile と投稿は purge まで他人から見える。
- 退会の purge は karte の記録を消さない: `slices/karte/use_cases/purge_account.rb` は利用権と通報だけを消す。
- 課金は account 単位で、価格は role で決まる: `slices/billing/plan_registry.rb`。
- `gh stack`(VERIFIED): `github/gh-stack` v0.1.1 が導入済み。PR 系 workflow は `branches: '**'` のため base が `main` でない PR でも CI が走る。リポジトリは squash merge のみ許可。

## Schema changes

既存行の整合は保たない。migration はスキーマ変更だけを行い、ローカルは seed で作り直す。

| table | 変更 |
|---|---|
| `profile.profiles` | PK を `id` に変更、`account_id` を非ユニークな参照に変更、`disabled_at` を追加 |
| `profile.casts` | `user_id` → `profile_id` |
| `post.posts` | `author_id` → `author_profile_id` |
| `post.comments` | `user_id` → `author_profile_id` |
| `post.likes` / `post.post_mentions` / `post.comment_mentions` | `account_id` → `profile_id` |
| `social.follows` | `follower_id` / `followee_id` → `follower_profile_id` / `followee_profile_id` |
| `social.blocks` | `blocker_id` / `blocked_id` → `blocker_profile_id` / `blocked_profile_id` |
| `messaging.threads` | `account_a` / `account_b` → `profile_a` / `profile_b` |
| `messaging.messages` | `sender_id` → `sender_profile_id` |
| `messaging.read_states` | `account_id` → `profile_id` |
| `notifications.notifications` | `recipient_id` / `latest_actor_id` → `recipient_profile_id` / `latest_actor_profile_id` |
| `notifications.preferences` | `account_id` → `profile_id` |
| `footprints.visits` | `visitor_id` / `visited_id` → `visitor_profile_id` / `visited_profile_id` |
| `footprints.read_states` / `bookmarks.bookmarks` / `schedule.schedules` / `review.cast_settings` | `account_id` → `profile_id` |
| `review.entries` | `author_account_id` / `target_account_id` → `author_profile_id` / `target_profile_id` |
| `media.files` | `uploader_account_id` → `uploader_profile_id` |
| `karte.entries` | `author_profile_id` を追加、`target_account_id` → `target_profile_id`。`author_account_id` は維持 |

`identity.*` / `billing.*` / `karte.access` / `karte.reports` は変更しない。

`media.files` を profile 側に置くのは、人格を削除するときにその人格がアップロードしたファイルを辿るためである。

## Testing strategy

- CI は rspec を回さないため、ローカルでの `bundle exec rspec` 全体実行を判定基準とする。Delivery の各段の完了条件に含める。
- fixture は account の id と profile の id を必ず別の値にする。同じ値にすると、両者を取り違えたコードがテストを通過する。
- 漏洩の静的検査: proto の descriptor を走査し、名前に `account_id` を含むフィールドが identity / billing 以外に無いことを spec で検証する。
- `AuthenticationInterceptor` の解決規則 4 通りと、他人の profile・無効な profile の拒否。
- ライフサイクル: 上限、最後の有効な人格の無効化の拒否、有効な人格の削除の拒否、削除後に karte の記録が残り所有者が読めること。
- 可視性: 無効な人格と停止中の account の人格が、Open questions で列挙する読み取り経路ごとに他人から見えないこと。
- karte: 別人格で書いた記録が `ListMyEntries` に含まれ `is_mine` が真になること、同一 account の別人格から通報できないこと。
- frontend: `pnpm exec tsc --noEmit` と `pnpm exec vitest run`。`pnpm lint` は ESLint 10 の問題で使えない。
- 最後に人格 2 つでローカル実機確認を行う(投稿・DM・切替・無効化・削除)。

## Delivery

`gh stack` で 1 本の stack に積み、`gh stack merge --squash` でまとめて merge する。途中の段では「カラム名は `account_id` だが値は profile の id」という状態を通るが、まとめて merge するため `main` には現れない。plan は段ごとに 1 本書く。

意味の切替は最下段の 1 箇所で済ませる。段 1 で `current_user_id` が profile の id を返すようになり、全 slice が同じ入口から同じ種類の id を受け取るので、slice 間で id の種類が食い違う期間が無い。

| 段 | 内容 |
|---|---|
| 1 | profile モデル(`id` / `account_id` / `disabled_at`、`casts.profile_id`)、interceptor の解決規則、`Current` の分割、`ListMyProfiles` / `CreateProfile`。`current_user_id` が profile の id を返すように変え、billing・identity など account が必要な箇所を `current_account_id` に替える。profile の id から role を得る入口を設け、行為者の id で role を引いている全箇所を切り替える。frontend は `authStore` の分割、`x-profile-id` の送信、onboarding の `CreateProfile` 化 |
| 2 | karte: 所有権と著者表示の分離、通報の account 単位化、`is_mine` |
| 3 | post の改名(カラム・proto・`current_user_id` → `current_profile_id`・BFF と frontend) |
| 4 | social の改名 |
| 5 | messaging / notifications の改名 |
| 6 | footprints / bookmarks / schedule / media の改名 |
| 7 | review / discovery / feed の改名 |
| 8 | ライフサイクルと可視判定(`DisableProfile` / `EnableProfile` / `DeleteProfile`、profile 単位の purge、退会時の非表示)、`current_user_id` の削除、proto の静的検査 |
| 9 | frontend の切替・追加・無効化・有効化・削除の UI、切替時のキャッシュ消去 |

段 3〜7 は挙動を変えない改名とする。各段の完了条件は、ローカルの rspec 全体と frontend の `tsc` / `vitest` が通ることである。

`gh stack` は v0.1.1 の初期版である。挙動に問題があれば `gh pr create --draft --base <下段のブランチ>` に切り替える。`gh stack submit --auto` が生成する PR タイトルは `semantic-pull-request` を通る保証が無いため、作成後に conventional な英語タイトルへ直す。

## Accepted risks

- いいね・フォローは人格単位のため、1 人が最大 5 人格ぶんの反応を付けられる。「本人以外から同一人物と分からない」要件と両立する検知手段が無いため、上限数で抑えるに留める。
- 人格ごとに別々にブロックする必要がある。ある人格でブロックした相手は、別の人格には引き続き接触できる。

## Out of scope

- guest の複数人格。
- 人格単位の課金、人格数に応じた料金。
- 人格間でのデータの移動・統合(フォロワーの引き継ぎ等)。
- 無効な人格の自動削除。
- 管理者が人格同士の紐付きを調べる手段。

## Open questions to confirm during planning

- `authFetch` を通らず素の `fetch` で BFF を呼ぶ箇所(`useAuth` の `meFetcher` 等)の全量。段 1 の plan 作成時に列挙し、行為を伴うものは `authFetch` に寄せる。
- Visibility の 2 つの集約点で隠れない読み取り経路の全量。無効な人格が他人の投稿に付けたコメント、DM スレッドの相手表示、通知、review の記録、いいね数が候補。段 8 の plan 作成時に slice ごとに列挙し、経路ごとに規則を満たす実装とテストを決める。
- karte の編集・削除の可否を frontend が現在どう判定しているか。`is_mine` の追加で置き換えられることを段 2 の plan 作成時に確認する。
- 切替 UI の置き場所。既存ナビゲーション(`AppShell`)の構成を読んで段 9 の plan で決める。
- `profile.casts` を必要とする他 slice の参照(`cast_repository` を footprints / discovery / social / messaging / notifications の handler が使っている)が、`profile_id` への変更でどこまで影響を受けるか。段 1 の plan 作成時に確認する。
