# Dystopia block, sign-up and billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブロック相手に予定を見せず、登録を完了しなかった電話番号でやり直せて残骸が消え、解約後に再契約でき退会・削除で課金が止まるようにする。

**Architecture:** monolith（Hanami + gruf）の use case と repository を直し、frontend（Next.js の route handler）は Cognito の adapter と identity の gRPC client を通して呼ぶ。3 つの branch を gh stack で下から積み、各 branch が 1 PR になる。

**Tech Stack:** Ruby / Hanami / ROM-SQL / gruf / rspec、TypeScript / Next.js / vitest、protobuf（`proto/dystopia`）、Stripe Ruby SDK、AWS SDK（Cognito）。

**Spec:** `docs/superpowers/specs/2026-10-27-dystopia-block-signup-billing-design.md`

## Global Constraints

- コード内の識別子・コメント・コミットメッセージは英語、仕様書（`dystopia/docs`）の本文は日本語で、1 文 1 行、箇条書きは 1 項目 1 文、表のセルの改行は `<br>`。
- コードコメントは 1 行で、"why not" だけを書く。タスクや issue への言及を書かない。
- コミットは `git commit -s`。`Co-Authored-By` を付けない。
- monolith の検証は `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec <path> > /tmp/... 2>&1`（出力は file に redirect して読む）。test DB は `monolith_test`。
- frontend の検証は `cd dystopia/frontend && pnpm vitest run <path>` と `pnpm exec tsc --noEmit --incremental false`（exit code はパイプせずに取る）。`pnpm lint` は壊れているので使わない。
- proto の stub は、変更した `identity` の stub だけを commit する（`bin/codegen` と `pnpm proto:gen` は無関係な stub にも差分を出す）。
- 規約の `EFFECTIVE_DATE` は変えない（公開前のため）。

## Review Focus

- 複数プロフィールのアカウントが `x-profile-id` なしで他人の予定を開く → 空（Task 1 の `viewer_profile_id: nil` のテスト）。
- 自分の予定を、自分がブロックした相手がいる状態で開く → 本人には常に表示（Task 1 の本人のテスト）。
- 登録を完了したアカウントの電話番号で再登録 → 409 のまま、Cognito ユーザーは消えない（Task 5 と Task 7 のテスト）。
- 作成から 24 時間ちょうどの未確認ユーザー → 消さない（Task 6 の境界のテスト）。
- 課金の行がないアカウントの退会と削除 → Stripe を呼ばない（Task 10・Task 11 のテスト）。

---

## Branch 1: `feat/dystopia-hide-schedules-from-blocked`（#1726）

この branch は作成済み（worktree `.worktrees/feat-dystopia-hide-schedules-from-blocked`、base は `origin/main`）。
設計書と plan もこの branch の最初の commit に含める。

### Task 1: Hide schedules from blocked viewers

**Files:**
- Modify: `dystopia/monolith/slices/schedule/use_cases/list_schedules.rb`
- Modify: `dystopia/monolith/slices/schedule/grpc/schedule_handler.rb`（`list_schedules`）
- Test: `dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb`
- Test: `dystopia/monolith/spec/slices/schedule/grpc/` の既存の handler spec があれば、閲覧者を渡すことを足す

**Interfaces:**
- Produces: `Schedule::UseCases::ListSchedules#call(profile_id:, viewer_profile_id:, from_date:, to_date:)`。`viewer_profile_id` は必須の keyword（nil を許す）。

- [ ] **Step 1: Write the failing tests** in `list_schedules_spec.rb`（既存の 2 件は `viewer_profile_id: profile_id` を渡す形に直す）

```ruby
it "returns no rows when the cast blocked the viewer"        # cast が viewer をブロック → []
it "returns no rows when the viewer blocked the cast"        # viewer が cast をブロック → []
it "returns no rows when the viewer profile is unknown"      # viewer_profile_id: nil → []
it "returns the owner's rows even when the owner blocked someone" # viewer_profile_id == profile_id、本人が他人をブロック済み → 1 件
it "returns rows to an unrelated viewer"                     # 別アカウントの viewer → 1 件
```

ブロックは `Hanami.app.slices[:social]["repositories.block_repository"].block(blocker_profile_id:, blocked_profile_id:)` で作る。

- [ ] **Step 2: Run** `HANAMI_ENV=test bundle exec rspec spec/slices/schedule/use_cases/list_schedules_spec.rb` → 新しい 5 件が FAIL（`unknown keyword: :viewer_profile_id`）。

- [ ] **Step 3: Implement**
  - `viewer_profile_id` が nil → `[]`。
  - `viewer_profile_id == profile_id` → 判定しない。
  - それ以外は `Social::Slice["repositories.block_repository"].bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id)` に `profile_id` が含まれれば `[]`（`to_s` で比較）。
  - handler は `viewer_profile_id: current_profile_id` を渡す。

- [ ] **Step 4: Run** 同じ spec と `spec/slices/schedule` 全体 → PASS。

- [ ] **Step 5: Commit** `feat(dystopia/monolith): hide schedules from profiles in a block relation`（設計書と plan を同じ commit に含める）

### Task 2: Block effects in specs and terms

**Files:**
- Modify: `dystopia/docs/features/follows-and-blocks.md`（「### ブロック」の表）
- Modify: `dystopia/docs/features/schedules.md`（「### 予定の見え方」の表のブロック関係の行）
- Modify: `dystopia/frontend/src/modules/legal/content/terms.ts`（「予定と予定検索」の 2 段落目、「フォロー・ブロック・足跡」のブロックの段落）
- Test: `dystopia/frontend/src/modules/legal/content/terms.test.ts`（既存のテストが通ること）

- [ ] **Step 1: Edit `follows-and-blocks.md`** のブロックの表に次の 4 行を足す。

| 項目 | ブロックで起きること |
| --- | --- |
| プロフィールの閲覧 | 制限しない。<br>双方向で互いのプロフィールを見られる |
| 予定 | 双方向で、キャストの予定が予定タブにも予定検索にも出ない |
| DM | 既存のスレッドとメッセージは両者が閲覧できる。<br>新しい送信はできない |
| カルテ | 影響しない（[カルテ](karte.md)） |

- Interactions の「検索・おすすめ」の項目にある予定検索の記述はそのまま残す（表は「何が起きるか」、Interactions は参照先）。

- [ ] **Step 2: Edit `schedules.md`** のブロック関係の行の予定タブのセルを `空になる` に変え、表の下に「閲覧者のプロフィールが決まらない場合（複数のプロフィールを持つアカウントがプロフィールを指定しない場合）も、他人の予定タブは空になる。」を足す。

- [ ] **Step 3: Edit `terms.ts`**
  - 「予定と予定検索」2 段落目を `予定は、そのキャストのプロフィールと、利用者が予定を探すための検索（以下「予定検索」といいます）で、他の利用者に表示されます。ただし、そのキャストのプロフィールとブロックの関係にあるプロフィールには表示されません。` にする。
  - ブロックの段落の `互いの投稿が表示されなくなり、` を `互いの投稿とキャストの予定が表示されなくなり、` にする。

- [ ] **Step 4: Run** `pnpm vitest run src/modules/legal` → PASS。

- [ ] **Step 5: Commit** `docs(dystopia): list what a block hides, including cast schedules`

### Task 2b: Close #1803 and #1804

- [ ] `gh issue close 1803 --comment "<決定>"` と `gh issue close 1804 --comment "<決定>"`。
  - コメントは 1 文 1 行で、決定（今のまま）、仕様書・ポリシーの該当箇所（`karte.md`、`privacy.ts` のカルテの段落／`messages.md` の「相手がブロック状態」の行）、Branch 1 の PR で `follows-and-blocks.md` の表に行を足したことを書く。
  - PR を作ってから実行する（PR 番号をコメントに入れる）。

---

## Branch 2: `fix/dystopia-incomplete-sign-up`（#1732 + #1751）

`gh stack add fix/dystopia-incomplete-sign-up` で Branch 1 の上に作る。

### Task 3: Keep the first deactivation timestamp

**Files:**
- Modify: `dystopia/monolith/slices/identity/repositories/account_repository.rb`（`mark_deactivated`）
- Test: `dystopia/monolith/spec/slices/identity/use_cases/account/deactivate_account_spec.rb`

- [ ] **Step 1: Write the failing test** `it "keeps deactivated_at when an already deactivated account is deactivated again"`: 退会 → `deactivated_at` を記録 → 時刻を進めて（`Time.now` を stub）もう一度退会 → `deactivated_at` が 1 回目と等しい。
- [ ] **Step 2: Run** → FAIL。
- [ ] **Step 3: Implement** `mark_deactivated` は `deactivated_at IS NULL` の行だけを更新する（`accounts.where(id: sub, deactivated_at: nil)` の dataset update）。
- [ ] **Step 4: Run** `spec/slices/identity` → PASS。
- [ ] **Step 5: Commit** `fix(dystopia/monolith): keep the first deactivation timestamp`

### Task 4: Cognito adapter user lookup and deletion by username

**Files:**
- Modify: `dystopia/monolith/lib/cognito/adapter.rb`、`aws_adapter.rb`、`fake_adapter.rb`、`dystopia/monolith/lib/cognito.rb`
- Test: `dystopia/monolith/spec/lib/cognito/aws_adapter_spec.rb`、`fake_adapter_spec.rb`

**Interfaces:**
- Produces:
  - `Cognito::User = Data.define(:username, :sub, :status, :created_at)`（`status` は Cognito の文字列、例 `"UNCONFIRMED"`・`"CONFIRMED"`、`created_at` は `Time`）
  - `Cognito.find_user(username:) -> Cognito::User | nil`
  - `Cognito.delete_user(username:) -> true`（`UserNotFoundException` は成功扱い）
  - `Cognito.each_user { |user| ... }`（`ListUsers` を `pagination_token` で全ページたどる）
  - `Cognito::USERNAME_PATTERN = /\A\h{64}\z/`。`find_user` と `delete_user` はこれに合わない値で `ArgumentError`。

- [ ] **Step 1: Write the failing tests**（`stub_responses` で）
  - `find_user` は `list_users(user_pool_id:, filter: "username = \"<hash>\"", limit: 1)` を呼び、`sub` 属性・`user_status`・`user_create_date` から `Cognito::User` を作る。0 件なら nil。
  - `find_user(username: "not-a-hash")` は `ArgumentError`。
  - `delete_user` は `admin_delete_user(user_pool_id:, username:)` を呼ぶ。`UserNotFoundException` でも true。
  - `each_user` は 2 ページの stub（1 ページ目に `pagination_token`）を全部 yield する。
  - fake adapter: `find_user` は nil、`each_user` は何も yield しない、`delete_user` は true（`warn` で記録）。
- [ ] **Step 2: Run** `spec/lib/cognito` → FAIL。
- [ ] **Step 3: Implement**（`Cognito` の module 関数は `adapter` に委譲、既存の `admin_delete_user` と同じ形）
- [ ] **Step 4: Run** → PASS。
- [ ] **Step 5: Commit** `feat(dystopia/monolith): look up and delete Cognito users by username`

### Task 5: ReleaseIncompleteSignUp RPC

**Files:**
- Modify: `proto/dystopia/identity/v1/service.proto`
- Regenerate: `dystopia/monolith/stubs/identity/v1/*`、`dystopia/frontend/src/stub/identity/v1/*`（この 2 つだけ commit）
- Create: `dystopia/monolith/slices/identity/use_cases/account/release_incomplete_sign_up.rb`
- Modify: `dystopia/monolith/slices/identity/grpc/handler.rb`
- Test: `dystopia/monolith/spec/slices/identity/use_cases/account/release_incomplete_sign_up_spec.rb`、`spec/slices/identity/grpc/handler_spec.rb`

**Interfaces:**
- Consumes: Task 4 の `Cognito.find_user` / `Cognito.delete_user`
- Produces:
  - proto: `rpc ReleaseIncompleteSignUp (ReleaseIncompleteSignUpRequest) returns (ReleaseIncompleteSignUpResponse);`、`message ReleaseIncompleteSignUpRequest { string username = 1; }`、`message ReleaseIncompleteSignUpResponse { bool released = 1; }`
  - `Identity::UseCases::Account::ReleaseIncompleteSignUp#call(username:) -> Boolean`（DI key `use_cases.account.release_incomplete_sign_up`）
  - 形式違いの username は handler で `GRPC::InvalidArgument`。

- [ ] **Step 1: Write the failing tests**（use case は `Cognito.adapter` に double を入れる）
  - ユーザーがいない → false、削除しない。
  - `UNCONFIRMED` → 削除して true。
  - `CONFIRMED` で `identity.accounts` に行がない → 削除して true。
  - `CONFIRMED` で行がある → false、削除しない。
  - `UNCONFIRMED` でも行がある → false（行があれば消さない）。
  - handler: `released` を返す。username が形式違いなら INVALID_ARGUMENT。
- [ ] **Step 2: Run** → FAIL。
- [ ] **Step 3: Implement** proto を足し、`bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で stub を作り、identity の stub だけを `git add` する。use case は「行がないこと」を `account_repo.find_by_id(user.sub)` で確かめる。
- [ ] **Step 4: Run** `spec/slices/identity` → PASS。
- [ ] **Step 5: Commit** `feat(dystopia/monolith): release an incomplete sign-up by username`

### Task 6: Purge incomplete sign-ups daily

**Files:**
- Create: `dystopia/monolith/slices/identity/use_cases/account/purge_incomplete_sign_ups.rb`
- Modify: `dystopia/monolith/lib/tasks/account.rake`
- Test: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_incomplete_sign_ups_spec.rb`

**Interfaces:**
- Consumes: Task 4 の `Cognito.each_user` / `Cognito.find_user` / `Cognito.delete_user`
- Produces: `Identity::UseCases::Account::PurgeIncompleteSignUps#call(now:) -> Result`、`Result = Data.define(:purged, :failed_usernames)`、`RETENTION_SECONDS = 24 * 3600`（DI key `use_cases.account.purge_incomplete_sign_ups`）

- [ ] **Step 1: Write the failing tests**
  - `created_at` が `now - 24h - 1s` で行がないユーザー（UNCONFIRMED と CONFIRMED の両方）→ 消す。
  - `created_at` がちょうど `now - 24h` → 消さない。
  - 行があるユーザー → 消さない。
  - 削除の直前の `find_user` で行のある `sub` に変わっていた／いなくなっていた → 消さない。
  - 1 件の削除が例外 → `failed_usernames` に入れて次へ進む。
- [ ] **Step 2: Run** → FAIL。
- [ ] **Step 3: Implement** 対象の判定は `created_at < now - RETENTION_SECONDS` かつ `account_repo.find_by_id(sub)` が nil。rake の `account:purge_deactivated` は、退会の削除の後にこの use case を呼び、両方の結果を出力してから、どちらかに失敗があれば `abort` する。
- [ ] **Step 4: Run** `spec/slices/identity` と `spec/lib` → PASS。
- [ ] **Step 5: Commit** `feat(dystopia/monolith): purge sign-ups left incomplete for a day`

### Task 7: Frontend re-registration and sign-in without an account

**Files:**
- Modify: `dystopia/frontend/src/lib/cognito/adapter.ts`、`aws.ts`、`fake.ts`
- Modify: `dystopia/frontend/src/app/api/identity/register/route.ts`、`sign-in/route.ts`
- Test: `register/route.test.ts`、`sign-in/route.test.ts`、`src/lib/cognito/` の既存の fake・aws のテスト

**Interfaces:**
- Consumes: Task 5 の `identityClient.releaseIncompleteSignUp({ username })`
- Produces: `CognitoAdapter.releaseIncompleteSignUp(phone: string): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**
  - register: 未確認の番号で再登録 → 200、新しいパスワードで確認・ログインできる。
  - register: 確認済みでアカウントのない番号（`@/lib/grpc` の `getAccount` が NotFound の ConnectError）→ 200。
  - register: 確認済みでアカウントのある番号 → 409「この電話番号は既に登録されています」。
  - register: 解放後の再 SignUp がまた `UsernameExistsException` → 409（再試行は 1 回だけ）。
  - sign-in: `getAccount` が `new ConnectError("account not found", Code.NotFound)` を投げる → 401「電話番号または認証コードが正しくありません」、`globalSignOut` が呼ばれ、cookie は付かない。
  - sign-in: `getAccount` がそれ以外のエラー → 今と同じく `handleApiError`。
  - 既存の `account: undefined` のモックのテストは NotFound のモックに置き換える。
- [ ] **Step 2: Run** `pnpm vitest run src/app/api/identity src/lib/cognito` → FAIL。
- [ ] **Step 3: Implement**
  - aws: `identityClient.releaseIncompleteSignUp({ username: usernameForPhone(phone) })` の `released` を返す。
  - fake: ユーザーがいなければ false。未確認なら消して true。確認済みなら `identityClient.getAccount({ sub })` が NotFound のときだけ消して true。
  - register: `UsernameExistsException` で `releaseIncompleteSignUp` が true なら `signUp` をもう 1 回だけ呼ぶ。
  - sign-in: `getAccount` を囲み、NotFound の ConnectError は `if (!account)` と同じ分岐に流す。
- [ ] **Step 4: Run** 同じ vitest と `pnpm exec tsc --noEmit --incremental false` → PASS / exit 0。
- [ ] **Step 5: Commit** `fix(dystopia/frontend): let incomplete sign-ups register again and reject sign-in without an account`

### Task 8: Account spec and Cognito migration design

**Files:**
- Modify: `dystopia/docs/features/account.md`
- Modify: `docs/superpowers/specs/2026-08-26-identity-cognito-migration-design.md`（不変条件の行と 30 日の記述）

- [ ] **Step 1: Edit `account.md`**
  - 登録の表: 「認証コードを確認した後、アカウントの作成に失敗」の行の結果を `電話番号は確認済みになるが、アカウントは作られない。<br>同じ電話番号でもう一度登録すると、残った登録を消して登録し直せる` にする。行「登録を完了しなかった電話番号（確認コードを入力していない、または確認後にアカウントが作られなかった）」を足し、結果は `残った登録を消して登録し直せる` とする。
  - 電話番号が登録済みの行は「登録を完了したアカウントの電話番号」と明確にする。
  - ログインの表: 「認証は通るがアカウントがない」を `401。<br>「電話番号または認証コードが正しくありません」。<br>認証で発行されたトークンを無効にし、cookie は設定しない` にする。
  - 退会の表の下に「退会中のアカウントに退会の要求が届いても、退会日時は変わらない。」を足す。
  - 削除処理の節に、登録を完了しなかった認証情報を、Cognito での作成から 24 時間を過ぎた後の削除処理で消すことを足す（24 時間ちょうどは対象外）。
  - Data の「確認待ちのまま残った登録の認証情報は、削除処理の対象ではない。」を、上の削除の記述への参照に置き換える。
- [ ] **Step 2: Edit the migration design** 不変条件に「登録を完了しなかったユーザー（作成から 24 時間）」と「登録のやり直し」の 2 つの起点を足し、猶予の 30 日を 90 日に直す。
- [ ] **Step 3: Run** `grep -n "404" dystopia/docs/features/account.md` で、アカウントなしのログインに 404 が残っていないこと。
- [ ] **Step 4: Commit** `docs(dystopia): describe re-registration and the purge of incomplete sign-ups`

---

## Branch 3: `fix/dystopia-billing-resubscribe-and-purge`（#1738）

`gh stack add fix/dystopia-billing-resubscribe-and-purge` で Branch 2 の上に作る。

### Task 9: Multiple subscriptions per account

**Files:**
- Create: `dystopia/monolith/config/db/migrate/<timestamp>_allow_multiple_billing_subscriptions.rb`
- Modify: `dystopia/monolith/slices/billing/repositories/subscription_repository.rb`、`slices/billing/tasks/reconcile.rb`
- Test: `spec/slices/billing/repositories/subscription_repository_spec.rb`、`spec/slices/billing/tasks/reconcile_spec.rb`、`spec/slices/billing/use_cases/process_webhook_event_spec.rb`

**Interfaces:**
- Produces:
  - `SubscriptionRepository#find_by_account_id(account_id)` は `created_at` の新しい順で最初の行。
  - `SubscriptionRepository#list_reconcilable_by_account_id(account_id) -> Array`（`canceled` でない行と最新の行、重複なし）。
  - `SubscriptionRepository#list_uncanceled_by_account_id(account_id) -> Array`
  - `SubscriptionRepository#delete_by_account_id(account_id)`（Task 11 で使う）。

- [ ] **Step 1: Write the failing tests**
  - 解約済みの購読がある account に、別の `stripe_subscription_id` の `customer.subscription.created` → 2 行目が保存され、処理済みになる。
  - `find_active_by_account_id` は、解約済みの行と有効な行があるとき有効な行を返す。
  - reconcile は、同じ account の `canceled` でない 2 行の両方を Stripe と比べる。
- [ ] **Step 2: Run** → FAIL（一意制約違反）。
- [ ] **Step 3: Implement** migration は `uq_billing_subscriptions_account_id` を外し、`idx_billing_subscriptions_account_id` を張る（down は逆）。`find_active_by_account_id` は `.order { created_at.desc }.first`。reconcile は `list_reconcilable_by_account_id` の各行を比べる。
- [ ] **Step 4: Run** `HANAMI_ENV=test bundle exec hanami db migrate` の後 `spec/slices/billing` → PASS。
- [ ] **Step 5: Commit** `fix(dystopia/monolith): store a new subscription after the previous one was canceled`

### Task 10: Cancel subscriptions on deactivation

**Files:**
- Modify: `dystopia/monolith/slices/billing/adapters/stripe_client.rb`
- Create: `dystopia/monolith/slices/billing/use_cases/cancel_subscriptions_at_period_end.rb`
- Modify: `dystopia/monolith/slices/identity/use_cases/account/deactivate_account.rb`、`slices/identity/repositories/account_repository.rb`
- Test: `spec/slices/billing/adapters/stripe_client_spec.rb`、`spec/slices/billing/use_cases/cancel_subscriptions_at_period_end_spec.rb`、`spec/slices/identity/use_cases/account/deactivate_account_spec.rb`

**Interfaces:**
- Consumes: Task 9 の `list_uncanceled_by_account_id`
- Produces:
  - `StripeClient#cancel_at_period_end(stripe_subscription_id:)`（`Stripe::Subscription.update(id, { cancel_at_period_end: true }, { api_key:, idempotency_key: "billing:cancel_at_period_end:<id>" })`）
  - `Billing::UseCases::CancelSubscriptionsAtPeriodEnd#call(account_id:)`（DI key `use_cases.cancel_subscriptions_at_period_end`）。各行の Stripe を更新し、行の `cancel_at_period_end` を true にする。
  - `DeactivateAccount#call(sub:)`: 既に退会中なら何もしない。そうでなければ、解約を先に呼び、成功したら退会日時を書く。

- [ ] **Step 1: Write the failing tests**
  - `canceled` でない購読 2 件 → Stripe を 2 回呼び、両方の行が `cancel_at_period_end: true`。
  - 購読がない／全部 `canceled` → Stripe を呼ばない。
  - Stripe が例外 → 例外が上がり、退会日時は書かれない。
  - 退会中のアカウントの退会 → 解約を呼ばない（Task 3 のテストと合わせる）。
- [ ] **Step 2: Run** → FAIL。
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `spec/slices/billing` と `spec/slices/identity` → PASS。
- [ ] **Step 5: Commit** `fix(dystopia/monolith): cancel subscriptions at period end when an account is deactivated`

### Task 11: Purge billing with the account

**Files:**
- Modify: `stripe_client.rb`（`delete_customer`）
- Create: `dystopia/monolith/slices/billing/use_cases/purge_account.rb`
- Modify: `dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb`、`slices/billing/use_cases/process_webhook_event.rb`、`slices/billing/repositories/customer_repository.rb`
- Test: 各 spec、`spec/slices/identity/use_cases/account/purge_identity_spec.rb`、`purge_wiring_spec.rb`

**Interfaces:**
- Consumes: Task 9 の `delete_by_account_id`
- Produces:
  - `StripeClient#delete_customer(stripe_customer_id:)`（`Stripe::Customer.delete`。`resource_missing` は成功扱い）
  - `CustomerRepository#delete_by_account_id(account_id)`
  - `Billing::UseCases::PurgeAccount#call(account_id:)`（DI key `use_cases.purge_account`）: 顧客の行があれば Stripe の顧客を削除し、購読と顧客の行を消す。
  - `PurgeIdentity` の順番: プロフィール → Web Push → 課金 → Cognito → アカウントの行。`purge_billing:` を keyword で注入できるようにする（既存の `purge_profiles:` と同じ形）。

- [ ] **Step 1: Write the failing tests**
  - 顧客の行あり → `delete_customer` を呼び、購読と顧客の行が 0 件。
  - 顧客の行なし → Stripe を呼ばない。
  - `delete_customer` が例外 → 例外が上がり、行は残る。PurgeIdentity は Cognito とアカウントの削除に進まない。
  - webhook: 顧客の行がない `customer.subscription.updated`・`customer.subscription.deleted` → `:ignored` で処理済みになり、例外を投げない。
- [ ] **Step 2: Run** → FAIL。
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `spec/slices/billing` と `spec/slices/identity` → PASS。
- [ ] **Step 5: Commit** `fix(dystopia/monolith): delete billing data and the Stripe customer when an account is purged`

### Task 12: Billing and account specs

**Files:**
- Modify: `dystopia/docs/features/billing.md`、`dystopia/docs/features/account.md`

- [ ] **Step 1: Edit `billing.md`** 再契約（購読ごとに 1 行、解約後も新しい購読を保存）、退会時の期間末解約（返金なし、復活しても解約の設定は戻らない）、削除処理での Stripe の顧客と課金の行の削除、行のない顧客の通知を無視することを書く。
- [ ] **Step 2: Edit `account.md`** 退会の表に課金の解約を、削除処理の順番に課金（Web Push の後、Cognito の前）を足す。
- [ ] **Step 3: Commit** `docs(dystopia): describe resubscription and billing on deactivation and purge`

---

## Finish

- [ ] 最上段で `HANAMI_ENV=test bundle exec rspec`（全体）、`pnpm vitest run`、`pnpm exec tsc --noEmit --incremental false`、`pnpm build` を回す。
- [ ] `gh stack submit --auto` で 3 つの Draft PR を作り、PR 本文はテンプレート（`.github/pull_request_template.md`）に従う。Closes は #1726／#1732・#1751／#1738。
- [ ] Task 2b を実行する。
