# Push Subscriptions Per Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブラウザ通知の購読をプロフィール×端末で持ち、端末ごとに受け取るプロフィールを選べるようにする。プロフィールごとの「端末に通知を送る」（`push_enabled`）は削除する（issue #1679）。

**Architecture:**

ユーザー決定:
- 既存の購読（アカウント単位の行）は移さずに捨て、利用者には端末ごとにオンにし直してもらう
- `push_enabled` は列・proto・画面から削除する。全端末でまとめて止めたいときは、種類ごとのスイッチ（プロフィール単位で全端末に効く）を使う

この plan で決めたこと（ユーザーに伝え済み）:
- 端末でオンにすると、そのとき使っているプロフィールの分だけ登録する。一度もオンにしていないプロフィール宛ての通知は、その端末に届かない
- 通知のタイトルに「どのプロフィール宛てか」を付けるかは、その端末（endpoint）に同じアカウントのプロフィールが 2 つ以上登録されているかで決める（今はアカウントの有効なプロフィール数）
- 通知のタップでプロフィールを切り替える仕組み（service worker が書く 1 回限りの記録）は変えない

データ: `notifications.push_subscriptions` を作り直す。列は `id`・`account_id`・`profile_id`・`endpoint`・`p256dh`・`auth`・`created_at`・`updated_at`、一意制約は `(endpoint, profile_id)`、索引は `profile_id` と `endpoint`。`account_id` は、別のアカウントが同じ端末を使い始めたときに前のアカウントの行を外すのと、退会時の削除に使う（プロフィールの持ち主のアカウントは変わらない）。`notifications.preferences.push_enabled` は drop する。

RPC（`proto/dystopia/notifications/v1/notification_service.proto`）:
- `RegisterPushSubscription`（既存、request は変えない）: 使用中のプロフィールで登録する（`authenticate_user!`）。同じ endpoint の、別のアカウントの行は消す。同じ endpoint の行の鍵（`p256dh`・`auth`）はそろえて更新する
- `UnregisterPushSubscription`（既存、request は変えない）: 使用中のプロフィールの行だけを消す。ブラウザの購読（`PushSubscription.unsubscribe`）は呼ばない。同じ端末の他のプロフィールが使っているため
- `GetPushSubscriptionStatus`（新規）: request `{ endpoint }`、response `{ subscribed: bool }`。使用中のプロフィールで登録されているか
- `ClaimPushEndpoint`（新規）: request `{ endpoint }`、response `{}`。同じ endpoint の、別のアカウントの行を消す（`authenticate_account!`。ログインしたアカウントが変わったときに今の付け替えと同じ結果を保つ）
- `NotificationPreferences.push_enabled` は削除し、`reserved 1; reserved "push_enabled";` にする

送信（`SendPush`）: 宛先プロフィールで登録された行だけに送る。種類のスイッチがオフなら送らない（`push_enabled` の判定はなくなる）。

デプロイ: migration がアプリの更新より先に効くので、切り替わるまでの間、古いアプリでは購読の登録と通知設定の取得が失敗する。ブラウザ通知は送れなくても操作は失敗しない（`SendPush` は例外を握りつぶす）ので、1 回のデプロイで出す。

**Tech Stack:** Ruby 3.4 / Hanami 2 / ROM / gruf / RSpec / protobuf（buf）/ Next.js / TypeScript / Vitest

**Spec:** issue #1679（https://github.com/panicboat/monorepo/issues/1679）と上のユーザー決定

## Global Constraints

- rspec は `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec rspec <path> > <scratchpad>/rspec.log 2>&1` を実行し、ログファイルを読む。migration を足したら `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate` を先に流す（`structure.sql` は commit しない。pg_dump の version mismatch の失敗は無視してよい）
- Ruby の stub は `dystopia/monolith/bin/codegen`、TypeScript の stub は `dystopia/frontend` で `pnpm proto:gen`。どちらも notifications 以外の stub に差分が出ることがあるので、commit するのは notifications の stub だけ（他の差分は `git checkout` で戻し、未追跡の billing の stub は消す）
- frontend の検証は `pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"` と `pnpm exec vitest run <files>`。`pnpm lint` は使わない
- 画面の文言: 「この端末で受け取る」の説明は「オンにすると、このプロフィール宛ての通知がこの端末に届きます」
- 用語: 予定は schedule。プロフィールは profile
- コードコメントは英語で 1 行。タスクや issue への言及を書かない
- commit は `git commit -s`。`Co-Authored-By` を付けない

## Review Focus

- 同じ端末で、同じアカウントの 2 つのプロフィールをオンにした: 行は 2 つ、片方をオフにしてももう片方は残る → Task 1・Task 2 のテスト
- 同じ端末で別のアカウントがログインした（`ClaimPushEndpoint`）: 前のアカウントの行は全部消え、今のアカウントの行は残る → Task 2 のテスト
- プロフィールを削除した: そのプロフィールの行だけが消える → Task 2 のテスト
- 端末に 1 つのプロフィールしか登録していないとき: タイトルに宛先のプロフィールを付けない。2 つ以上なら付ける → Task 3 のテスト
- プロフィールを切り替えた後の設定画面: 「この端末で受け取る」がそのプロフィールの登録状態を表す → Task 4 のテスト

---

### Task 1: Store push subscriptions per profile

**Files:**
- Modify: `proto/dystopia/notifications/v1/notification_service.proto`（新しい 2 つの RPC と message。`push_enabled` の削除は Task 3）
- Modify: `dystopia/monolith` の notifications の Ruby stub（`bin/codegen` の出力）
- Create: `dystopia/monolith/config/db/migrate/<既存の最新より後の timestamp>_recreate_push_subscriptions_per_profile.rb`
- Modify: `dystopia/monolith/slices/notifications/relations/push_subscription_records.rb`（ファイル名は `grep -rln push_subscriptions dystopia/monolith/slices/notifications/relations` で確かめる）
- Modify: `dystopia/monolith/slices/notifications/repositories/push_subscription_repository.rb`
- Test: `dystopia/monolith/spec/slices/notifications/repositories/push_subscription_repository_spec.rb`（既存があれば書き換え、なければ作る）

**Interfaces:**
- Produces（`PushSubscriptionRepository`）:
  - `upsert(account_id:, profile_id:, endpoint:, p256dh:, auth:)`: 1 transaction で、同じ endpoint の別のアカウントの行を消し、同じ endpoint の行の鍵をそろえ、`(endpoint, profile_id)` で insert / update する
  - `list_by_profile(profile_id) -> Array<record>`（`created_at`, `id` の昇順）
  - `profile_counts_by_endpoint(account_id:, endpoints:) -> Hash{String => Integer}`
  - `subscribed?(profile_id:, endpoint:) -> Boolean`
  - `delete_for_profile(profile_id:, endpoint:)`
  - `release_endpoint(account_id:, endpoint:)`: 同じ endpoint の、`account_id` 以外の行を消す
  - `delete_by_profile(profile_id)`、`delete_by_account(account_id)`（既存のまま）、`delete_by_endpoint(endpoint)`（既存のまま。送信先が 410 を返したとき）
  - `list_by_account`・`delete_for_account` は削除する
- Produces（proto）: `rpc GetPushSubscriptionStatus(GetPushSubscriptionStatusRequest) returns (GetPushSubscriptionStatusResponse)`（request `string endpoint = 1;`、response `bool subscribed = 1;`）、`rpc ClaimPushEndpoint(ClaimPushEndpointRequest) returns (ClaimPushEndpointResponse)`（request `string endpoint = 1;`、response 空）

- [ ] **Step 1: Write the failing repository spec**

テスト（`type: :database`、profile と account は `create_account_with_profile` などの既存の fixture で作る）:
- `keeps one row per profile on the same endpoint`: 同じアカウントの profile A・B で同じ endpoint を upsert → 行が 2 つ
- `removes the rows of another account on the same endpoint`: アカウント X の profile で upsert した後、アカウント Y の profile で同じ endpoint を upsert → X の行は 0、Y の行は 1
- `updates the keys of every row on the endpoint`: A・B で登録後、A で新しい鍵を upsert → B の行の鍵も新しい値
- `profile_counts_by_endpoint`: endpoint e1 に A・B、e2 に A → `{ "e1" => 2, "e2" => 1 }`
- `release_endpoint`: X と Y の行が別の endpoint にあり、e1 に X の行 → `release_endpoint(account_id: Y, endpoint: "e1")` で e1 の X の行が消え、他は残る
- `delete_for_profile` は指定したプロフィールの行だけ消す、`subscribed?` は登録の有無を返す

- [ ] **Step 2: Run it to verify it fails**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/notifications/repositories/push_subscription_repository_spec.rb`
Expected: FAIL（`profile_id` 列がない、メソッドがない）

- [ ] **Step 3: Write the migration, update the relation and the repository, edit the proto and regenerate the Ruby stub**

migration の `up` は `drop_table` → `create_table`（上の列と制約）→ 索引 2 つ。`down` は元の形（`account_id` だけの表）を作り直す。

- [ ] **Step 4: Migrate the test DB and run the notifications specs**

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate` の後、`HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/notifications/repositories`
Expected: 全件 PASS（`list_by_account` を使う use case の spec は Task 2・3 で直すので、この時点では repositories だけを回す）

- [ ] **Step 5: Commit**

```bash
git add proto/dystopia/notifications dystopia/monolith/config/db/migrate dystopia/monolith/slices/notifications dystopia/monolith/spec/slices/notifications/repositories <notifications の Ruby stub>
git commit -s -m "feat(dystopia/monolith): store push subscriptions per profile"
```

### Task 2: Register, unregister and look up subscriptions for the acting profile

**Files:**
- Modify: `dystopia/monolith/slices/notifications/use_cases/register_push_subscription.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/unregister_push_subscription.rb`
- Create: `dystopia/monolith/slices/notifications/use_cases/get_push_subscription_status.rb`
- Create: `dystopia/monolith/slices/notifications/use_cases/claim_push_endpoint.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/purge_profile.rb`
- Modify: `dystopia/monolith/slices/notifications/grpc/notification_handler.rb`
- Test: 対応する use case と handler の spec（`spec/slices/notifications/...`。既存の push の spec に合わせる）

**Interfaces:**
- Consumes: Task 1 の repository のメソッド
- Produces: `RegisterPushSubscription#call(account_id:, profile_id:, endpoint:, p256dh:, auth:)`、`UnregisterPushSubscription#call(profile_id:, endpoint:)`、`GetPushSubscriptionStatus#call(profile_id:, endpoint:) -> Boolean`、`ClaimPushEndpoint#call(account_id:, endpoint:)`。handler の `register_push_subscription`・`unregister_push_subscription`・`get_push_subscription_status` は `authenticate_user!` と `current_profile_id`、`claim_push_endpoint` は `authenticate_account!`

- [ ] **Step 1: Write the failing specs**

- register: 使用中のプロフィールの行ができる。endpoint の検証（既存の `InvalidSubscriptionError` のテスト）はそのまま通る
- unregister: 使用中のプロフィールの行だけが消え、同じ endpoint の他のプロフィールの行は残る
- status: 登録済みなら true、他のプロフィールだけが登録していれば false
- claim: 別のアカウントの行が消え、自分のアカウントの行は残る
- purge_profile: そのプロフィールの購読の行が消え、他のプロフィールの行は残る
- handler: `GetPushSubscriptionStatus` と `ClaimPushEndpoint` を既存の handler spec の書き方で 1 件ずつ

- [ ] **Step 2: Run them to verify they fail**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/notifications`
Expected: 新しいテストが FAIL

- [ ] **Step 3: Implement the use cases, the handler methods and the purge**

handler に新しい 2 つの `rpc` を宣言し、`Notifications::Deps` に use case を足す。

- [ ] **Step 4: Run the notifications specs**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/notifications`
Expected: Task 2 のテストが PASS（`send_push_spec` が `list_by_account` のために落ちるなら、それは Task 3 で直すので、落ちたテストの名前を報告に書く）

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/notifications dystopia/monolith/spec/slices/notifications
git commit -s -m "feat(dystopia/monolith): register push subscriptions for the acting profile"
```

### Task 3: Send pushes per profile and remove push_enabled

**Files:**
- Modify: `dystopia/monolith/slices/notifications/use_cases/send_push.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/get_preferences.rb`、`update_preferences.rb`
- Modify: `dystopia/monolith/slices/notifications/repositories/notification_repository.rb`（`PREFERENCE_COLUMNS`）
- Modify: `dystopia/monolith/slices/notifications/relations/preferences.rb`
- Modify: `dystopia/monolith/slices/notifications/grpc/notification_handler.rb`（preferences の変換）
- Create: `dystopia/monolith/config/db/migrate/<Task 1 より後の timestamp>_drop_push_enabled_from_notification_preferences.rb`
- Modify: `proto/dystopia/notifications/v1/notification_service.proto`（`push_enabled` を削除して reserved）と notifications の Ruby stub
- Test: `spec/slices/notifications/use_cases/send_push_spec.rb`、`spec/slices/notifications/grpc/preferences_rpc_spec.rb`、`spec/slices/notifications/use_cases/emit_spec.rb`（`push_enabled` を使っている箇所）

**Interfaces:**
- Consumes: Task 1 の `list_by_profile`・`profile_counts_by_endpoint`
- Produces: `SendPush#call` の signature は変えない。`build_push_message.call(..., shared_device:)` の引数も変えない（値の決め方だけが変わる）

- [ ] **Step 1: Write the failing specs**

`send_push_spec.rb`:
- `sends only to the devices registered for the recipient profile`: 宛先 A の端末 e1、同じアカウントの B の端末 e2 → e1 にだけ送る
- `names the recipient profile only on a device shared by several profiles`: e1 に A・B、e2 に A だけ → e1 への payload は `shared_device: true` で作った内容、e2 は `false`（`build_push_message` を spy にして、endpoint ごとに受けた引数を確かめる）
- 既存の `push_enabled` がオフなら送らないテストは削除する。種類のスイッチがオフなら送らないテストは残す
`preferences_rpc_spec.rb`: response に `push_enabled` がないこと（proto から消えるので、既存のアサーションから外す）

- [ ] **Step 2: Run them to verify they fail**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/notifications`
Expected: 新しいテストが FAIL

- [ ] **Step 3: Implement**

`SendPush` は `list_by_profile(recipient_profile_id)` で行を引き、`profile_counts_by_endpoint(account_id: recipient.account_id, endpoints:)` で endpoint ごとの数を引く。payload は `shared_device` の true / false の 2 通りまでを作り、行ごとに選ぶ。`profile_adapter.visible_count` を使わなくなったら、adapter から外す（他に使う箇所がないことを grep で確かめる）。`push_enabled` は DEFAULT_PREFERENCES・PREFERENCE_COLUMNS・relation・handler・proto から消し、migration で列を drop する（`down` は `default: true, null: false` で戻す）。

- [ ] **Step 4: Migrate and run all monolith specs**

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate` の後、`HANAMI_ENV=test rbenv exec bundle exec rspec`
Expected: 全件 PASS（並びに依存する既知の不安定な spec が落ちたら、もう一度回して確かめ、報告に書く）

- [ ] **Step 5: Commit**

```bash
git add proto/dystopia/notifications dystopia/monolith <notifications の Ruby stub>
git commit -s -m "feat(dystopia/monolith): send pushes to the devices of the recipient profile"
```

### Task 4: Choose the profiles each device receives in the settings

**Files:**
- Modify: `dystopia/frontend` の notifications の TypeScript stub（`pnpm proto:gen` の出力）
- Modify: `dystopia/frontend/src/app/api/notifications/push/subscription/route.ts`（と `route.test.ts`）
- Create: `dystopia/frontend/src/app/api/notifications/push/subscription/status/route.ts`（POST `{ endpoint }` → `{ subscribed }`）と test
- Create: `dystopia/frontend/src/app/api/notifications/push/claim/route.ts`（POST `{ endpoint }` → `{}`）と test
- Modify: `dystopia/frontend/src/modules/notifications/lib/push.ts`（と `push.test.ts`）
- Modify: `dystopia/frontend/src/modules/notifications/hooks/usePushDevice.ts`（と test）
- Modify: `dystopia/frontend/src/modules/notifications/hooks/usePushResync.ts`（と test）
- Modify: `dystopia/frontend/src/modules/notifications/components/NotificationSettings.tsx`（と test）
- Modify: `dystopia/frontend/src/modules/notifications/types.ts`、`hooks/useNotificationPreferences.ts`、`src/app/api/notifications/preferences/route.ts`（と test）から `pushEnabled` を消す

**Interfaces:**
- Consumes: Task 1〜3 の RPC
- Produces（`lib/push.ts`）: `enablePush(vapidPublicKey)` は今と同じ戻り値で、使用中のプロフィールで登録する。`disablePush()` はサーバーの行だけを消し、ブラウザの購読は残す。`isSubscribedHere(): Promise<boolean>`（ブラウザの購読があり、かつ status が true）。`resyncPushSubscription()` は `claimPushEndpoint` を呼ぶ（登録はしない）

- [ ] **Step 1: Regenerate the TypeScript stub and write the failing tests**

テスト:
- `push.test.ts`: `disablePush` が DELETE を送り、`unsubscribe` を呼ばない。`isSubscribedHere` はブラウザの購読がなければ status を呼ばずに false。`resyncPushSubscription` は claim の URL に POST する
- `usePushDevice.test.tsx`: 使用中のプロフィールが変わると status を取り直し、state がその結果になる（`useAuthStore` の `activeProfileId` を変える）
- `NotificationSettings.test.tsx`: 「端末に通知を送る」が表示されない。「この端末で受け取る」の説明が「オンにすると、このプロフィール宛ての通知がこの端末に届きます」
- 新しい 2 つの route の test は既存の `subscription/route.test.ts` の書き方に合わせる

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/modules/notifications src/app/api/notifications`
Expected: 新しいテストが FAIL

- [ ] **Step 3: Implement**

`usePushDevice` の effect は `activeProfileId`（`useAuthStore`）を依存に入れる。`NotificationSettings` は「このプロフィール」の節（`push_enabled` のスイッチ）を消す。

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"` と `pnpm exec vitest run`
Expected: `tsc exit 0`、vitest 全件 pass

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend
git commit -s -m "feat(dystopia/frontend): choose which profiles each device receives"
```
