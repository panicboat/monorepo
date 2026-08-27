# Billing Slice Design (Stripe Monthly Subscription)

Date: 2026-08-26 (revised 2026-08-28 to reflect Cognito-based identity)
Slice: `billing` (new)

## Overview

新規 `billing` slice を monolith に追加し、Stripe の月額サブスクリプションを基盤として提供する。Guest / Cast それぞれに 1 tier の paid plan (trial あり) を提供し、支払い UI は Stripe hosted (Checkout + Customer Portal) を採用する。

本設計は「サブスクリプション基盤の完成」にスコープを絞り、他 slice の entitlement 適用 (例: paid guest のみ閲覧可の機能ゲート) は次フェーズに委ねる。

### Goals

- Guest / Cast それぞれが Stripe Checkout で 1 tier の月額プランに加入できる
- Stripe Customer Portal で cancel / カード変更 / 過去請求書閲覧ができる
- webhook で subscription 状態を DB に mirror し、`Billing::Queries::ActiveSubscription` を他 slice から参照可能にする
- trial (無料お試し期間) をサポートする
- Stripe と DB の齟齬を検知・修復する運用手段を提供する

### Non-Goals (次フェーズ)

- 他 slice からの entitlement 適用 (機能ゲート実装)
- Multi-tier plan、annual plan、proration
- コンビニ / 銀行振込などカード以外の決済手段
- Invoice / PaymentMethod のミラー
- Trial 濫用防止 (2 回目 trial 制限)
- reconcile task の cron 化 (MVP は手動起動)
- 通知メール送信 (trial_will_end 等)

## Product Context

- 対象アプリ: cast / guest 型サービス。1 アカウントは `identity__accounts.role` により Guest か Cast のどちらか一方に区別される (アプリレイヤで保証)
- 通貨: JPY 固定
- 課金サイクル: 月次のみ
- サブスクリプション形態: 1 account 高々 1 subscription (Free 時 0、Paid 中 1)
- trial: あり (期間は Stripe Price 側で設定)
- Stripe Customer 作成タイミング: 初回 Checkout 呼び出し時に lazy
- 支払い UI: Stripe hosted (Checkout Session + Customer Portal)

### Identity model (post-Cognito)

`feat/identity-cognito-migration` (PR #1016, merged 2026-08-26) 後の identity は以下の形:

- テーブル: `identity__accounts (id :uuid, role Integer, deactivated_at, created_at, updated_at)`
- `accounts.id` は **Cognito user pool の `sub`** (UUID フォーマットの string)。認証は Cognito に完全委譲、監視すべき最小限のプロファイル (role + deactivated_at) のみ monolith が保持
- 参照経路: `Identity::Slice["repositories.account_repository"]#find_by_id(sub) -> Struct(id, role, deactivated_at, ...)`
- gRPC 認証層 (`Interceptors::AuthenticationInterceptor` + `lib/grpc/authenticatable.rb`) は Cognito sub を `Current.user_id` に格納する (module 名は歴史的経緯で `user_id` のままだが、値は Cognito sub = accounts.id)

Billing はこの `accounts.id` を canonical な identifier として使う。billing 内の識別子名は `account_id` に統一する。`Current.user_id` (歴史名) を handler 境界で `account_id` に読み替える。

## Architecture

### Slice layout

```
dystopia/monolith/slices/billing/
  adapters/
    stripe_client.rb              # ::Stripe SDK を薄くラップ (test で差し替え可能)
  config/
    plan_registry.rb              # role → stripe_price_id マッピング
  db/
    relation.rb / repo.rb / struct.rb
  relations/
    customers.rb                  # schema(:billing__customers, as: :customer_records, ...)
    subscriptions.rb              # schema(:billing__subscriptions, as: :subscription_records, ...)
    stripe_events.rb              # schema(:billing__stripe_events, as: :stripe_event_records, ...)
  grpc/
    billing_handler.rb            # Gruf handler
    handler.rb                    # Gruf 登録
  actions/
    webhooks/
      stripe.rb                   # Hanami action (HTTP webhook 受け口)
  use_cases/
    get_my_subscription.rb
    create_checkout_session.rb
    create_customer_portal_session.rb
    process_webhook_event.rb
  repositories/
    customer_repository.rb
    subscription_repository.rb
    stripe_event_repository.rb
  queries/
    active_subscription.rb        # 他 slice からの entitlement 判定原型
  tasks/
    reconcile.rb                  # reconcile 実装 (rake から呼び出し)
```

### Proto (`proto/dystopia/billing/v1/service.proto`)

```proto
service BillingService {
  rpc GetMySubscription(GetMySubscriptionRequest) returns (GetMySubscriptionResponse);
  rpc CreateCheckoutSession(CreateCheckoutSessionRequest) returns (CreateCheckoutSessionResponse);
  rpc CreateCustomerPortalSession(CreateCustomerPortalSessionRequest) returns (CreateCustomerPortalSessionResponse);
}

message Subscription {
  Status status = 1;
  google.protobuf.Timestamp current_period_end = 2;
  bool cancel_at_period_end = 3;
  string price_id = 4;

  enum Status {
    STATUS_UNSPECIFIED = 0;
    TRIALING = 1;
    ACTIVE = 2;
    INCOMPLETE = 3;
    INCOMPLETE_EXPIRED = 4;
    PAST_DUE = 5;
    CANCELED = 6;
    UNPAID = 7;
    PAUSED = 8;
  }
}

message GetMySubscriptionRequest {}
message GetMySubscriptionResponse {
  Subscription subscription = 1;  // 未加入 (完全 Free) は unset
}

message CreateCheckoutSessionRequest {}
message CreateCheckoutSessionResponse { string url = 1; }

message CreateCustomerPortalSessionRequest {}
message CreateCustomerPortalSessionResponse { string url = 1; }
```

3 状態の判別:
- **完全 Free**: `subscription` unset (DB 上 `billing__subscriptions` に行なし)
- **Trial 中**: `subscription.status = TRIALING`、`current_period_end` は trial 終了日
- **Paid**: `subscription.status = ACTIVE`

### HTTP route (`config/routes.rb`)

```ruby
slice :billing, at: "/billing" do
  post "/webhooks/stripe", to: "webhooks.stripe"
end
```

k8s Ingress で `/billing/webhooks/stripe` は認証不要で外部公開。他の billing パスは gRPC 経由のため HTTP 公開不要。

### Dependencies

- Gemfile に `gem "stripe"` を追加

## Data Model

### Migrations

`config/db/migrate/YYYYMMDDHHMMSS_create_billing_schema.rb`:

```ruby
ROM::SQL.migration do
  change do
    create_schema :billing

    create_table :"billing__customers" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :stripe_customer_id, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id], name: :uq_billing_customers_account_id
      unique [:stripe_customer_id], name: :uq_billing_customers_stripe_customer_id
    end

    create_table :"billing__subscriptions" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :stripe_subscription_id, :text, null: false
      column :stripe_price_id, :text, null: false
      column :status, :text, null: false
      column :current_period_end, :timestamptz, null: false
      column :cancel_at_period_end, :boolean, null: false, default: false
      column :canceled_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id], name: :uq_billing_subscriptions_account_id
      unique [:stripe_subscription_id], name: :uq_billing_subscriptions_stripe_subscription_id
    end
    run <<~SQL
      CREATE INDEX idx_billing_subscriptions_status
        ON billing.subscriptions (status)
    SQL

    create_table :"billing__stripe_events" do
      column :id, :uuid, null: false
      column :stripe_event_id, :text, null: false
      column :event_type, :text, null: false
      column :payload, :jsonb, null: false
      column :processed_at, :timestamptz
      column :error_message, :text
      column :received_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:stripe_event_id], name: :uq_billing_stripe_events_stripe_event_id
    end
    run <<~SQL
      CREATE INDEX idx_billing_stripe_events_event_type
        ON billing.stripe_events (event_type)
    SQL
    run <<~SQL
      CREATE INDEX idx_billing_stripe_events_processed_at
        ON billing.stripe_events (processed_at)
    SQL
  end
end
```

`billing__customers.account_id` / `billing__subscriptions.account_id` を unique にする根拠: 1 account = 1 role = 1 subscription という product 前提。将来 tier や複数プラン購入が必要になったら unique を外し `(account_id, stripe_subscription_id)` の複合キー運用に切り替える。

`status` は Stripe の subscription status enum の文字列表現をそのまま格納: `trialing`, `active`, `incomplete`, `incomplete_expired`, `past_due`, `canceled`, `unpaid`, `paused`。

### Relation namespace

karte を含む既存 slice に倣い、各テーブルごとに `relations/<name>.rb` を作成して `schema(:table, as: :<name>_records, infer: false) do ... end` で ROM alias を宣言する。repository は `customer_records` / `subscription_records` / `stripe_event_records` を参照する。

## Mirror Rule

Stripe → DB の書き込み口は **webhook のみ** に限定する。write 系 gRPC (Checkout / Portal Session 作成) は subscription 行を触らない。

| 契機 | 動作 |
|---|---|
| `CreateCheckoutSession` | `billing__customers` を lookup。未作成なら Stripe Customer API で作成 (`metadata.account_id` 付与) し upsert。Checkout Session を作成して URL 返却。subscription 行は作らない |
| `CreateCustomerPortalSession` | `billing__customers` を lookup。Stripe Billing Portal Session を作成し URL 返却。DB 変更なし |
| webhook `customer.subscription.created` | `billing__subscriptions` を upsert (account_id は `billing__customers.stripe_customer_id` 逆引き) |
| webhook `customer.subscription.updated` | 同 upsert (status / current_period_end / cancel_at_period_end 更新) |
| webhook `customer.subscription.deleted` | `status = 'canceled'`, `canceled_at = now()` |
| webhook `customer.subscription.trial_will_end` | 受信ログのみ (`stripe_events` に processed_at セット)。通知処理は次フェーズ |
| webhook `checkout.session.completed` | 受信ログのみ。subscription 状態は `subscription.created` を authoritative とする (Stripe 公式推奨) |
| webhook 未対応 event type | 受信ログのみで無視 |

### Stripe Customer への account_id 引き渡し

Customer 作成時に `metadata: { account_id: <sub> }` を付与。webhook 側では `stripe_customer_id` から `billing__customers` を引いて `account_id` を得る (metadata に依存しない逆引き経路を主とし、metadata は運用時の確認用)。

### Idempotency

Stripe API 呼び出しには Idempotency-Key を付ける:
- Customer 作成: `"billing:create_customer:<account_id>"`
- Checkout Session 作成: `"billing:create_checkout:<account_id>:<yyyymmddhh>"` (1 時間粒度)
- Portal Session 作成: `"billing:create_portal:<account_id>:<yyyymmddhh>"`

Frontend の重複クリック / DB upsert 失敗後の再試行時に、Stripe 側で重複 Customer を作らないことを保証する。

### Active subscription 判定

- 完全 Free / trial 中 / paid の区別が必要な UI: `subscription_repository.find_by_account_id(account_id)` の行有無 + `status` を使用
- entitlement 判定 (次フェーズ用の原型): `Billing::Queries::ActiveSubscription#call(account_id)` は `status IN ('trialing', 'active') AND current_period_end > now()` の 1 行を返す。`cancel_at_period_end` は entitlement 有効性に影響しない (期末までは有効)

## Data Flows

### Flow A: Subscribe (Free → Trial/Paid)

1. Frontend: `Upgrade` ボタン → gRPC `CreateCheckoutSession`
2. Monolith handler: `Current.user_id` (Cognito sub) を `account_id` として use case に渡す
3. Monolith: `Identity::Slice["repositories.account_repository"]#find_by_id(account_id)` で account.role を取得。role に対応する price_id を `PlanRegistry` から解決
4. Monolith: `billing__customers` を lookup。未作成なら Stripe `POST /v1/customers` で作成 (`metadata: { account_id: <sub> }`) → `billing__customers` upsert
5. Monolith: Stripe `POST /v1/checkout/sessions` を発行 (`mode=subscription`, `customer=<cus_...>`, `line_items=[{price_id, quantity=1}]`, `success_url`, `cancel_url`)
6. Frontend: 返却 URL に `window.location` で redirect
7. Stripe hosted: user が決済 or trial 開始 → success_url に redirect
8. Stripe → Monolith: `checkout.session.completed` / `customer.subscription.created` webhook
9. Monolith: subscription を mirror upsert
10. Frontend: success_url 帰還後に `GetMySubscription` で最新状態取得

Success URL は frontend settings 画面 (例: `/settings/billing?checkout=success`)。webhook 到達が redirect より遅れうるため、frontend は反映されるまで 3〜5 秒間隔で最大 3 回 re-fetch する UX を実装する。

### Flow B: Cancel / カード変更 (Customer Portal)

1. Frontend: `Manage subscription` ボタン → gRPC `CreateCustomerPortalSession`
2. Monolith: `billing__customers` lookup → Stripe `POST /v1/billing_portal/sessions` (`customer`, `return_url`)
3. Frontend: 返却 URL に redirect
4. Stripe hosted Portal: user が cancel / カード変更 / invoice 閲覧
5. Stripe → Monolith: `customer.subscription.updated` / `.deleted` webhook
6. Monolith: subscription を mirror upsert

Portal の設定 (Stripe Dashboard 側):
- 有効化: cancel、update payment method、view invoices / billing history
- 無効化: plan 変更 (各 role 1 tier のため不要)

Portal で trialing 中に cancel すると **無料 trial が即終了し即時課金の invoice が作成される** (Stripe 公式挙動)。UX 上そのまま許容し、cancel 確認ダイアログはあくまで Stripe 側の表現に委ねる。

### Flow C: Webhook 処理

```
POST /billing/webhooks/stripe
  1. raw body + Stripe-Signature ヘッダ取得
  2. Stripe::Webhook.construct_event(payload, sig, endpoint_secret)
     - Stripe::SignatureVerificationError / JSON::ParserError → 400
  3. billing__stripe_events を stripe_event_id で lookup
     - 既存 & processed_at != null → 200 (dedupe)
     - 既存 & processed_at == null → 再処理
     - 未登録 → payload 込みで insert
  4. event_type で dispatch (transaction 内):
     - customer.subscription.created / .updated → subscription upsert (account_id は customer 逆引き)
     - customer.subscription.deleted → status=canceled, canceled_at=now
     - customer.subscription.trial_will_end → 受信ログのみ
     - checkout.session.completed → 受信ログのみ
     - 未対応 type → 受信ログのみ
  5. processed_at = now(), error_message = nil を同 transaction で commit
  6. 200 応答
  例外時: processed_at = null のまま error_message にスタック → 500 応答
  (Stripe が指数バックオフで retry。production 最大 3 日、sandbox 数時間 3 回)
```

`billing__stripe_events` insert / update と `billing__subscriptions` upsert は同一 transaction に含める。片方成功・片方失敗を防止。

### Out-of-order defense

Stripe は event の順序配信を保証しない (公式明記)。handler 側で以下を実装:

- `canceled` を終端 status として扱う。mirror が `canceled` の状態で `updated` が来て status が別値でも、`canceled` を維持する (`deleted` 後の遅延した `updated` に対する防御)
- `subscription` object の `status` を authoritative とし、Stripe 側の値を無条件に上書きするのではなく上記ルールでフィルタする

## Error Handling

### Stripe API 呼び出しエラー (billing → Stripe)

| Stripe SDK 例外 | gRPC status | frontend UX |
|---|---|---|
| `Stripe::APIConnectionError` | `UNAVAILABLE` | 再試行ボタン表示 |
| `Stripe::RateLimitError` | `RESOURCE_EXHAUSTED` | 少し待って再試行 |
| `Stripe::AuthenticationError` | `INTERNAL` | 汎用エラー banner |
| `Stripe::InvalidRequestError` | `INTERNAL` | 汎用エラー banner |
| `Stripe::APIError` | `INTERNAL` | 汎用エラー banner |

### Webhook 受信エラー

| 状況 | 応答 | DB |
|---|---|---|
| 署名不一致 / 壊れた JSON | 400 | 変更なし |
| dedupe hit (処理済み) | 200 | 変更なし |
| dedupe miss + handler 成功 | 200 | subscription upsert + stripe_events 更新 (同 transaction) |
| dedupe miss + handler 例外 | 500 | stripe_events に error_message 保存、processed_at は null のまま (Stripe が retry) |

### データ齟齬の検出と修復

MVP では以下の 3 経路を用意:

- **Stripe Dashboard**: 個別 event を "Resend" (作成後 15 日まで)
- **Stripe CLI**: `stripe events resend <event_id>` (作成後 30 日まで)
- **reconcile rake task** (MVP に含む): `bundle exec rake billing:reconcile` を実装。全 `billing__customers` について Stripe から subscription 現状を取得し、mirror と差分がある場合は Stripe を SOT として mirror を上書き。OTel で差分数を出す。cron 化は次フェーズ

### Observability

monolith は既に OpenTelemetry SDK + auto-instrumentation 導入済み。billing 側で追加する span attributes:

- `billing.account_id`
- `billing.stripe_customer_id`
- `billing.stripe_subscription_id`
- `billing.event_type` (webhook)
- `billing.event_id` (webhook)
- `billing.action` (`create_checkout_session` / `create_portal_session` / `webhook_received` / `subscription_upsert` 等)

**個人情報 (メールアドレス、カード末尾等) を span attribute に載せない**。

## Configuration

Hanami settings (env 経由):

- `STRIPE_API_KEY` (secret, k8s Secret)
- `STRIPE_WEBHOOK_SECRET` (secret, k8s Secret)
- `STRIPE_PRICE_ID_GUEST` (public, ConfigMap)
- `STRIPE_PRICE_ID_CAST` (public, ConfigMap)
- `BILLING_SUCCESS_URL` (public, ConfigMap)
- `BILLING_CANCEL_URL` (public, ConfigMap)
- `BILLING_PORTAL_RETURN_URL` (public, ConfigMap)

test / staging / production は別 Stripe アカウント (test mode / live mode) を使用。webhook endpoint は各環境で Stripe Dashboard に個別登録し、それぞれ独自の signing secret を持つ。

Price / Product は Stripe Dashboard で手動作成 (2 product × 各 1 price)、price_id を settings で管理。Stripe → DB の product sync は行わない (YAGNI)。

### Security

- 署名検証を primary defense とする (`Stripe::Webhook.construct_event`)
- Stripe 公開 IP レンジからのみ受け付ける allowlist を k8s Ingress または NetworkPolicy で defense-in-depth として設定
- webhook route の Hanami middleware chain が raw request body を改変しないことを実装時に verify (署名検証は raw body 必須)

## Testing

### 差し替え戦略

`Billing::Adapters::StripeClient` で Stripe SDK 呼び出しを一元化。spec では `Spec::Billing::FakeStripeClient` (in-memory hash 実装) を Hanami DI で差し替える。webhook 署名は fake が固定 secret + 実 HMAC で通す挙動を再現。VCR / stub library には依存しない (fake は自前・最小)。

### Layers

| Layer | 対象 | 実 DB | Stripe |
|---|---|---|---|
| Repository spec | `subscription_repository` / `customer_repository` / `stripe_event_repository` の CRUD、unique 制約、find 条件 | real | 未使用 |
| Use case spec | 全 use case + `Queries::ActiveSubscription` | real | FakeStripeClient |
| gRPC handler spec | 各 RPC の request/response、認証 enforcement | real | FakeStripeClient |
| Webhook action spec | Rack 単位、署名検証、dedupe、handler 例外時 500 | real | FakeStripeClient |
| Reconcile rake spec | 一致 / 相違 / mirror 欠落 の 3 ケース | real | FakeStripeClient (事前 subscription 注入) |

### Scenarios (必須)

**`create_checkout_session`**
- 完全 Free → Stripe Customer 作成 + `billing__customers` upsert + Session URL 返却
- 既に customer 作成済 → customer 再作成せず URL のみ返却
- role=Guest → guest price_id、role=Cast → cast price_id、それ以外 → error
- 既にアクティブ subscription あり → `FAILED_PRECONDITION`
- Stripe 各種エラー → 例外マップ (§ Error Handling 表と一致)

**`create_customer_portal_session`**
- customer 未作成 (checkout 未実施) → `FAILED_PRECONDITION`
- customer あり → URL 返却
- Stripe エラー → 例外マップ

**`get_my_subscription`**
- subscription 行なし → unset (完全 Free)
- status=trialing / active / past_due / canceled それぞれ proto enum に正しくマップ
- `cancel_at_period_end`, `current_period_end`, `price_id` の透過

**`process_webhook_event`**
- `customer.subscription.created` (新規 account) → upsert
- `customer.subscription.updated` (status 遷移) → 更新
- `customer.subscription.deleted` → canceled + canceled_at
- **out-of-order**: `deleted` 後の `updated` (status=active) → mirror を canceled のまま維持
- **dedupe**: 同 event.id 2 回 → 2 回目 no-op
- 未対応 event type → processed_at セットして黙って通す
- handler 内 raise → error_message 記録、processed_at null、例外伝播

**Webhook action**
- 署名ヘッダなし → 400
- 署名不一致 → 400
- 正しい署名 + 壊れた JSON → 400
- 正しい署名 + 正しい payload → use case 呼び出し + 200
- use case 例外 → 500

### Manual dogfood (MVP 受け入れ条件)

実装完了後に Stripe test mode で 1 セッション実機通しを必須とする:

1. Stripe CLI で `stripe listen --forward-to localhost:<port>/billing/webhooks/stripe`
2. frontend 起動、Guest test account (Cognito 上に用意) で Upgrade → hosted checkout (test card `4242 4242 4242 4242`) → 成功
3. `GetMySubscription` で `TRIALING` 返却確認
4. `stripe trigger customer.subscription.updated` → ACTIVE 遷移確認
5. Portal → cancel → `cancel_at_period_end=true` mirror 反映確認
6. `stripe trigger invoice.payment_failed` → 受信ログのみ (subscription state は subscription.updated 経由なのでこの trigger 単体では state 変わらないことも確認)
7. Cast test account で同じフローを Cast price で実行

上記全てが unit spec + dogfood で pass することが完了条件。dogfood で新たな gap が出た場合、spec を追加してから修正 (TDD)。

### CI

monolith CI は `bundle install --frozen` + image build のみで rspec を回さない。billing 導入時:

- Gemfile に `stripe` gem を追加 → `bundle install` → Gemfile.lock 更新
- push 前にローカルで `bundle exec rspec slices/billing spec/slices/billing` を実行し green を確認 (CI 通過 ≠ テスト green)
- push 前に `bundle install --frozen` を実行し lockfile 整合性を確認

## Rollout Considerations

- **Feature flag は使わない**: この機能は未運用アプリへの追加であり、段階的 rollout / 既存アカウント保護の要件がない
- **Stripe Dashboard 設定**: 実装完了後、以下を Dashboard で行う (実装 PR とは別作業):
  - Product / Price 作成 (Guest 用、Cast 用、それぞれ trial period 設定)
  - Customer Portal 設定 (cancel / update payment method / view invoices を有効、plan 変更を無効)
  - Webhook endpoint 登録 (test/staging/production の URL 個別)
- **k8s Secret 投入**: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` を各環境の k8s Secret に追加
- **Ingress / NetworkPolicy**: `/billing/webhooks/stripe` の公開設定 + Stripe 公開 IP allowlist の追加

## Open Items (implementation-time judgement)

- webhook action の CSRF 除外方法 (Hanami 3 の CSRF middleware 有無を実装時に verify)
- webhook route の raw body 保持を middleware chain で verify
- FakeStripeClient の具体 API 面 (実装時に Stripe SDK signatures と一致させる)
- reconcile rake task の差分検出出力形式 (CLI stdout + OTel span attribute)
- `current_period_end` の取得元 (使用する Stripe API version で Subscription object 直下か、Subscription Item 側にあるかを実装時に確認し、mirror 側の source を決定)
- Hanami settings の string 型宣言方法 (`Types::String` が使えるか、他 slice の慣例を verify)
