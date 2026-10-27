# Dystopia ready fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project 5 の Ready の fix 11 件を、1 issue = 1 branch の gh stack として直す。

**Architecture:** 各 task が stack の 1 段（1 branch・1 commit）になる。monolith（Hanami 2 + ROM + gruf）の use case / repository と、frontend（Next.js 16）の route を直し、各段で `dystopia/docs/features/` の仕様書を同じ commit に含める。

**Tech Stack:** Ruby 3.4 / Hanami / ROM-SQL / Sequel / gruf / RSpec、TypeScript / Next.js 16 / vitest、protobuf（buf）。

**Spec:** `docs/superpowers/specs/2026-10-27-dystopia-ready-fixes-design.md`

## Global Constraints

- コード内の要素（変数名・関数名・コメント・commit message）は英語。仕様書の本文は日本語で、1 文 1 行、箇条書きは 1 項目 1 文で補足は下の階層。
- コメントは 1 行に収め、"why not" だけを書く。現在の issue・修正への言及は書かない。
- フォールバックには `# FALLBACK:`、意図的な握りつぶしには `# SILENT:` を付ける。
- commit は `git commit -s` で作り、`Co-Authored-By` を付けない。commit message は Conventional Commits（`fix(dystopia/monolith): ...` 等、既存の log に合わせる）。
- 頼まれていない依存関係を追加しない。周辺コードのリファクタをしない。
- monolith の検証: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec <spec> > /tmp/rspec.txt 2>&1; grep -E '^[0-9]+ examples' /tmp/rspec.txt`（stderr の warning が多いので必ずファイルへ redirect する）。
- frontend の検証: `cd dystopia/frontend && pnpm exec vitest run <file>` と `env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false`（exit code はパイプせずに取る）。
- 同じ example で作った複数行を順序つきで比べない（`contain_exactly` を使う）。DB を使う spec を足したら 5 回繰り返して結果が変わらないことを確かめる。
- 完了報告の前に、追加したコメントをすべて上の規約と突き合わせ、違反を消す。

## Review Focus

1. 未ログイン（`current_profile_id` が nil）の閲覧者: いいね数・コメント数・一覧は今までどおり返る（Task 6、Task 10 の spec で確認）。
2. 閲覧できない行だけが 1 ページ分以上続く一覧: 見える行で埋まり、`has_more` は見える行の有無だけで決まる（Task 10 の spec で確認）。
3. 同じ人がいいねを取り消して押し直す: 通知の件数も未読も Web Push も変わらない（Task 9 の spec で確認）。
4. エリアタブで閲覧者のプロフィールに都道府県がない: 今と同じ `INVALID_ARGUMENT` になる（Task 2 の spec で確認）。
5. `COGNITO_ADAPTER` が空文字: 未設定と同じく例外になる（Task 1 の test で確認）。

## Stack Mechanics

- 作業場所は `.worktrees/fix-dystopia-cognito-adapter-fail-closed`。Task 1 はいまの branch `fix/dystopia-cognito-adapter-fail-closed` で行う。
- Task 1 の commit の後に `gh stack init fix/dystopia-cognito-adapter-fail-closed` を実行する。
- Task 2 以降は、各 task の最初に `gh stack add <その task の branch>` を実行してから作業する。
- push と Draft PR の作成は全 task の後にまとめて行う（Task 12）。

---

### Task 1: #1801 Cognito adapter must be explicit

**Branch:** `fix/dystopia-cognito-adapter-fail-closed`

**Files:**
- Modify: `dystopia/frontend/src/lib/cognito/adapter.ts`
- Modify: `dystopia/frontend/src/lib/cognito/jwks.ts`
- Create: `dystopia/frontend/src/lib/cognito/adapter.test.ts`
- Modify: `dystopia/frontend/src/lib/cognito/jwks.test.ts`
- Modify: `dystopia/frontend/docker-compose.yaml`（`environment` に `COGNITO_ADAPTER=fake`）
- Modify: `dystopia/README.md`（Dev mode と Production mode の起動コマンドに `COGNITO_ADAPTER=fake` を付け、seed の説明 `:220-223` を「`COGNITO_ADAPTER=fake` で起動すると seed した account で sign-in できる」に書き換える）
- Modify: `dystopia/frontend/README.md`（Environment Variables の表に `COGNITO_ADAPTER` の行を足す: `aws` か `fake`、既定なし、必須）
- Add: `docs/superpowers/specs/2026-10-27-dystopia-ready-fixes-design.md` と この plan

**Interfaces:**
- Produces: `cognitoAdapterKind(): "aws" | "fake"`（`adapter.ts` から export。値が `aws` / `fake` 以外なら `Error("COGNITO_ADAPTER must be \"aws\" or \"fake\"")` を投げる）。`cognito()` と `verifyAccessToken()` はこれで分岐する。

- [ ] **Step 1: Write the failing tests**

`adapter.test.ts`（`process.env.COGNITO_ADAPTER` を各 test で設定し、`afterEach` で元に戻して `_resetCognitoInstance()` を呼ぶ）:
- `it("throws when COGNITO_ADAPTER is unset")`: `delete process.env.COGNITO_ADAPTER` → `expect(() => cognito()).toThrow('COGNITO_ADAPTER must be "aws" or "fake"')`
- `it("throws when COGNITO_ADAPTER is empty")`: `""` → 同じ例外
- `it("throws when COGNITO_ADAPTER is unknown")`: `"local"` → 同じ例外
- `it("returns the fake adapter when COGNITO_ADAPTER is fake")`: `"fake"` → `cognito().signUp` が関数

`jwks.test.ts` に追加:
- `it("rejects every token when COGNITO_ADAPTER is unset")`: fake で発行したトークンを、`delete process.env.COGNITO_ADAPTER` の後に `verifyAccessToken` → `rejects.toThrow('COGNITO_ADAPTER must be "aws" or "fake"')`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && pnpm exec vitest run src/lib/cognito/adapter.test.ts src/lib/cognito/jwks.test.ts`
Expected: 新しい 4 件が FAIL（今は偽の実装が返るため）

- [ ] **Step 3: Implement `cognitoAdapterKind()` and use it in `cognito()` and `verifyAccessToken()`**

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm exec vitest run src/lib/cognito src/app/api/identity src/lib/request.test.ts` と `env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false`
Expected: 全件 PASS、tsc exit 0

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend dystopia/README.md docs/superpowers
git commit -s -m "fix(dystopia/frontend): require COGNITO_ADAPTER to be aws or fake"
gh stack init fix/dystopia-cognito-adapter-fail-closed
```

### Task 2: #1802 Area feed uses the viewer's prefecture

**Branch:** `fix/dystopia-feed-area-own-prefecture`

**Files:**
- Modify: `proto/dystopia/feed/v1/feed_service.proto`（`ListFeedRequest` の `string prefecture = 4;` を削除し `reserved 4; reserved "prefecture";` を置く）
- Regenerate: `dystopia/monolith/bin/codegen` と `cd dystopia/frontend && pnpm proto:gen`。feed の stub 以外の差分は `git checkout --` で戻し、未追跡の `dystopia/frontend/src/stub/billing` は消す。
- Modify: `dystopia/monolith/slices/feed/use_cases/list_feed.rb`
- Modify: `dystopia/monolith/slices/feed/grpc/handler.rb:38-44, 49-55`
- Modify: `dystopia/frontend/src/app/api/feed/route.ts:16, 21`
- Modify: `dystopia/frontend/src/modules/feed/hooks/useFeed.ts:33`（`params.set("prefecture", ...)` を削除。`prefecture` オプションは、エリアタブを取得しない判定と再取得の依存にだけ残す）
- Modify: `dystopia/docs/features/feed-and-ranking.md`（エリアの都道府県はサーバーが閲覧者のプロフィールから決めること、都道府県がないと取得できず画面は案内を出すことを書く）
- Test: `dystopia/monolith/spec/slices/feed/use_cases/list_feed_spec.rb`、`dystopia/frontend/src/app/api/feed/route.test.ts`（なければ作る）

**Interfaces:**
- Produces: `Feed::UseCases::ListFeed#call(filter:, viewer_profile_id:, limit: DEFAULT_LIMIT, cursor: nil)`（`prefecture:` を削除）。`ListFeed::PrefectureRequired < StandardError` を投げる。閲覧者の都道府県は `Profile::Slice["use_cases.get_profile"].call(profile_id: viewer_profile_id)&.prefecture`。
- handler は `PrefectureRequired` を `GRPC::BadStatus(INVALID_ARGUMENT, "prefecture is required for AREA filter")` に変換する。

- [ ] **Step 1: Write the failing specs**

`list_feed_spec.rb` の既存のエリアの 2 例から `prefecture:` 引数を外し、次を足す:
- `it "uses the viewer's own prefecture for the area feed"`: 東京都の author と大阪府の author が投稿し、東京都の viewer で `uc.call(filter: "area", viewer_profile_id: viewer)` → 東京都の author の投稿だけを含み、大阪府の author の投稿を含まない
- `it "raises PrefectureRequired when the viewer has no prefecture"`: 都道府県なしの viewer → `expect { ... }.to raise_error(Feed::UseCases::ListFeed::PrefectureRequired)`

`route.test.ts`:
- `it("does not forward a prefecture query to the feed service")`: `?filter=area&prefecture=大阪府` で `feedClient.listFeed` が `expect.not.objectContaining({ prefecture: expect.anything() })` で呼ばれる

- [ ] **Step 2: Run to verify they fail**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/feed > /tmp/rspec.txt 2>&1` と `pnpm exec vitest run src/app/api/feed`
Expected: 新しい例が FAIL

- [ ] **Step 3: Change the proto, regenerate stubs, and implement**

- [ ] **Step 4: Run the specs, vitest, and tsc**

Expected: `spec/slices/feed` 0 failures、vitest PASS、tsc exit 0

- [ ] **Step 5: Commit**

```bash
gh stack add fix/dystopia-feed-area-own-prefecture   # run before Step 1
git add proto dystopia
git commit -s -m "fix(dystopia): derive the area feed prefecture from the viewer's profile"
```

### Task 3: #1799 Karte list for an invisible target

**Branch:** `fix/dystopia-karte-inactive-target`

**Files:**
- Modify: `dystopia/monolith/slices/karte/errors.rb`（`class NotFound < StandardError; end` を追加）
- Modify: `dystopia/monolith/slices/karte/use_cases/list_kartes_by_target.rb`
- Modify: `dystopia/monolith/slices/karte/grpc/karte_handler.rb`（`wrap_errors` に `rescue Karte::Errors::NotFound => e` → `fail!(:not_found, :not_found, e.message)`）
- Modify: `dystopia/docs/features/karte.md:64-67`（他人から見えないゲストを対象にカルテ一覧を求めると NotFound になることを書く）
- Test: `dystopia/monolith/spec/slices/karte/use_cases/list_kartes_spec.rb`

**Interfaces:**
- Consumes: `Profile::Slice["use_cases.get_profile"].call(profile_id:)`（他人から見えるプロフィールだけを返し、ほかは nil）
- Produces: `ListKartesByTarget#call` は、`Ids.valid?` の後で対象が見えなければ `Errors::NotFound, "Unknown profile"` を投げる

- [ ] **Step 1: Write the failing specs**

- `it "raises NotFound for a disabled guest"`: 対象ゲストの `disabled_at` を入れる → `raise_error(Karte::Errors::NotFound)`
- `it "raises NotFound for a guest whose account is deactivated"`: 対象のアカウントの `deactivated_at` を入れる → 同上
- 既存の「有効なゲストで一覧と集計が返る」例が通り続けること

- [ ] **Step 2: Run to verify they fail** — `spec/slices/karte` で新しい 2 例が FAIL

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run** — `spec/slices/karte` 0 failures

- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-karte-inactive-target`（Step 1 の前）、`git commit -s -m "fix(dystopia/monolith): hide the karte list of a target others cannot see"`

### Task 4: #1724 Unicode whitespace counts as blank

**Branch:** `fix/dystopia-unicode-blank`

**Files:**
- Create: `dystopia/monolith/lib/text.rb`
- Modify: `dystopia/monolith/slices/profile/use_cases/create_profile.rb:48`、`save_profile.rb:55`
- Modify: `dystopia/monolith/slices/karte/use_cases/validate_event.rb:21`、`dystopia/monolith/slices/review/use_cases/validate_event.rb:21`
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb:66`、`dystopia/monolith/slices/post/use_cases/comments/add_comment.rb:24`
- Modify: `dystopia/monolith/slices/messaging/use_cases/send_message.rb:26`
- Modify: `dystopia/monolith/slices/schedule/use_cases/save_schedule.rb:22`（`Text.strip`）
- Modify: `dystopia/frontend/src/modules/profile/components/ProfileNameForm.tsx`（送信前に `displayName.trim()` が空なら `setError("表示名を入力してください")` で止める）
- Modify: `dystopia/docs/features/profiles.md:25`、`karte.md:27`、`reviews.md:105`（全角スペースなど Unicode の空白だけの入力は空として扱う）。コメント・メッセージ・投稿・予定の仕様書に空白の扱いの記述があれば同じく揃える。
- Test: `dystopia/monolith/spec/lib/text_spec.rb`、各 use case の既存 spec、`ProfileNameForm.test.tsx`（なければ作る）

**Interfaces:**
- Produces: `Text.blank?(value) -> Boolean`（nil、または `/\A[[:space:]]*\z/` に一致すれば true）、`Text.strip(value) -> String`（`value.to_s` の前後の `[[:space:]]` を除く）。`lib/text.rb` は `module Text; module_function ...` とし、使う側は `require "text"` する（`lib/concerns/cursor_pagination.rb` を `require "concerns/cursor_pagination"` で読むのと同じ形）。
- コメント・メッセージは issue に挙がっていないが、Goal の「入力の種類によらず揃う」に含めて同じ判定にする。

- [ ] **Step 1: Write the failing specs**

`text_spec.rb`:
- `Text.blank?("　　")` → true、`Text.blank?(" \t ")` → true、`Text.blank?(nil)` → true、`Text.blank?("　a")` → false
- `Text.strip("　さくら　")` → `"さくら"`

各 use case（既存 spec のファイルに追加）:
- 表示名 `"　"` で作成・保存 → `Errors::ValidationError`（"表示名は必須です"）
- 補足が必須の結果で note `"　"` → `Errors::Invalid`（"Note required for this outcome"）（カルテとクチコミ）
- 投稿本文 `"　"` → `INVALID_ARGUMENT`、コメント本文 `"　"`（メディアなし）→ `EmptyContentError`、メッセージ `"　"` → `EmptyContentError`
- 予定のひとこと: `"　" * 5 + "a" * 200` は上限内として保存でき、保存値は `"a" * 200`

`ProfileNameForm.test.tsx`:
- `it("does not submit a display name of only full-width spaces")`: 表示名 `"　"` で送信 → `onSubmit` が呼ばれず、`表示名を入力してください` が表示される

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement `lib/text.rb` and replace each `strip.empty?` / `.strip` listed above**

- [ ] **Step 4: Run** — 変更した slice の spec と `spec/lib/text_spec.rb` が 0 failures、vitest PASS、tsc exit 0

- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-unicode-blank`（Step 1 の前）、`git commit -s -m "fix(dystopia): treat Unicode whitespace as blank input"`

### Task 5: #1795 Profile operations from a deactivated account

**Branch:** `fix/dystopia-deactivated-account-profile-ops`

**Files:**
- Modify: `dystopia/monolith/lib/grpc/authenticatable.rb`（定数 `ACCOUNT_DEACTIVATED_REASON = "account_deactivated"` を追加）
- Modify: `dystopia/monolith/slices/profile/grpc/profile_handler.rb`（`create_profile`・`disable_profile`・`enable_profile`・`delete_profile` の `authenticate_account!` を `authenticate_active_account!` に替える）
- Modify: `dystopia/docs/features/account.md:103-104`（`:104` の例外の行を削除）
- Test: `dystopia/monolith/spec/slices/profile/grpc/profile_lifecycle_spec.rb`

**Interfaces:**
- Produces: `ProfileHandler#authenticate_active_account!`（private）。`authenticate_account!` の後に `::Identity::Slice["repositories.account_repository"].find_by_id(current_account_id)` を引き、`deactivated_at` があれば `GRPC::BadStatus.new(FAILED_PRECONDITION, "Account is deactivated", ERROR_REASON_METADATA_KEY => ACCOUNT_DEACTIVATED_REASON)` を投げる。アカウントの行がないときは今の動き（各 use case の扱い）に任せる。

- [ ] **Step 1: Write the failing specs**

`profile_lifecycle_spec.rb` に `describe "from a deactivated account"` を足し、`before { db[:identity__accounts].where(id: account_id).update(deactivated_at: Time.now) }` の下で:
- create・disable・enable・delete の 4 RPC がそれぞれ `status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)` で、`e.metadata["error-reason"]` が `"account_deactivated"`
- disable の後もプロフィールの `disabled_at` が変わらない

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run** — `spec/slices/profile` 0 failures

- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-deactivated-account-profile-ops`（Step 1 の前）、`git commit -s -m "fix(dystopia/monolith): reject profile lifecycle RPCs from a deactivated account"`

### Task 6: #1796 Post counts exclude the viewer's blocks

**Branch:** `fix/dystopia-post-counts-exclude-blocked`

**Files:**
- Modify: `dystopia/monolith/slices/post/repositories/like_repository.rb:6-18`
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb:191-192, 214-215`
- Modify: `dystopia/monolith/slices/post/grpc/like_handler.rb:44, 51`
- Modify: `dystopia/monolith/slices/post/use_cases/posts/list_posts_by_ids.rb:25-26`
- Modify: `dystopia/docs/features/posts.md`（`:127` の近くに、コメント数・いいね数から閲覧者がブロックしている相手の分を除くことを書く）
- Test: `dystopia/monolith/spec/slices/post/` の該当 spec（repository と、投稿の表示・フィードのハイドレーションを通る spec）

**Interfaces:**
- Produces: `LikeRepository#likes_count(post_id:, exclude_profile_ids: nil)`、`#likes_count_batch(post_ids:, exclude_profile_ids: nil)`（`comment_repository.rb:108-125` の `exclude_author_profile_ids` と同じ形で `profile_id` を除く）。
- 除外する id は閲覧者がブロックした相手だけ（`Post::Adapters::BlockAdapter#blocked_ids(profile_id:)`、handler では既存の `get_blocked_profile_ids`）。`ListPostsByIds` は `viewer_profile_id` があるときだけ `Post::Adapters::BlockAdapter.new.blocked_ids` を引き、nil なら `[]`。

- [ ] **Step 1: Write the failing specs**

- repository: `likes_count(post_id:, exclude_profile_ids: [blocked])` が blocked のいいねを数えない
- `ListPostsByIds`: viewer が commenter と liker をブロックしている → その投稿の proto の `comments_count` と `likes_count` が 0、viewer なし（nil）→ 1 と 1
- like_post の応答の `likes_count` が、閲覧者がブロックした相手のいいねを含まない

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run** — `spec/slices/post` と `spec/slices/feed` と `spec/slices/discovery` が 0 failures

- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-post-counts-exclude-blocked`（Step 1 の前）、`git commit -s -m "fix(dystopia/monolith): exclude blocked profiles from post like and comment counts"`

### Task 7: #1797 Footprint unread count excludes blocks

**Branch:** `fix/dystopia-footprint-unread-exclude-blocked`

**Files:**
- Modify: `dystopia/monolith/slices/footprints/repositories/footprints_repository.rb:36-41`
- Modify: `dystopia/monolith/slices/footprints/use_cases/get_unread_count.rb`
- Modify: `dystopia/docs/features/footprints.md:51-52`（未読数は一覧に出る訪問だけを数え、一覧と一致する）
- Test: `dystopia/monolith/spec/slices/footprints/` の未読数の spec

**Interfaces:**
- Produces: `FootprintsRepository#count_unread(profile_id:, exclude_visitor_profile_ids: [])`。`GetUnreadCount#call(profile_id:)` は `Social::Slice["repositories.block_repository"].bidirectionally_blocked_profile_ids(profile_id:)` を渡す（`list_footprints.rb:48-50` と同じ取り方）。

- [ ] **Step 1: Write the failing spec** — 閲覧者がブロックした訪問者と、閲覧者をブロックした訪問者と、普通の訪問者が訪問 → 未読数が 1
- [ ] **Step 2: Run to verify it fails**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** — `spec/slices/footprints` 0 failures
- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-footprint-unread-exclude-blocked`（Step 1 の前）、`git commit -s -m "fix(dystopia/monolith): exclude blocked visitors from the footprint unread count"`

### Task 8: #1798 Unread counts exclude invisible senders

**Branch:** `fix/dystopia-unread-exclude-inactive-senders`

**Files:**
- Modify: `dystopia/monolith/slices/messaging/repositories/messaging_repository.rb:139-160`（`total_unread_count` に送信者の絞り込みを足し、`counterpart_profile_ids` を追加）
- Modify: `dystopia/monolith/slices/messaging/use_cases/get_total_unread_count.rb`
- Modify: `dystopia/monolith/slices/messaging/use_cases/list_threads.rb:30, 38`、`get_thread.rb:36`、`get_or_create_thread.rb:43`
- Modify: `dystopia/monolith/slices/notifications/repositories/notification_repository.rb:39-41`
- Modify: `dystopia/monolith/slices/notifications/use_cases/get_unread_count.rb`、`list_notifications.rb:32`
- Modify: `dystopia/docs/features/notifications.md:33`、`dystopia/docs/features/messages.md:39`
- Test: `dystopia/monolith/spec/slices/messaging/`、`dystopia/monolith/spec/slices/notifications/` の該当 spec

**Interfaces:**
- 「他人から見える」の判定は `Profile::Slice["use_cases.list_visible_profile_ids"].call(profile_ids:)` だけを使う（無効化・退会中を除く）。
- Produces (messaging):
  - `MessagingRepository#counterpart_profile_ids(profile_id:) -> Array<String>`（閲覧者が参加するスレッドの相手。nil は除く）
  - `MessagingRepository#total_unread_count(profile_id:, sender_profile_ids:)`（`sender_profile_ids` が空なら 0、それ以外は SQL に `AND m.sender_profile_id = ANY(?::uuid[])` 相当の条件を足す）
  - `GetTotalUnreadCount#call(profile_id:)` が相手を見える id に絞って repository を呼ぶ。`ListThreads` の `total_unread_count` はこの use case を使う。
  - スレッドごとの `unread_count` は、相手（`counterpart`）が nil なら 0、それ以外は今の `messaging_repo.unread_count`。
- Produces (notifications):
  - `NotificationRepository#unread_actor_profile_ids(recipient_profile_id:) -> Array<String>`、`#count_unread(recipient_profile_id:, actor_profile_ids:)`（`latest_actor_profile_id` が `actor_profile_ids` に含まれる未読行を数える）
  - `Notifications::UseCases::GetUnreadCount#call(recipient_profile_id:)` が見える発火者に絞って数える。`ListNotifications` の `unread_count` はこの use case を使う。

- [ ] **Step 1: Write the failing specs**

- DM: 2 人の相手 A・B から未読 1 件ずつ、B のプロフィールを無効化 → 合計の未読数 1、B とのスレッドの `unread_count` 0。B のアカウントを退会中にしても同じ。B を有効に戻すと合計 2。
- 通知: A と B が発火した未読の通知が 1 行ずつ、B を無効化 → `GetUnreadCount` 1、`ListNotifications` の `unread_count` 1

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** — `spec/slices/messaging` と `spec/slices/notifications` が 0 failures
- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-unread-exclude-inactive-senders`（Step 1 の前）、`git commit -s -m "fix(dystopia/monolith): count unread messages and notifications only from visible senders"`

### Task 9: #1735 Notification actor count counts people

**Branch:** `fix/dystopia-notification-distinct-actors`

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261103000000_add_actor_profile_ids_to_notifications.rb`
- Modify: notifications の relation（`dystopia/monolith/slices/notifications/relations/` の notifications の schema に `actor_profile_ids` を追加。infer していなければ）
- Modify: `dystopia/monolith/slices/notifications/repositories/notification_repository.rb:10-30`
- Modify: `dystopia/monolith/slices/notifications/use_cases/emit.rb`
- Modify: `dystopia/docs/features/notifications.md:24`
- Test: `dystopia/monolith/spec/slices/notifications/use_cases/emit_spec.rb`

**Interfaces:**
- Migration: `notifications.notifications` に `actor_profile_ids uuid[] NOT NULL DEFAULT '{}'` を足し、`UPDATE notifications.notifications SET actor_profile_ids = ARRAY[latest_actor_profile_id]` で既存行を埋める。`actor_count` は直さない。`down` は列の削除。structure.sql は更新しない。
- `NotificationRepository#emit(...)` の SQL:
  - INSERT 時は `actor_profile_ids = ARRAY[?]::uuid[]`
  - `ON CONFLICT ... DO UPDATE SET` に `actor_profile_ids = array_append(notifications.notifications.actor_profile_ids, EXCLUDED.latest_actor_profile_id)` を足し、`WHERE NOT (EXCLUDED.latest_actor_profile_id = ANY(notifications.notifications.actor_profile_ids))` を付ける
  - 同じ発火者なら行は変わらず `RETURNING` は空になり、`emit` は nil を返す
- `Emit#call` は、repository が nil を返したら `send_push` を呼ばずに nil を返す。

- [ ] **Step 1: Write the failing specs**

`emit_spec.rb`:
- 同じ actor が同じ受信者・種類・対象に 2 回 emit → 行の `actor_count` 1、2 回目の後に `read_at` を入れておいた場合はそのまま、`send_push` は 1 回だけ呼ばれる
- 別の actor が 2 人 emit → `actor_count` 2、`latest_actor_profile_id` は 2 人目、`send_push` 2 回
- A → B → A の順 → `actor_count` 2、`latest_actor_profile_id` は B

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Write the migration, run `HANAMI_ENV=test bundle exec hanami db migrate`, and implement**
- [ ] **Step 4: Run** — `spec/slices/notifications` と `spec/slices/post` と `spec/slices/social` が 0 failures
- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-notification-distinct-actors`（Step 1 の前）、`git commit -s -m "fix(dystopia/monolith): count each notification actor once"`

### Task 10: #1794 has_more after visibility filtering

**Branch:** `fix/dystopia-has-more-after-visibility`

**Files:**
- Create: `dystopia/monolith/lib/concerns/visible_page.rb`
- Modify（9 箇所）:
  - `dystopia/monolith/slices/post/grpc/post_handler.rb:30-52`（投稿一覧）
  - `dystopia/monolith/slices/discovery/use_cases/search_posts.rb`
  - `dystopia/monolith/slices/feed/use_cases/list_feed.rb` と `dystopia/monolith/slices/feed/grpc/handler.rb:57-65`
  - `dystopia/monolith/slices/post/use_cases/comments/list_comments.rb`、`list_replies.rb`、`list_comments_by_author.rb`
  - `dystopia/monolith/slices/post/use_cases/likes/list_liked_posts_by_profile.rb`
  - `dystopia/monolith/slices/review/use_cases/page_reviews.rb` と、その呼び出し元すべて
  - `dystopia/monolith/slices/notifications/use_cases/list_notifications.rb`
- Modify: `dystopia/docs/features/feed-and-ranking.md:37`、`search.md:41`、`reviews.md:55`（続きの有無は取り除いた後の件数で決める）。`grep -rn "取り除く前\|除く前" dystopia/docs/features` で見つかる同じ趣旨の行も直す。
- Test: `dystopia/monolith/spec/lib/concerns/visible_page_spec.rb` と、9 箇所それぞれの既存 spec に 1 例ずつ

**Interfaces:**
- Produces: `Concerns::VisiblePage.fill(limit:, cursor:, fetch:, keep:, cursor_of:) -> { items: Array, has_more: Boolean }`
  - `fetch.call(cursor)` は cursor の後ろの元の行を最大 `limit + 1` 件返す
  - `keep.call(rows)` は残す要素を順序どおり返す（行そのものでも、proto などに変換した値でもよい）
  - `cursor_of.call(row)` は元の最後の行から、次の `fetch` に渡す cursor を作る
  - 残した要素が `limit + 1` 件以上になるか、`fetch` が `limit` 件以下しか返さなくなるまで繰り返す。回数の上限は置かない。
  - `items` は残した要素の先頭 `limit` 件、`has_more` は残した要素が `limit` 件を超えたか

```ruby
kept = []
loop do
  rows = fetch.call(cursor)
  kept.concat(keep.call(rows))
  break if kept.length > limit || rows.length <= limit
  cursor = cursor_of.call(rows.last)
end
{ items: kept.first(limit), has_more: kept.length > limit }
```

- 各箇所の `next_cursor` は、返す最後の要素（`items.last`）から今と同じ形式で作る。
- `Feed::UseCases::ListFeed#call` は投稿 id ではなく、`Post::Slice["use_cases.posts.list_posts_by_ids"]` でハイドレーションした proto を `posts:` で返す（`{ posts:, next_cursor:, has_more: }`）。handler はそれをそのまま応答に詰める。`list_feed_spec.rb` の `[:post_ids]` は `[:posts].map(&:id)` に直す。
- `Review::UseCases::PageReviews#call(fetch:, cursor:, limit:, viewer_account_id:, order: :activity, visible: ->(page) { page })`（`rows:` を `fetch:` と `cursor:` に替える。`cursor_of` は `review_repo.cursor_for(row, order:)`）。呼び出し元はすべてこの形に直す。
- 見える判定は各箇所の既存の判定をそのまま `keep` に入れる（投稿は `filter_visible_posts` / `list_posts_by_ids`、コメントは作者の summary の有無、作者別コメントは投稿と親の閲覧可否、通知は発火者の `get_profile`、クチコミは `filter_visible_reviews`）。ブックマークは触らない。

- [ ] **Step 1: Write the failing specs**

`visible_page_spec.rb`（DB なし。配列から `fetch` する fake で）:
- `limit: 2`、元の行 `[1, 2, 3, 4, 5, 6]`、`keep` が偶数だけ → `items: [2, 4]`、`has_more: true`
- `limit: 2`、元の行 `[1, 3, 5, 7, 9]`、`keep` が偶数だけ → `items: []`、`has_more: false`
- `limit: 2`、元の行 `[1, 2, 3, 4]`、`keep` が偶数だけ → `items: [2, 4]`、`has_more: false`

9 箇所の spec（各 1 例）: 見える行 1 件の後ろに、閲覧者に見えない行を `limit` 件以上続けて作り、`limit` を 1 にして呼ぶ → 1 ページ目の要素は見える行 1 件、`has_more` は false。未ログインで呼べる一覧（投稿一覧・検索・コメント）は、`viewer_profile_id: nil` の例も 1 つずつ足す。

- [ ] **Step 2: Run to verify they fail**
- [ ] **Step 3: Implement `Concerns::VisiblePage.fill` and switch the 9 places to it**
- [ ] **Step 4: Run the whole monolith suite** — `HANAMI_ENV=test bundle exec rspec > /tmp/rspec.txt 2>&1` が 0 failures
- [ ] **Step 5: Commit** — `gh stack add fix/dystopia-has-more-after-visibility`（Step 1 の前）、`git commit -s -m "fix(dystopia/monolith): decide has_more after dropping rows the viewer cannot see"`

### Task 11: #1800 Username availability disclosure

**Branch:** `docs/dystopia-username-availability-disclosure`

**Files:**
- Modify: `dystopia/docs/features/profiles.md`（`:26` の近くと Rationale の `:157-158` に、設計書 #1800 の 3 項目を書く）

- [ ] **Step 1: Edit the spec document**
- [ ] **Step 2: Verify** — `git diff` で 1 文 1 行・箇条書き 1 項目 1 文になっていることを確かめる
- [ ] **Step 3: Commit** — `gh stack add docs/dystopia-username-availability-disclosure`（Step 1 の前）、`git commit -s -m "docs(dystopia): state that username availability discloses hidden profiles"`

### Task 12: Final verification and Draft PRs

- [ ] **Step 1:** 最上段で monolith の rspec 全体（0 failures）、frontend の `pnpm exec vitest run`（全件 PASS）、`env -u NODE_OPTIONS pnpm exec tsc --noEmit --incremental false`（exit 0）、`pnpm build`（成功）を実行する。DB を使う新しい spec は 5 回繰り返す。
- [ ] **Step 2:** `gh stack submit --auto` で push し、Draft PR を作る。
- [ ] **Step 3:** 各 PR の本文を `.github/pull_request_template.md` の見出しに従って書く（`Closes #N` を先頭、仕様の Before / After を入れ子の箇条書き、判断は Decisions 節、1 文 1 行）。タイトルは英語の Conventional Commits。
- [ ] **Step 4:** Deploy Trigger が取り消されて CI Gatekeeper が失敗していたら、Deploy Trigger の最新 run を `gh run rerun` してから Gatekeeper を `gh run rerun --failed` する。
