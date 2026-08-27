# Billing Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monolith に `billing` slice を追加し、Guest / Cast それぞれ 1 tier の月額 Stripe subscription 基盤 (Checkout + Customer Portal + webhook mirror + entitlement query) を提供する。

**Architecture:** Hanami 3 slice。karte slice をテンプレートに `db/{relation,repo,struct}.rb` + `relations/*.rb` + `repositories/` + `use_cases/` + `grpc/handler` + `adapters/` + `actions/webhooks/` を作る。Stripe SDK 呼び出しは `Billing::Adapters::StripeClient` に集約し spec では `FakeStripeClient` に差し替え。DB への書き込み口を webhook のみに絞り、event dedupe + `canceled` 終端ルールで冪等・out-of-order 耐性を持たせる。

**Tech Stack:** Ruby, Hanami 3 (slice), Gruf (gRPC), ROM-SQL + Sequel, PostgreSQL, dry-operation / dry-validation, Stripe Ruby SDK, RSpec + database_cleaner-sequel, protoc + grpc_ruby_plugin (buf).

**Spec:** `docs/superpowers/specs/2026-08-26-billing-slice-design.md`

## Global Constraints

- Ruby は worktree の `.ruby-version` に従う (勝手に上げない)
- Hanami は `~> 3.0`、`hanami-*` gem 群は既存の Gemfile pin を維持
- 新規追加 gem: `stripe` のみ (バージョンは実装時に latest stable、Gemfile.lock を締める)
- 全ての Ruby ファイル冒頭に `# frozen_string_literal: true`
- モジュール名: 常に `Billing::…`
- DB schema 名 / table 名: `billing__customers` / `billing__subscriptions` / `billing__stripe_events` (Postgres schema `billing` の下)
- gRPC service 名: `billing.v1.BillingService`
- **canonical identifier: `account_id`** (Cognito sub = `identity__accounts.id`)。billing の repository / use case / handler / migration / metadata / Idempotency-Key すべて `account_id`。`user_id` という名前を billing で使わない (`Current.user_id` は歴史名で identity 側管轄、handler 境界で `current_user_id` を `account_id:` として use case に渡す)
- **Identity 参照経路: `Identity::Slice["repositories.account_repository"]#find_by_id(sub) -> Struct(id, role, deactivated_at, ...)`**
- Stripe status enum は文字列で DB 保存 (`trialing / active / incomplete / incomplete_expired / past_due / canceled / unpaid / paused`)
- Proto の Subscription.Status enum は spec §Architecture 参照 (`STATUS_UNSPECIFIED=0` から)
- Stripe API 呼び出しは全て `Billing::Adapters::StripeClient` 経由 (直接 `::Stripe::…` を触るのは adapter とテスト用 fake のみ)
- Stripe → DB の書き込み口は webhook のみ (`process_webhook_event` use case)。他 use case / rake task が subscription 行を作ることは禁止 (reconcile task を除く)
- webhook 対象 event: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `checkout.session.completed`
- Idempotency-Key: Customer 作成 = `"billing:create_customer:<account_id>"`、Checkout Session = `"billing:create_checkout:<account_id>:<yyyymmddhh>"`、Portal Session = `"billing:create_portal:<account_id>:<yyyymmddhh>"`
- コミット: `-s` 必須、`Co-Authored-By` 付与禁止
- 出力言語: 日本語 (コード内 identifier / commit message / PR title は英語)
- CI は rspec を回さない。**各タスクの完了条件に「ローカルで対象 spec を green」を含める**
- Gemfile を触ったら push 前に `bundle install --frozen` で lockfile 整合性を確認

## Reference (implementation-time に見ろ)

- **spec**: `docs/superpowers/specs/2026-08-26-billing-slice-design.md`
- **slice template**: `dystopia/monolith/slices/karte/` を全面参照
- **relations file 例**: `dystopia/monolith/slices/karte/relations/{entries,access,reports}.rb` — `schema(:table, as: :xxx_records, infer: false) do ... end` で ROM alias 宣言
- **gRPC handler の base**: `dystopia/monolith/slices/karte/grpc/{handler,karte_handler}.rb`
- **identity account repository**: `dystopia/monolith/slices/identity/repositories/account_repository.rb` (`#find_by_id(sub) -> Struct`, `#create(sub:, role:)`, etc.)
- **identity accounts relation**: `dystopia/monolith/slices/identity/relations/accounts.rb`
- **他 slice の accounts 参照例**: `dystopia/monolith/slices/karte/use_cases/create_entry.rb:41`、`slices/discovery/use_cases/suggest_users.rb:68`
- **use_case DI パターン**: `dystopia/monolith/slices/karte/use_cases/get_my_access.rb`
- **repository パターン**: `dystopia/monolith/slices/karte/repositories/{access,entry}_repository.rb`
- **use_case spec パターン**: `dystopia/monolith/spec/slices/karte/use_cases/get_my_access_spec.rb`
- **repository spec パターン**: `dystopia/monolith/spec/slices/karte/repositories/entry_repository_spec.rb` (`type: :database`)
- **migration 例**: `dystopia/monolith/config/db/migrate/20260628000000_create_karte_schema.rb`、`20260826132540_create_identity_accounts.rb`
- **rake task 例**: `dystopia/monolith/lib/tasks/account.rake`
- **gRPC server 登録**: `dystopia/monolith/bin/grpc`
- **spec_helper**: `dystopia/monolith/spec/spec_helper.rb`
- **`Current` module**: `dystopia/monolith/lib/current.rb` (`Current.user_id` は Cognito sub を保持)

---

## Task 1: stripe gem + monolith settings scaffolding

**Files:**
- Modify: `dystopia/monolith/Gemfile`
- Modify: `dystopia/monolith/Gemfile.lock`
- Modify: `dystopia/monolith/config/settings.rb`
- Create: `dystopia/monolith/.env.test`
- Create: `dystopia/monolith/spec/config/settings_spec.rb`

**Interfaces:**
- Consumes: —
- Produces:
  - `Hanami.app["settings"]` に `stripe_api_key`, `stripe_webhook_secret`, `stripe_price_id_guest`, `stripe_price_id_cast`, `billing_success_url`, `billing_cancel_url`, `billing_portal_return_url` (全 `String`)
  - `::Stripe` (gem loaded)

- [ ] **Step 1: Gemfile に `gem "stripe"` 追加** (jwt の近く)

- [ ] **Step 2: bundle install**

```bash
cd dystopia/monolith
bundle install
```

worktree で bundle が未完了なら依存全体が入る (期待動作)。

- [ ] **Step 3: settings.rb**

```ruby
# frozen_string_literal: true

module Monolith
  class Settings < Hanami::Settings
    setting :stripe_api_key,             constructor: Types::String
    setting :stripe_webhook_secret,      constructor: Types::String
    setting :stripe_price_id_guest,      constructor: Types::String
    setting :stripe_price_id_cast,       constructor: Types::String
    setting :billing_success_url,        constructor: Types::String
    setting :billing_cancel_url,         constructor: Types::String
    setting :billing_portal_return_url,  constructor: Types::String
  end
end
```

`Types::String` は `lib/types.rb` 定義。無ければ `Dry::Types['string']` で代替 (実装時 verify)。

- [ ] **Step 4: `dystopia/monolith/.env.test` 新規作成**

```
STRIPE_API_KEY=sk_test_dummy_replace_via_stripe_dashboard
STRIPE_WEBHOOK_SECRET=whsec_dummy_replace_via_stripe_dashboard
STRIPE_PRICE_ID_GUEST=price_dummy_guest
STRIPE_PRICE_ID_CAST=price_dummy_cast
BILLING_SUCCESS_URL=http://localhost:3000/settings/billing?checkout=success
BILLING_CANCEL_URL=http://localhost:3000/settings/billing?checkout=cancel
BILLING_PORTAL_RETURN_URL=http://localhost:3000/settings/billing
```

既存 `dystopia/monolith/.env` が git 管理下で開発共通値を持つのと同じ流儀。すべて placeholder であり本物の secret ではない。

- [ ] **Step 5: `bundle install --frozen`**

- [ ] **Step 6: spec を作成**

`dystopia/monolith/spec/config/settings_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "billing settings" do
  let(:settings) { Hanami.app["settings"] }

  it "exposes stripe_api_key" do
    expect(settings.stripe_api_key).to be_a(String)
  end

  it "exposes stripe_webhook_secret" do
    expect(settings.stripe_webhook_secret).to be_a(String)
  end

  it "exposes both price ids and billing URLs" do
    expect(settings.stripe_price_id_guest).to be_a(String)
    expect(settings.stripe_price_id_cast).to be_a(String)
    expect(settings.billing_success_url).to be_a(String)
    expect(settings.billing_cancel_url).to be_a(String)
    expect(settings.billing_portal_return_url).to be_a(String)
  end
end
```

- [ ] **Step 7: spec を green で実行**

```bash
HANAMI_ENV=test bundle exec rspec spec/config/settings_spec.rb
```

- [ ] **Step 8: Commit**

```bash
git add dystopia/monolith/Gemfile dystopia/monolith/Gemfile.lock \
        dystopia/monolith/config/settings.rb \
        dystopia/monolith/.env.test \
        dystopia/monolith/spec/config/settings_spec.rb
git commit -s -m "feat(monolith/billing): add stripe gem and billing settings scaffolding"
```

---

## Task 2: Proto + codegen + gRPC boot wiring

**Files:**
- Create: `proto/dystopia/billing/v1/service.proto`
- Modify: `dystopia/monolith/bin/grpc`
- Generated: `dystopia/monolith/stubs/billing/v1/*`

**Interfaces:**
- Produces: `::Billing::V1::BillingService::Service`、`::Billing::V1::Subscription` (with `Status` enum)、3 対の Request/Response

- [ ] **Step 1: `proto/dystopia/billing/v1/service.proto`**

```proto
syntax = "proto3";

package billing.v1;

import "google/protobuf/timestamp.proto";

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
  // 未加入 (完全 Free) は unset。TRIALING / ACTIVE / その他 status は Subscription を返す。
  Subscription subscription = 1;
}

message CreateCheckoutSessionRequest {}
message CreateCheckoutSessionResponse { string url = 1; }

message CreateCustomerPortalSessionRequest {}
message CreateCustomerPortalSessionResponse { string url = 1; }
```

- [ ] **Step 2: codegen 実行**

```bash
cd dystopia/monolith
bundle exec bin/codegen
```

生成物: `stubs/billing/v1/service_pb.rb`, `service_services_pb.rb`

- [ ] **Step 3: `bin/grpc` に require 追加**

既存の `require "karte/v1/service_services_pb"` 近くに:

```ruby
require "billing/v1/service_services_pb"
```

- [ ] **Step 4: 生成物 smoke 確認**

```bash
bundle exec ruby -Istubs -e 'require "billing/v1/service_services_pb"; puts ::Billing::V1::BillingService::Service.rpc_descs.keys.inspect'
```

Expected: `[:GetMySubscription, :CreateCheckoutSession, :CreateCustomerPortalSession]`

- [ ] **Step 5: enum 値確認**

```bash
bundle exec ruby -Istubs -e 'require "billing/v1/service_services_pb"; puts ::Billing::V1::Subscription::Status.constants.inspect'
```

- [ ] **Step 6: Commit**

```bash
git add proto/dystopia/billing/ \
        dystopia/monolith/stubs/billing/ \
        dystopia/monolith/bin/grpc
git commit -s -m "feat(proto/billing): define BillingService v1 proto and wire monolith gRPC boot"
```

---

## Task 3: DB migration for billing schema

**Files:**
- Create: `dystopia/monolith/config/db/migrate/<TS>_create_billing_schema.rb` (`<TS>` = `date -u '+%Y%m%d%H%M%S'`)

**Interfaces:**
- Produces: Postgres schema `billing` と 3 テーブル (`customers` / `subscriptions` / `stripe_events`)

- [ ] **Step 1: migration ファイル作成**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS billing"

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

  down do
    drop_table :"billing__stripe_events"
    drop_table :"billing__subscriptions"
    drop_table :"billing__customers"
    run "DROP SCHEMA IF EXISTS billing CASCADE"
  end
end
```

- [ ] **Step 2: test DB に migration 適用**

```bash
HANAMI_ENV=test bundle exec rake db:migrate
```

- [ ] **Step 3: schema 確認**

```bash
HANAMI_ENV=test bundle exec ruby -e '
  require "hanami/prepare"
  db = Hanami.app["db.gateway"].connection
  puts db["SELECT table_name FROM information_schema.tables WHERE table_schema = ?", "billing"].map(:table_name).inspect
'
```

Expected: `["customers", "subscriptions", "stripe_events"]`

- [ ] **Step 4: rollback / re-migrate**

```bash
HANAMI_ENV=test bundle exec rake db:rollback
HANAMI_ENV=test bundle exec rake db:migrate
```

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/config/db/migrate/
git commit -s -m "feat(monolith/billing): add migration for billing schema (customers/subscriptions/stripe_events)"
```

---

## Task 4: Billing slice DB scaffolding

**Files:**
- Create: `dystopia/monolith/slices/billing/db/{relation,repo,struct}.rb`

**Interfaces:**
- Produces: `Billing::DB::{Relation,Repo,Struct}` (Monolith 版の subclass、空)

- [ ] **Step 1: 3 ファイル作成**

`relation.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

`repo.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

`struct.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module DB
    class Struct < Monolith::DB::Struct
    end
  end
end
```

- [ ] **Step 2: slice boot smoke**

```bash
HANAMI_ENV=test bundle exec ruby -e '
  require "hanami/prepare"
  puts ::Billing::Slice.class.name
  puts ::Billing::DB::Repo.superclass.name
'
```

Expected: `Hanami::Slice` 系のクラス名 と `Monolith::DB::Repo`

- [ ] **Step 3: Commit**

```bash
git add dystopia/monolith/slices/billing/db/
git commit -s -m "feat(monolith/billing): add DB scaffolding for billing slice"
```

---

## Task 5: CustomerRepository + relation (TDD)

**Files:**
- Create: `dystopia/monolith/slices/billing/relations/customers.rb`
- Create: `dystopia/monolith/spec/slices/billing/repositories/customer_repository_spec.rb`
- Create: `dystopia/monolith/slices/billing/repositories/customer_repository.rb`

**Interfaces:**
- Consumes: `Billing::DB::{Relation,Repo}`
- Produces: `Billing::Repositories::CustomerRepository`
  - `#upsert_by_account_id(account_id:, stripe_customer_id:) -> Struct`
  - `#find_by_account_id(account_id) -> Struct | nil`
  - `#find_by_stripe_customer_id(stripe_customer_id) -> Struct | nil`
  - `#all -> Array<Struct>`

- [ ] **Step 1: relation**

`slices/billing/relations/customers.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module Relations
    class Customers < Billing::DB::Relation
      schema(:billing__customers, as: :customer_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :stripe_customer_id, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 2: 失敗する spec**

`spec/slices/billing/repositories/customer_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/customer_repository"

RSpec.describe Billing::Repositories::CustomerRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:account_id) { SecureRandom.uuid_v7 }
  let(:stripe_customer_id) { "cus_test_#{SecureRandom.hex(8)}" }

  describe "#upsert_by_account_id" do
    it "creates a new row when account is new" do
      row = repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
      expect(row.account_id).to eq(account_id)
      expect(row.stripe_customer_id).to eq(stripe_customer_id)
      expect(row.id).not_to be_nil
    end

    it "updates stripe_customer_id when a row for account already exists" do
      repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: "cus_old")
      updated = repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: "cus_new")
      expect(updated.stripe_customer_id).to eq("cus_new")
      expect(repo.find_by_account_id(account_id).stripe_customer_id).to eq("cus_new")
    end
  end

  describe "#find_by_account_id" do
    it "returns nil when no row exists" do
      expect(repo.find_by_account_id(account_id)).to be_nil
    end

    it "returns the row when it exists" do
      repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
      row = repo.find_by_account_id(account_id)
      expect(row.stripe_customer_id).to eq(stripe_customer_id)
    end
  end

  describe "#find_by_stripe_customer_id" do
    it "returns the row when it exists" do
      repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
      row = repo.find_by_stripe_customer_id(stripe_customer_id)
      expect(row.account_id).to eq(account_id)
    end

    it "returns nil when not found" do
      expect(repo.find_by_stripe_customer_id("cus_missing")).to be_nil
    end
  end

  describe "#all" do
    it "returns every customer row" do
      3.times { |i| repo.upsert_by_account_id(account_id: SecureRandom.uuid_v7, stripe_customer_id: "cus_#{i}") }
      expect(repo.all.size).to eq(3)
    end
  end
end
```

- [ ] **Step 3: 実行して FAIL 確認**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/customer_repository_spec.rb
```

- [ ] **Step 4: repository**

`slices/billing/repositories/customer_repository.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module Repositories
    class CustomerRepository < Billing::DB::Repo
      def upsert_by_account_id(account_id:, stripe_customer_id:)
        existing = customer_records.where(account_id: account_id).one
        if existing
          customer_records.by_pk(existing.id).command(:update).call(
            stripe_customer_id: stripe_customer_id,
            updated_at: Time.now
          )
        else
          customer_records.command(:create).call(
            id: SecureRandom.uuid_v7,
            account_id: account_id,
            stripe_customer_id: stripe_customer_id
          )
        end
      end

      def find_by_account_id(account_id)
        customer_records.where(account_id: account_id).one
      end

      def find_by_stripe_customer_id(stripe_customer_id)
        customer_records.where(stripe_customer_id: stripe_customer_id).one
      end

      def all
        customer_records.to_a
      end
    end
  end
end
```

- [ ] **Step 5: PASS 確認 + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/customer_repository_spec.rb
git add dystopia/monolith/slices/billing/relations/customers.rb \
        dystopia/monolith/slices/billing/repositories/customer_repository.rb \
        dystopia/monolith/spec/slices/billing/repositories/customer_repository_spec.rb
git commit -s -m "feat(monolith/billing): add CustomerRepository and customers relation"
```

---

## Task 6: SubscriptionRepository + relation (TDD)

**Files:**
- Create: `slices/billing/relations/subscriptions.rb`
- Create: `spec/slices/billing/repositories/subscription_repository_spec.rb`
- Create: `slices/billing/repositories/subscription_repository.rb`

**Interfaces:**
- Produces: `Billing::Repositories::SubscriptionRepository`
  - `#upsert_by_stripe_id(account_id:, stripe_subscription_id:, stripe_price_id:, status:, current_period_end:, cancel_at_period_end:, canceled_at: nil) -> Struct`
  - `#find_by_account_id(account_id) -> Struct | nil`
  - `#find_by_stripe_subscription_id(id) -> Struct | nil`
  - `#find_active_by_account_id(account_id) -> Struct | nil` (`status IN ('trialing','active') AND current_period_end > now()`)
  - `#mark_canceled(stripe_subscription_id:, canceled_at:)`

- [ ] **Step 1: relation**

`slices/billing/relations/subscriptions.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module Relations
    class Subscriptions < Billing::DB::Relation
      schema(:billing__subscriptions, as: :subscription_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :stripe_subscription_id, Types::String
        attribute :stripe_price_id, Types::String
        attribute :status, Types::String
        attribute :current_period_end, Types::Time
        attribute :cancel_at_period_end, Types::Bool
        attribute :canceled_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 2: 失敗する spec**

`spec/slices/billing/repositories/subscription_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/subscription_repository"

RSpec.describe Billing::Repositories::SubscriptionRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:account_id) { SecureRandom.uuid_v7 }
  let(:sub_id) { "sub_#{SecureRandom.hex(8)}" }
  let(:price_id) { "price_test_guest" }
  let(:period_end) { Time.now + 30 * 24 * 60 * 60 }

  def upsert(overrides = {})
    repo.upsert_by_stripe_id(
      account_id: account_id,
      stripe_subscription_id: sub_id,
      stripe_price_id: price_id,
      status: "active",
      current_period_end: period_end,
      cancel_at_period_end: false,
      **overrides
    )
  end

  describe "#upsert_by_stripe_id" do
    it "creates a new row on first call" do
      row = upsert
      expect(row.stripe_subscription_id).to eq(sub_id)
      expect(row.status).to eq("active")
      expect(row.cancel_at_period_end).to be(false)
    end

    it "updates an existing row on second call with same stripe_subscription_id" do
      upsert
      updated = upsert(status: "past_due", cancel_at_period_end: true)
      expect(updated.status).to eq("past_due")
      expect(updated.cancel_at_period_end).to be(true)
      expect(repo.find_by_account_id(account_id).stripe_subscription_id).to eq(sub_id)
    end
  end

  describe "#find_active_by_account_id" do
    it "returns row when status=active and current_period_end in future" do
      upsert(status: "active", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_account_id(account_id)).not_to be_nil
    end

    it "returns row when status=trialing and current_period_end in future" do
      upsert(status: "trialing", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_account_id(account_id)).not_to be_nil
    end

    it "returns nil when status=past_due" do
      upsert(status: "past_due", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_account_id(account_id)).to be_nil
    end

    it "returns nil when current_period_end is in the past even if status=active" do
      upsert(status: "active", current_period_end: Time.now - 3600)
      expect(repo.find_active_by_account_id(account_id)).to be_nil
    end
  end

  describe "#mark_canceled" do
    it "sets status to canceled and canceled_at" do
      upsert
      canceled_time = Time.now
      repo.mark_canceled(stripe_subscription_id: sub_id, canceled_at: canceled_time)
      row = repo.find_by_stripe_subscription_id(sub_id)
      expect(row.status).to eq("canceled")
      expect(row.canceled_at).to be_within(1).of(canceled_time)
    end
  end
end
```

- [ ] **Step 3: 実装**

`slices/billing/repositories/subscription_repository.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module Repositories
    class SubscriptionRepository < Billing::DB::Repo
      def upsert_by_stripe_id(account_id:, stripe_subscription_id:, stripe_price_id:, status:,
                              current_period_end:, cancel_at_period_end:, canceled_at: nil)
        existing = subscription_records.where(stripe_subscription_id: stripe_subscription_id).one
        attrs = {
          account_id: account_id,
          stripe_price_id: stripe_price_id,
          status: status,
          current_period_end: current_period_end,
          cancel_at_period_end: cancel_at_period_end,
          canceled_at: canceled_at,
          updated_at: Time.now
        }
        if existing
          subscription_records.by_pk(existing.id).command(:update).call(attrs)
        else
          subscription_records.command(:create).call(
            attrs.merge(id: SecureRandom.uuid_v7, stripe_subscription_id: stripe_subscription_id)
          )
        end
      end

      def find_by_account_id(account_id)
        subscription_records.where(account_id: account_id).one
      end

      def find_by_stripe_subscription_id(stripe_subscription_id)
        subscription_records.where(stripe_subscription_id: stripe_subscription_id).one
      end

      def find_active_by_account_id(account_id)
        subscription_records
          .where(account_id: account_id, status: %w[trialing active])
          .where { current_period_end > Time.now }
          .one
      end

      def mark_canceled(stripe_subscription_id:, canceled_at:)
        subscription_records
          .where(stripe_subscription_id: stripe_subscription_id)
          .command(:update)
          .call(status: "canceled", canceled_at: canceled_at, updated_at: Time.now)
      end
    end
  end
end
```

- [ ] **Step 4: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/subscription_repository_spec.rb
git add dystopia/monolith/slices/billing/relations/subscriptions.rb \
        dystopia/monolith/slices/billing/repositories/subscription_repository.rb \
        dystopia/monolith/spec/slices/billing/repositories/subscription_repository_spec.rb
git commit -s -m "feat(monolith/billing): add SubscriptionRepository and subscriptions relation"
```

---

## Task 7: StripeEventRepository + relation (TDD)

**Files:**
- Create: `slices/billing/relations/stripe_events.rb`
- Create: `spec/slices/billing/repositories/stripe_event_repository_spec.rb`
- Create: `slices/billing/repositories/stripe_event_repository.rb`

**Interfaces:**
- Produces: `Billing::Repositories::StripeEventRepository`
  - `#find_by_stripe_event_id(id) -> Struct | nil`
  - `#insert_received(stripe_event_id:, event_type:, payload:) -> Struct` (`processed_at` は nil)
  - `#mark_processed(stripe_event_id:)`
  - `#mark_failed(stripe_event_id:, error_message:)`

- [ ] **Step 1: relation**

```ruby
# frozen_string_literal: true

module Billing
  module Relations
    class StripeEvents < Billing::DB::Relation
      schema(:billing__stripe_events, as: :stripe_event_records, infer: false) do
        attribute :id, Types::String
        attribute :stripe_event_id, Types::String
        attribute :event_type, Types::String
        attribute :payload, Types::Hash
        attribute :processed_at, Types::Time.optional
        attribute :error_message, Types::String.optional
        attribute :received_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 2: 失敗する spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/stripe_event_repository"

RSpec.describe Billing::Repositories::StripeEventRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:event_id) { "evt_#{SecureRandom.hex(8)}" }
  let(:payload) { { "id" => event_id, "type" => "customer.subscription.created" } }

  describe "#insert_received" do
    it "inserts a row with processed_at nil" do
      row = repo.insert_received(stripe_event_id: event_id, event_type: "customer.subscription.created", payload: payload)
      expect(row.stripe_event_id).to eq(event_id)
      expect(row.event_type).to eq("customer.subscription.created")
      expect(row.processed_at).to be_nil
      expect(row.error_message).to be_nil
    end

    it "raises when stripe_event_id duplicates (unique constraint)" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      expect {
        repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      }.to raise_error(Sequel::UniqueConstraintViolation)
    end
  end

  describe "#find_by_stripe_event_id" do
    it "returns nil when not found" do
      expect(repo.find_by_stripe_event_id("evt_missing")).to be_nil
    end

    it "returns row when it exists" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      expect(repo.find_by_stripe_event_id(event_id).stripe_event_id).to eq(event_id)
    end
  end

  describe "#mark_processed" do
    it "sets processed_at and clears error_message" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      repo.mark_failed(stripe_event_id: event_id, error_message: "boom")
      repo.mark_processed(stripe_event_id: event_id)
      row = repo.find_by_stripe_event_id(event_id)
      expect(row.processed_at).not_to be_nil
      expect(row.error_message).to be_nil
    end
  end

  describe "#mark_failed" do
    it "sets error_message and leaves processed_at nil" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      repo.mark_failed(stripe_event_id: event_id, error_message: "kaboom")
      row = repo.find_by_stripe_event_id(event_id)
      expect(row.error_message).to eq("kaboom")
      expect(row.processed_at).to be_nil
    end
  end
end
```

- [ ] **Step 3: 実装**

```ruby
# frozen_string_literal: true

module Billing
  module Repositories
    class StripeEventRepository < Billing::DB::Repo
      def find_by_stripe_event_id(stripe_event_id)
        stripe_event_records.where(stripe_event_id: stripe_event_id).one
      end

      def insert_received(stripe_event_id:, event_type:, payload:)
        stripe_event_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          stripe_event_id: stripe_event_id,
          event_type: event_type,
          payload: Sequel.pg_jsonb(payload)
        )
      end

      def mark_processed(stripe_event_id:)
        stripe_event_records
          .where(stripe_event_id: stripe_event_id)
          .command(:update)
          .call(processed_at: Time.now, error_message: nil)
      end

      def mark_failed(stripe_event_id:, error_message:)
        stripe_event_records
          .where(stripe_event_id: stripe_event_id)
          .command(:update)
          .call(error_message: error_message)
      end
    end
  end
end
```

注: `Sequel.pg_jsonb(payload)` は Postgres jsonb 列への insert に必要な wrapper (他 slice で jsonb を扱っている箇所があれば同じ方式を採用)。

- [ ] **Step 4: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/stripe_event_repository_spec.rb
git add dystopia/monolith/slices/billing/relations/stripe_events.rb \
        dystopia/monolith/slices/billing/repositories/stripe_event_repository.rb \
        dystopia/monolith/spec/slices/billing/repositories/stripe_event_repository_spec.rb
git commit -s -m "feat(monolith/billing): add StripeEventRepository and stripe_events relation"
```

---

## Task 8: PlanRegistry config

**Files:**
- Create: `spec/slices/billing/config/plan_registry_spec.rb`
- Create: `slices/billing/config/plan_registry.rb`

**Interfaces:**
- Produces: `Billing::Config::PlanRegistry`
  - `#price_id_for(role) -> String` (`role` は Integer: 1=Guest, 2=Cast — identity proto Role enum に一致)
  - `UnsupportedRoleError` 例外

- [ ] **Step 1: 失敗する spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/config/plan_registry"

RSpec.describe Billing::Config::PlanRegistry do
  subject(:registry) do
    described_class.new(guest_price_id: "price_g", cast_price_id: "price_c")
  end

  it "returns guest price for role=1 (Guest)" do
    expect(registry.price_id_for(1)).to eq("price_g")
  end

  it "returns cast price for role=2 (Cast)" do
    expect(registry.price_id_for(2)).to eq("price_c")
  end

  it "raises for unsupported role" do
    expect { registry.price_id_for(99) }.to raise_error(Billing::Config::PlanRegistry::UnsupportedRoleError)
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

module Billing
  module Config
    class PlanRegistry
      class UnsupportedRoleError < StandardError; end

      ROLE_GUEST = 1
      ROLE_CAST = 2

      def initialize(guest_price_id:, cast_price_id:)
        @guest_price_id = guest_price_id
        @cast_price_id = cast_price_id
      end

      def price_id_for(role)
        case role
        when ROLE_GUEST then @guest_price_id
        when ROLE_CAST  then @cast_price_id
        else
          raise UnsupportedRoleError, "role=#{role.inspect} has no billing plan"
        end
      end
    end
  end
end
```

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/config/plan_registry_spec.rb
git add dystopia/monolith/slices/billing/config/plan_registry.rb \
        dystopia/monolith/spec/slices/billing/config/plan_registry_spec.rb
git commit -s -m "feat(monolith/billing): add PlanRegistry for role→price_id mapping"
```

---

## Task 9: StripeClient adapter

**Files:**
- Create: `slices/billing/adapters/stripe_client.rb`
- Create: `spec/slices/billing/adapters/stripe_client_spec.rb` (signature 検証のみ)

**Interfaces:**
- Produces: `Billing::Adapters::StripeClient`
  - `#create_customer(account_id:, idempotency_key:) -> ::Stripe::Customer`
  - `#create_checkout_session(customer_id:, price_id:, success_url:, cancel_url:, idempotency_key:) -> ::Stripe::Checkout::Session`
  - `#create_billing_portal_session(customer_id:, return_url:, idempotency_key:) -> ::Stripe::BillingPortal::Session`
  - `#retrieve_subscription(stripe_subscription_id:) -> ::Stripe::Subscription`
  - `#construct_webhook_event(payload:, sig_header:, secret:) -> ::Stripe::Event`

- [ ] **Step 1: spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/adapters/stripe_client"

RSpec.describe Billing::Adapters::StripeClient do
  subject(:client) { described_class.new(api_key: "sk_test_dummy") }

  it "responds to create_customer" do
    expect(client).to respond_to(:create_customer)
  end

  it "responds to create_checkout_session" do
    expect(client).to respond_to(:create_checkout_session)
  end

  it "responds to create_billing_portal_session" do
    expect(client).to respond_to(:create_billing_portal_session)
  end

  it "responds to retrieve_subscription" do
    expect(client).to respond_to(:retrieve_subscription)
  end

  it "responds to construct_webhook_event" do
    expect(client).to respond_to(:construct_webhook_event)
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

require "stripe"

module Billing
  module Adapters
    class StripeClient
      def initialize(api_key:)
        @api_key = api_key
      end

      def create_customer(account_id:, idempotency_key:)
        ::Stripe::Customer.create(
          { metadata: { account_id: account_id.to_s } },
          { api_key: @api_key, idempotency_key: idempotency_key }
        )
      end

      def create_checkout_session(customer_id:, price_id:, success_url:, cancel_url:, idempotency_key:)
        ::Stripe::Checkout::Session.create(
          {
            mode: "subscription",
            customer: customer_id,
            line_items: [{ price: price_id, quantity: 1 }],
            success_url: success_url,
            cancel_url: cancel_url
          },
          { api_key: @api_key, idempotency_key: idempotency_key }
        )
      end

      def create_billing_portal_session(customer_id:, return_url:, idempotency_key:)
        ::Stripe::BillingPortal::Session.create(
          { customer: customer_id, return_url: return_url },
          { api_key: @api_key, idempotency_key: idempotency_key }
        )
      end

      def retrieve_subscription(stripe_subscription_id:)
        ::Stripe::Subscription.retrieve(stripe_subscription_id, { api_key: @api_key })
      end

      def construct_webhook_event(payload:, sig_header:, secret:)
        ::Stripe::Webhook.construct_event(payload, sig_header, secret)
      end
    end
  end
end
```

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/adapters/stripe_client_spec.rb
git add dystopia/monolith/slices/billing/adapters/stripe_client.rb \
        dystopia/monolith/spec/slices/billing/adapters/stripe_client_spec.rb
git commit -s -m "feat(monolith/billing): add StripeClient adapter around the Stripe SDK"
```

---

## Task 10: FakeStripeClient (spec support)

**Files:**
- Create: `spec/support/billing/fake_stripe_client.rb`
- Create: `spec/support/billing/fake_stripe_client_spec.rb`

**Interfaces:**
- Produces: `Spec::Billing::FakeStripeClient` (interface parity with `Billing::Adapters::StripeClient`)
  - test 用補助: `#inject_subscription(id:, customer_id:, price_id:, status:, current_period_end:, cancel_at_period_end: false)`, `#raise_on_next_call(error)`, `#recorded_calls`, `#reset!`, `#generate_test_signature(payload:, timestamp:, secret:)`

- [ ] **Step 1: parity + 挙動 spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "support/billing/fake_stripe_client"
require "slices/billing/adapters/stripe_client"

RSpec.describe Spec::Billing::FakeStripeClient do
  subject(:fake) { described_class.new }

  it "has every public method the real StripeClient exposes" do
    real_methods = Billing::Adapters::StripeClient.instance_methods(false)
    real_methods.each do |m|
      expect(described_class.instance_methods).to include(m), "fake is missing #{m}"
    end
  end

  it "create_customer returns a customer-like object with id and account_id metadata" do
    result = fake.create_customer(account_id: "acct-1", idempotency_key: "k1")
    expect(result.id).to match(/\Acus_fake_/)
    expect(result.metadata["account_id"]).to eq("acct-1")
  end

  it "create_customer is idempotent by idempotency_key" do
    a = fake.create_customer(account_id: "acct-1", idempotency_key: "same-key")
    b = fake.create_customer(account_id: "acct-1", idempotency_key: "same-key")
    expect(a.id).to eq(b.id)
  end

  it "create_checkout_session returns object with .url" do
    fake.create_customer(account_id: "acct-1", idempotency_key: "k1")
    session = fake.create_checkout_session(
      customer_id: "cus_fake_1", price_id: "price_x",
      success_url: "https://s", cancel_url: "https://c", idempotency_key: "k2"
    )
    expect(session.url).to match(%r{\Ahttps://checkout\.stripe\.test/cs_fake_})
  end

  it "construct_webhook_event verifies signature and returns event" do
    payload = { id: "evt_1", type: "customer.subscription.created", data: {} }.to_json
    sig = fake.generate_test_signature(payload: payload, timestamp: Time.now.to_i)
    event = fake.construct_webhook_event(payload: payload, sig_header: sig, secret: "whsec_fake")
    expect(event.id).to eq("evt_1")
  end

  it "construct_webhook_event raises on bad signature" do
    payload = { id: "evt_1", type: "x" }.to_json
    expect {
      fake.construct_webhook_event(payload: payload, sig_header: "t=1,v1=bad", secret: "whsec_fake")
    }.to raise_error(Stripe::SignatureVerificationError)
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

require "stripe"
require "ostruct"
require "openssl"

module Spec
  module Billing
    class FakeStripeClient
      FAKE_SECRET = "whsec_fake"

      def initialize
        reset!
      end

      def reset!
        @customers = {}
        @customers_by_key = {}
        @subscriptions = {}
        @sessions = {}
        @portal_sessions = {}
        @seq = { customer: 0, subscription: 0, session: 0, portal: 0 }
        @raise_next = nil
        @recorded = []
      end

      def recorded_calls
        @recorded.dup
      end

      def raise_on_next_call(error)
        @raise_next = error
      end

      def inject_subscription(id:, customer_id:, price_id:, status:, current_period_end:,
                              cancel_at_period_end: false)
        @subscriptions[id] = OpenStruct.new(
          id: id, customer: customer_id,
          items: OpenStruct.new(data: [OpenStruct.new(price: OpenStruct.new(id: price_id))]),
          status: status,
          current_period_end: current_period_end.to_i,
          cancel_at_period_end: cancel_at_period_end,
          canceled_at: nil
        )
      end

      def create_customer(account_id:, idempotency_key:)
        maybe_raise!
        record(:create_customer, account_id: account_id, idempotency_key: idempotency_key)
        return @customers[@customers_by_key[idempotency_key]] if @customers_by_key.key?(idempotency_key)

        @seq[:customer] += 1
        id = "cus_fake_#{@seq[:customer]}"
        cus = OpenStruct.new(id: id, metadata: { "account_id" => account_id.to_s })
        @customers[id] = cus
        @customers_by_key[idempotency_key] = id
        cus
      end

      def create_checkout_session(customer_id:, price_id:, success_url:, cancel_url:, idempotency_key:)
        maybe_raise!
        record(:create_checkout_session, customer_id: customer_id, price_id: price_id,
                                          success_url: success_url, cancel_url: cancel_url,
                                          idempotency_key: idempotency_key)
        @seq[:session] += 1
        id = "cs_fake_#{@seq[:session]}"
        session = OpenStruct.new(id: id, url: "https://checkout.stripe.test/#{id}", customer: customer_id)
        @sessions[id] = session
        session
      end

      def create_billing_portal_session(customer_id:, return_url:, idempotency_key:)
        maybe_raise!
        record(:create_billing_portal_session, customer_id: customer_id, return_url: return_url,
                                                idempotency_key: idempotency_key)
        @seq[:portal] += 1
        id = "ps_fake_#{@seq[:portal]}"
        session = OpenStruct.new(id: id, url: "https://billing.stripe.test/#{id}")
        @portal_sessions[id] = session
        session
      end

      def retrieve_subscription(stripe_subscription_id:)
        maybe_raise!
        record(:retrieve_subscription, stripe_subscription_id: stripe_subscription_id)
        @subscriptions[stripe_subscription_id] || raise(Stripe::InvalidRequestError.new("No such subscription", nil))
      end

      def construct_webhook_event(payload:, sig_header:, secret:)
        record(:construct_webhook_event, payload_size: payload.bytesize, sig_present: !sig_header.nil?)
        ::Stripe::Webhook.construct_event(payload, sig_header, secret)
      end

      def generate_test_signature(payload:, timestamp: Time.now.to_i, secret: FAKE_SECRET)
        signed = "#{timestamp}.#{payload}"
        v1 = OpenSSL::HMAC.hexdigest("SHA256", secret, signed)
        "t=#{timestamp},v1=#{v1}"
      end

      private

      def maybe_raise!
        return unless @raise_next
        err = @raise_next
        @raise_next = nil
        raise err
      end

      def record(method, **args)
        @recorded << { method: method, args: args, at: Time.now }
      end
    end
  end
end
```

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/support/billing/fake_stripe_client_spec.rb
git add dystopia/monolith/spec/support/billing/
git commit -s -m "test(monolith/billing): add FakeStripeClient for spec-level Stripe substitution"
```

---

## Task 11: Queries::ActiveSubscription (TDD)

**Files:**
- Create: `spec/slices/billing/queries/active_subscription_spec.rb`
- Create: `slices/billing/queries/active_subscription.rb`

**Interfaces:**
- Produces: `Billing::Queries::ActiveSubscription#call(account_id) -> Struct | nil`

- [ ] **Step 1: spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/queries/active_subscription"

RSpec.describe Billing::Queries::ActiveSubscription do
  let(:sub_repo) { double(:subscription_repo) }
  subject(:query) { described_class.new(subscription_repo: sub_repo) }

  it "returns row from find_active_by_account_id" do
    row = double(:sub)
    allow(sub_repo).to receive(:find_active_by_account_id).with("a1").and_return(row)
    expect(query.call("a1")).to be(row)
  end

  it "returns nil when repo returns nil" do
    allow(sub_repo).to receive(:find_active_by_account_id).with("a1").and_return(nil)
    expect(query.call("a1")).to be_nil
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

module Billing
  module Queries
    class ActiveSubscription
      include Billing::Deps[
        subscription_repo: "repositories.subscription_repository"
      ]

      def initialize(subscription_repo: nil, **kwargs)
        super(**kwargs.merge(subscription_repo: subscription_repo).compact)
      end

      def call(account_id)
        subscription_repo.find_active_by_account_id(account_id)
      end
    end
  end
end
```

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/queries/active_subscription_spec.rb
git add dystopia/monolith/slices/billing/queries/ \
        dystopia/monolith/spec/slices/billing/queries/
git commit -s -m "feat(monolith/billing): add ActiveSubscription query for entitlement lookups"
```

---

## Task 12: GetMySubscription use case (TDD)

**Files:**
- Create: `spec/slices/billing/use_cases/get_my_subscription_spec.rb`
- Create: `slices/billing/use_cases/get_my_subscription.rb`

**Interfaces:**
- Produces: `Billing::UseCases::GetMySubscription#call(account_id:) -> Hash | nil`
  - 未加入 nil、そうでなければ `{ status:, current_period_end:, cancel_at_period_end:, price_id: }`

- [ ] **Step 1: spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/get_my_subscription"

RSpec.describe Billing::UseCases::GetMySubscription do
  let(:sub_repo) { double(:subscription_repo) }
  subject(:use_case) { described_class.new(subscription_repo: sub_repo) }

  let(:account_id) { "a1" }

  it "returns nil when no subscription row exists" do
    allow(sub_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
    expect(use_case.call(account_id: account_id)).to be_nil
  end

  it "returns a hash mirroring the row" do
    period_end = Time.now + 3600
    row = OpenStruct.new(
      status: "trialing",
      current_period_end: period_end,
      cancel_at_period_end: false,
      stripe_price_id: "price_g"
    )
    allow(sub_repo).to receive(:find_by_account_id).with(account_id).and_return(row)

    result = use_case.call(account_id: account_id)
    expect(result).to eq(
      status: "trialing",
      current_period_end: period_end,
      cancel_at_period_end: false,
      price_id: "price_g"
    )
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

module Billing
  module UseCases
    class GetMySubscription
      include Billing::Deps[
        subscription_repo: "repositories.subscription_repository"
      ]

      def initialize(subscription_repo: nil, **kwargs)
        super(**kwargs.merge(subscription_repo: subscription_repo).compact)
      end

      def call(account_id:)
        row = subscription_repo.find_by_account_id(account_id)
        return nil unless row

        {
          status: row.status,
          current_period_end: row.current_period_end,
          cancel_at_period_end: row.cancel_at_period_end,
          price_id: row.stripe_price_id
        }
      end
    end
  end
end
```

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/get_my_subscription_spec.rb
git add dystopia/monolith/slices/billing/use_cases/get_my_subscription.rb \
        dystopia/monolith/spec/slices/billing/use_cases/get_my_subscription_spec.rb
git commit -s -m "feat(monolith/billing): add GetMySubscription use case"
```

---

## Task 13: CreateCheckoutSession use case (TDD)

**Files:**
- Create: `spec/slices/billing/use_cases/create_checkout_session_spec.rb`
- Create: `slices/billing/use_cases/create_checkout_session.rb`

**Interfaces:**
- Consumes: `CustomerRepository`, `SubscriptionRepository`, `StripeClient`, `PlanRegistry`, settings, `Identity::Slice["repositories.account_repository"]#find_by_id(sub)`
- Produces: `Billing::UseCases::CreateCheckoutSession#call(account_id:) -> { url: String }`
  - 例外: `AlreadyActiveError` / `AccountNotFoundError` / `UnsupportedRoleError`

- [ ] **Step 1: spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/create_checkout_session"
require "support/billing/fake_stripe_client"

RSpec.describe Billing::UseCases::CreateCheckoutSession do
  let(:customer_repo) { double(:customer_repo) }
  let(:subscription_repo) { double(:subscription_repo) }
  let(:account_repo) { double(:account_repo) }
  let(:plan_registry) { Billing::Config::PlanRegistry.new(guest_price_id: "price_g", cast_price_id: "price_c") }
  let(:stripe_client) { Spec::Billing::FakeStripeClient.new }

  subject(:use_case) do
    described_class.new(
      customer_repo: customer_repo,
      subscription_repo: subscription_repo,
      account_repo: account_repo,
      plan_registry: plan_registry,
      stripe_client: stripe_client,
      success_url: "https://app/success",
      cancel_url: "https://app/cancel"
    )
  end

  let(:account_id) { "a1" }
  let(:guest_account) { OpenStruct.new(id: account_id, role: 1) }
  let(:cast_account)  { OpenStruct.new(id: account_id, role: 2) }

  before do
    allow(subscription_repo).to receive(:find_active_by_account_id).with(account_id).and_return(nil)
  end

  context "when account is a guest with no prior customer" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(guest_account)
      allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
      allow(customer_repo).to receive(:upsert_by_account_id)
    end

    it "creates a Stripe customer, upserts, and returns checkout url" do
      expect(customer_repo).to receive(:upsert_by_account_id).with(account_id: account_id, stripe_customer_id: match(/\Acus_fake_/))
      result = use_case.call(account_id: account_id)
      expect(result[:url]).to match(%r{\Ahttps://checkout\.stripe\.test/})
      calls = stripe_client.recorded_calls.map { |c| c[:method] }
      expect(calls).to include(:create_customer, :create_checkout_session)
    end

    it "uses the guest price id for role=1" do
      use_case.call(account_id: account_id)
      checkout_call = stripe_client.recorded_calls.find { |c| c[:method] == :create_checkout_session }
      expect(checkout_call[:args][:price_id]).to eq("price_g")
    end
  end

  context "when account is a cast with existing customer" do
    let(:existing_customer) { OpenStruct.new(account_id: account_id, stripe_customer_id: "cus_existing") }

    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(cast_account)
      allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(existing_customer)
    end

    it "does NOT create a new Stripe customer" do
      use_case.call(account_id: account_id)
      call_methods = stripe_client.recorded_calls.map { |c| c[:method] }
      expect(call_methods).not_to include(:create_customer)
      expect(call_methods).to include(:create_checkout_session)
    end

    it "uses the cast price id and existing customer id" do
      use_case.call(account_id: account_id)
      checkout_call = stripe_client.recorded_calls.find { |c| c[:method] == :create_checkout_session }
      expect(checkout_call[:args][:price_id]).to eq("price_c")
      expect(checkout_call[:args][:customer_id]).to eq("cus_existing")
    end
  end

  context "when account already has an active subscription" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(guest_account)
      allow(subscription_repo).to receive(:find_active_by_account_id).with(account_id).and_return(OpenStruct.new)
    end

    it "raises AlreadyActiveError" do
      expect { use_case.call(account_id: account_id) }.to raise_error(described_class::AlreadyActiveError)
    end
  end

  context "when account is unknown" do
    before { allow(account_repo).to receive(:find_by_id).with(account_id).and_return(nil) }

    it "raises AccountNotFoundError" do
      expect { use_case.call(account_id: account_id) }.to raise_error(described_class::AccountNotFoundError)
    end
  end

  context "when account role has no billing plan" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(OpenStruct.new(id: account_id, role: 99))
    end

    it "raises UnsupportedRoleError" do
      expect { use_case.call(account_id: account_id) }.to raise_error(described_class::UnsupportedRoleError)
    end
  end

  context "when Stripe raises APIConnectionError" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(guest_account)
      allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
      allow(customer_repo).to receive(:upsert_by_account_id)
      stripe_client.raise_on_next_call(Stripe::APIConnectionError.new("network"))
    end

    it "propagates the Stripe error" do
      expect { use_case.call(account_id: account_id) }.to raise_error(Stripe::APIConnectionError)
    end
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

module Billing
  module UseCases
    class CreateCheckoutSession
      class AlreadyActiveError < StandardError; end
      class AccountNotFoundError < StandardError; end
      class UnsupportedRoleError < StandardError; end

      include Billing::Deps[
        customer_repo:      "repositories.customer_repository",
        subscription_repo:  "repositories.subscription_repository",
        stripe_client:      "adapters.stripe_client",
        plan_registry:      "config.plan_registry"
      ]

      def initialize(customer_repo: nil, subscription_repo: nil, stripe_client: nil,
                     plan_registry: nil, account_repo: nil,
                     success_url: nil, cancel_url: nil, **kwargs)
        super(**kwargs.merge(
          customer_repo: customer_repo,
          subscription_repo: subscription_repo,
          stripe_client: stripe_client,
          plan_registry: plan_registry
        ).compact)
        @account_repo = account_repo
        @success_url = success_url || Hanami.app["settings"].billing_success_url
        @cancel_url  = cancel_url  || Hanami.app["settings"].billing_cancel_url
      end

      def call(account_id:)
        account = account_repo.find_by_id(account_id)
        raise AccountNotFoundError, "account=#{account_id} not found" unless account

        price_id = begin
          plan_registry.price_id_for(account.role)
        rescue Billing::Config::PlanRegistry::UnsupportedRoleError => e
          raise UnsupportedRoleError, e.message
        end

        raise AlreadyActiveError, "account=#{account_id} already has active subscription" if subscription_repo.find_active_by_account_id(account_id)

        existing = customer_repo.find_by_account_id(account_id)
        stripe_customer_id = existing&.stripe_customer_id
        unless stripe_customer_id
          customer = stripe_client.create_customer(
            account_id: account_id,
            idempotency_key: "billing:create_customer:#{account_id}"
          )
          stripe_customer_id = customer.id
          customer_repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
        end

        session = stripe_client.create_checkout_session(
          customer_id: stripe_customer_id,
          price_id: price_id,
          success_url: @success_url,
          cancel_url: @cancel_url,
          idempotency_key: "billing:create_checkout:#{account_id}:#{Time.now.strftime('%Y%m%d%H')}"
        )
        { url: session.url }
      end

      private

      def account_repo
        @account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
```

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/create_checkout_session_spec.rb
git add dystopia/monolith/slices/billing/use_cases/create_checkout_session.rb \
        dystopia/monolith/spec/slices/billing/use_cases/create_checkout_session_spec.rb
git commit -s -m "feat(monolith/billing): add CreateCheckoutSession use case"
```

---

## Task 14: CreateCustomerPortalSession use case (TDD)

**Files:**
- Create: `spec/slices/billing/use_cases/create_customer_portal_session_spec.rb`
- Create: `slices/billing/use_cases/create_customer_portal_session.rb`

**Interfaces:**
- Produces: `Billing::UseCases::CreateCustomerPortalSession#call(account_id:) -> { url: String }`
  - 例外: `CustomerNotCreatedError`

- [ ] **Step 1: spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/create_customer_portal_session"
require "support/billing/fake_stripe_client"

RSpec.describe Billing::UseCases::CreateCustomerPortalSession do
  let(:customer_repo) { double(:customer_repo) }
  let(:stripe_client) { Spec::Billing::FakeStripeClient.new }

  subject(:use_case) do
    described_class.new(
      customer_repo: customer_repo,
      stripe_client: stripe_client,
      return_url: "https://app/return"
    )
  end

  let(:account_id) { "a1" }

  it "raises when no customer row exists for the account" do
    allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
    expect { use_case.call(account_id: account_id) }.to raise_error(described_class::CustomerNotCreatedError)
  end

  it "returns a portal url when customer exists" do
    allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(
      OpenStruct.new(stripe_customer_id: "cus_existing")
    )
    result = use_case.call(account_id: account_id)
    expect(result[:url]).to match(%r{\Ahttps://billing\.stripe\.test/})
    call = stripe_client.recorded_calls.first
    expect(call[:args][:customer_id]).to eq("cus_existing")
    expect(call[:args][:return_url]).to eq("https://app/return")
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

module Billing
  module UseCases
    class CreateCustomerPortalSession
      class CustomerNotCreatedError < StandardError; end

      include Billing::Deps[
        customer_repo: "repositories.customer_repository",
        stripe_client: "adapters.stripe_client"
      ]

      def initialize(customer_repo: nil, stripe_client: nil, return_url: nil, **kwargs)
        super(**kwargs.merge(customer_repo: customer_repo, stripe_client: stripe_client).compact)
        @return_url = return_url || Hanami.app["settings"].billing_portal_return_url
      end

      def call(account_id:)
        row = customer_repo.find_by_account_id(account_id)
        raise CustomerNotCreatedError, "account=#{account_id} has no Stripe customer" unless row

        session = stripe_client.create_billing_portal_session(
          customer_id: row.stripe_customer_id,
          return_url: @return_url,
          idempotency_key: "billing:create_portal:#{account_id}:#{Time.now.strftime('%Y%m%d%H')}"
        )
        { url: session.url }
      end
    end
  end
end
```

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/create_customer_portal_session_spec.rb
git add dystopia/monolith/slices/billing/use_cases/create_customer_portal_session.rb \
        dystopia/monolith/spec/slices/billing/use_cases/create_customer_portal_session_spec.rb
git commit -s -m "feat(monolith/billing): add CreateCustomerPortalSession use case"
```

---

## Task 15: ProcessWebhookEvent use case (TDD)

**Files:**
- Create: `spec/slices/billing/use_cases/process_webhook_event_spec.rb`
- Create: `slices/billing/use_cases/process_webhook_event.rb`

**Interfaces:**
- Produces: `Billing::UseCases::ProcessWebhookEvent#call(event:) -> Symbol`
  - `:processed` / `:duplicate` / `:ignored`

Transaction: `Hanami.app["db.gateway"].connection.transaction { ... }`。
Out-of-order defense: 既存 `billing__subscriptions.status == 'canceled'` なら upsert しない (`customer.subscription.updated` は無視)。

- [ ] **Step 1: spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/process_webhook_event"

RSpec.describe Billing::UseCases::ProcessWebhookEvent, type: :database do
  subject(:use_case) do
    described_class.new(
      stripe_event_repo: stripe_event_repo,
      customer_repo: customer_repo,
      subscription_repo: subscription_repo
    )
  end

  let(:stripe_event_repo) { Billing::Repositories::StripeEventRepository.new }
  let(:customer_repo) { Billing::Repositories::CustomerRepository.new }
  let(:subscription_repo) { Billing::Repositories::SubscriptionRepository.new }

  let(:account_id) { SecureRandom.uuid_v7 }
  let(:stripe_customer_id) { "cus_1" }
  let(:stripe_subscription_id) { "sub_1" }
  let(:period_end) { Time.now + 3600 }

  before do
    customer_repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
  end

  def make_event(type, subscription_status: "active", cancel_at_period_end: false, canceled_at: nil, price_id: "price_g")
    OpenStruct.new(
      id: "evt_#{SecureRandom.hex(6)}",
      type: type,
      data: OpenStruct.new(object: OpenStruct.new(
        id: stripe_subscription_id,
        customer: stripe_customer_id,
        status: subscription_status,
        current_period_end: period_end.to_i,
        cancel_at_period_end: cancel_at_period_end,
        canceled_at: canceled_at,
        items: OpenStruct.new(data: [OpenStruct.new(price: OpenStruct.new(id: price_id))])
      )),
      to_hash: { "id" => "evt_x", "type" => type }
    )
  end

  describe "customer.subscription.created" do
    it "upserts subscription and marks event processed" do
      event = make_event("customer.subscription.created", subscription_status: "trialing")
      expect(use_case.call(event: event)).to eq(:processed)
      sub = subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
      expect(sub.status).to eq("trialing")
      expect(sub.account_id).to eq(account_id)
      expect(stripe_event_repo.find_by_stripe_event_id(event.id).processed_at).not_to be_nil
    end
  end

  describe "customer.subscription.updated" do
    it "updates status to past_due" do
      use_case.call(event: make_event("customer.subscription.created", subscription_status: "active"))
      use_case.call(event: make_event("customer.subscription.updated", subscription_status: "past_due"))
      expect(subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id).status).to eq("past_due")
    end
  end

  describe "customer.subscription.deleted" do
    it "marks subscription canceled" do
      use_case.call(event: make_event("customer.subscription.created"))
      use_case.call(event: make_event("customer.subscription.deleted"))
      sub = subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
      expect(sub.status).to eq("canceled")
      expect(sub.canceled_at).not_to be_nil
    end
  end

  describe "out-of-order: updated after deleted" do
    it "keeps status canceled (canceled is terminal)" do
      use_case.call(event: make_event("customer.subscription.created"))
      use_case.call(event: make_event("customer.subscription.deleted"))
      use_case.call(event: make_event("customer.subscription.updated", subscription_status: "active"))
      expect(subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id).status).to eq("canceled")
    end
  end

  describe "dedupe" do
    it "returns :duplicate on the second call with the same event id" do
      event = make_event("customer.subscription.created")
      use_case.call(event: event)
      expect(use_case.call(event: event)).to eq(:duplicate)
    end
  end

  describe "unhandled event type" do
    it "returns :ignored and marks processed" do
      event = OpenStruct.new(
        id: "evt_x1", type: "invoice.upcoming",
        data: OpenStruct.new(object: OpenStruct.new),
        to_hash: { "id" => "evt_x1", "type" => "invoice.upcoming" }
      )
      expect(use_case.call(event: event)).to eq(:ignored)
      expect(stripe_event_repo.find_by_stripe_event_id("evt_x1").processed_at).not_to be_nil
    end
  end

  describe "handler failure" do
    it "leaves processed_at nil and records error_message, then re-raises" do
      allow(subscription_repo).to receive(:upsert_by_stripe_id).and_raise(StandardError, "boom")
      event = make_event("customer.subscription.created")
      expect { use_case.call(event: event) }.to raise_error(StandardError, "boom")
      row = stripe_event_repo.find_by_stripe_event_id(event.id)
      expect(row.processed_at).to be_nil
      expect(row.error_message).to include("boom")
    end
  end
end
```

- [ ] **Step 2: 実装**

```ruby
# frozen_string_literal: true

module Billing
  module UseCases
    class ProcessWebhookEvent
      HANDLED_TYPES = %w[
        customer.subscription.created
        customer.subscription.updated
        customer.subscription.deleted
        customer.subscription.trial_will_end
        checkout.session.completed
      ].freeze

      SUBSCRIPTION_UPSERT_TYPES = %w[
        customer.subscription.created
        customer.subscription.updated
      ].freeze

      include Billing::Deps[
        stripe_event_repo: "repositories.stripe_event_repository",
        customer_repo:     "repositories.customer_repository",
        subscription_repo: "repositories.subscription_repository"
      ]

      def initialize(stripe_event_repo: nil, customer_repo: nil, subscription_repo: nil, **kwargs)
        super(**kwargs.merge(
          stripe_event_repo: stripe_event_repo,
          customer_repo: customer_repo,
          subscription_repo: subscription_repo
        ).compact)
      end

      def call(event:)
        existing = stripe_event_repo.find_by_stripe_event_id(event.id)
        return :duplicate if existing && existing.processed_at

        db.transaction do
          stripe_event_repo.insert_received(
            stripe_event_id: event.id,
            event_type: event.type,
            payload: event.to_hash
          ) unless existing

          result = dispatch(event)

          stripe_event_repo.mark_processed(stripe_event_id: event.id)
          result
        end
      rescue => e
        stripe_event_repo.mark_failed(stripe_event_id: event.id, error_message: e.message)
        raise
      end

      private

      def db
        @db ||= Hanami.app["db.gateway"].connection
      end

      def dispatch(event)
        case event.type
        when *SUBSCRIPTION_UPSERT_TYPES
          upsert_subscription(event.data.object)
          :processed
        when "customer.subscription.deleted"
          object = event.data.object
          subscription_repo.mark_canceled(
            stripe_subscription_id: object.id,
            canceled_at: object.canceled_at ? Time.at(object.canceled_at) : Time.now
          )
          :processed
        else
          :ignored
        end
      end

      def upsert_subscription(object)
        existing = subscription_repo.find_by_stripe_subscription_id(object.id)
        return if existing && existing.status == "canceled" # out-of-order 防御 (canceled 終端)

        customer = customer_repo.find_by_stripe_customer_id(object.customer)
        raise "no billing__customers row for stripe customer=#{object.customer}" unless customer

        subscription_repo.upsert_by_stripe_id(
          account_id: customer.account_id,
          stripe_subscription_id: object.id,
          stripe_price_id: object.items.data.first.price.id,
          status: object.status,
          current_period_end: Time.at(object.current_period_end),
          cancel_at_period_end: object.cancel_at_period_end,
          canceled_at: object.canceled_at ? Time.at(object.canceled_at) : nil
        )
      end
    end
  end
end
```

注: `current_period_end` は Stripe API version により Subscription 直下か Item 側に来る可能性。実装時に採用 API version を確認し、Item 側なら `object.items.data.first.current_period_end` を使う。

- [ ] **Step 3: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/process_webhook_event_spec.rb
git add dystopia/monolith/slices/billing/use_cases/process_webhook_event.rb \
        dystopia/monolith/spec/slices/billing/use_cases/process_webhook_event_spec.rb
git commit -s -m "feat(monolith/billing): add ProcessWebhookEvent use case with dedupe and canceled-terminal defense"
```

---

## Task 16: BillingHandler (gRPC) + gRPC boot registration

**Files:**
- Create: `slices/billing/grpc/handler.rb`
- Create: `slices/billing/grpc/billing_handler.rb`
- Modify: `dystopia/monolith/bin/grpc`
- Create: `spec/slices/billing/grpc/billing_handler_spec.rb`

**Interfaces:**
- Produces: `Billing::Grpc::BillingHandler` (Gruf handler)
- Handler 境界: `current_user_id` (Cognito sub) を use case に `account_id:` で渡す

- [ ] **Step 1: handler base**

```ruby
# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Billing
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
    end
  end
end
```

- [ ] **Step 2: BillingHandler**

```ruby
# frozen_string_literal: true

require "billing/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Billing
  module Grpc
    class BillingHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "billing.v1.BillingService"

      bind ::Billing::V1::BillingService::Service

      self.rpc_descs.clear

      rpc :GetMySubscription,           ::Billing::V1::GetMySubscriptionRequest,           ::Billing::V1::GetMySubscriptionResponse
      rpc :CreateCheckoutSession,       ::Billing::V1::CreateCheckoutSessionRequest,       ::Billing::V1::CreateCheckoutSessionResponse
      rpc :CreateCustomerPortalSession, ::Billing::V1::CreateCustomerPortalSessionRequest, ::Billing::V1::CreateCustomerPortalSessionResponse

      include Billing::Deps[
        get_uc:      "use_cases.get_my_subscription",
        checkout_uc: "use_cases.create_checkout_session",
        portal_uc:   "use_cases.create_customer_portal_session"
      ]

      def get_my_subscription
        authenticate_user!
        result = get_uc.call(account_id: current_user_id)
        response = ::Billing::V1::GetMySubscriptionResponse.new
        response.subscription = subscription_to_proto(result) if result
        response
      end

      def create_checkout_session
        authenticate_user!
        result = wrap_errors { checkout_uc.call(account_id: current_user_id) }
        ::Billing::V1::CreateCheckoutSessionResponse.new(url: result[:url])
      end

      def create_customer_portal_session
        authenticate_user!
        result = wrap_errors { portal_uc.call(account_id: current_user_id) }
        ::Billing::V1::CreateCustomerPortalSessionResponse.new(url: result[:url])
      end

      private

      STATUS_MAP = {
        "trialing"           => ::Billing::V1::Subscription::Status::TRIALING,
        "active"             => ::Billing::V1::Subscription::Status::ACTIVE,
        "incomplete"         => ::Billing::V1::Subscription::Status::INCOMPLETE,
        "incomplete_expired" => ::Billing::V1::Subscription::Status::INCOMPLETE_EXPIRED,
        "past_due"           => ::Billing::V1::Subscription::Status::PAST_DUE,
        "canceled"           => ::Billing::V1::Subscription::Status::CANCELED,
        "unpaid"             => ::Billing::V1::Subscription::Status::UNPAID,
        "paused"             => ::Billing::V1::Subscription::Status::PAUSED
      }.freeze

      def subscription_to_proto(row)
        ::Billing::V1::Subscription.new(
          status: STATUS_MAP.fetch(row[:status], ::Billing::V1::Subscription::Status::STATUS_UNSPECIFIED),
          current_period_end: timestamp(row[:current_period_end]),
          cancel_at_period_end: row[:cancel_at_period_end],
          price_id: row[:price_id]
        )
      end

      def timestamp(t)
        return nil unless t
        ::Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: t.nsec)
      end

      def wrap_errors
        yield
      rescue Billing::UseCases::CreateCheckoutSession::AlreadyActiveError,
             Billing::UseCases::CreateCheckoutSession::AccountNotFoundError,
             Billing::UseCases::CreateCheckoutSession::UnsupportedRoleError,
             Billing::UseCases::CreateCustomerPortalSession::CustomerNotCreatedError => e
        fail!(:failed_precondition, :failed_precondition, e.message)
      rescue Stripe::APIConnectionError => e
        fail!(:unavailable, :unavailable, e.message)
      rescue Stripe::RateLimitError => e
        fail!(:resource_exhausted, :resource_exhausted, e.message)
      rescue Stripe::StripeError => e
        fail!(:internal, :internal, "Stripe API error: #{e.class}")
      end
    end
  end
end
```

- [ ] **Step 3: `bin/grpc` に register 追加**

```ruby
require_relative "../slices/billing/grpc/handler"
require_relative "../slices/billing/grpc/billing_handler"
```

- [ ] **Step 4: light-weight spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/grpc/billing_handler"

RSpec.describe Billing::Grpc::BillingHandler do
  describe "STATUS_MAP" do
    it "maps every status string to a proto enum value" do
      map = described_class.send(:const_get, :STATUS_MAP)
      %w[trialing active incomplete incomplete_expired past_due canceled unpaid paused].each do |s|
        expect(map[s]).not_to be_nil, "missing map entry for #{s}"
      end
    end
  end
end
```

- [ ] **Step 5: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/grpc/billing_handler_spec.rb
git add dystopia/monolith/slices/billing/grpc/ \
        dystopia/monolith/spec/slices/billing/grpc/ \
        dystopia/monolith/bin/grpc
git commit -s -m "feat(monolith/billing): add gRPC BillingHandler and register in gRPC boot"
```

---

## Task 17: Webhook HTTP action + route

**Files:**
- Create: `slices/billing/actions/webhooks/stripe.rb`
- Modify: `dystopia/monolith/config/routes.rb`
- Create: `spec/slices/billing/actions/webhooks/stripe_spec.rb`

**Interfaces:**
- Produces: Hanami action at `POST /billing/webhooks/stripe`

- [ ] **Step 1: action spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "rack/test"
require "support/billing/fake_stripe_client"

RSpec.describe "POST /billing/webhooks/stripe", type: :database do
  include Rack::Test::Methods

  def app
    Hanami.app
  end

  let(:fake_stripe) { Spec::Billing::FakeStripeClient.new }
  let(:process_uc) { double(:process_uc) }

  before do
    allow(Billing::Slice).to receive(:[]).and_call_original
    allow(Billing::Slice).to receive(:[]).with("adapters.stripe_client").and_return(fake_stripe)
    allow(Billing::Slice).to receive(:[]).with("use_cases.process_webhook_event").and_return(process_uc)
  end

  def signed_headers(payload, secret: Spec::Billing::FakeStripeClient::FAKE_SECRET)
    { "HTTP_STRIPE_SIGNATURE" => fake_stripe.generate_test_signature(payload: payload, secret: secret) }
  end

  it "returns 400 when the signature header is missing" do
    post "/billing/webhooks/stripe", "{}", { "CONTENT_TYPE" => "application/json" }
    expect(last_response.status).to eq(400)
  end

  it "returns 400 when the signature is invalid" do
    payload = { id: "evt_1", type: "customer.subscription.created" }.to_json
    post "/billing/webhooks/stripe", payload, {
      "CONTENT_TYPE" => "application/json",
      "HTTP_STRIPE_SIGNATURE" => "t=1,v1=deadbeef"
    }
    expect(last_response.status).to eq(400)
  end

  it "returns 200 when signature ok and use_case succeeds" do
    allow(process_uc).to receive(:call).and_return(:processed)
    payload = { id: "evt_2", type: "customer.subscription.created", data: { object: {} } }.to_json
    post "/billing/webhooks/stripe", payload, { "CONTENT_TYPE" => "application/json" }.merge(signed_headers(payload))
    expect(last_response.status).to eq(200)
  end

  it "returns 500 when the use_case raises" do
    allow(process_uc).to receive(:call).and_raise(StandardError, "boom")
    payload = { id: "evt_3", type: "customer.subscription.updated", data: { object: {} } }.to_json
    post "/billing/webhooks/stripe", payload, { "CONTENT_TYPE" => "application/json" }.merge(signed_headers(payload))
    expect(last_response.status).to eq(500)
  end
end
```

- [ ] **Step 2: action**

```ruby
# frozen_string_literal: true

module Billing
  module Actions
    module Webhooks
      class Stripe < Billing::Action
        include Billing::Deps[
          stripe_client: "adapters.stripe_client",
          process_uc:    "use_cases.process_webhook_event"
        ]

        def handle(request, response)
          payload = request.body.read
          signature = request.env["HTTP_STRIPE_SIGNATURE"]
          secret = Hanami.app["settings"].stripe_webhook_secret

          if signature.nil? || signature.empty?
            response.status = 400
            response.body = "missing signature"
            return
          end

          begin
            event = stripe_client.construct_webhook_event(payload: payload, sig_header: signature, secret: secret)
          rescue ::Stripe::SignatureVerificationError, JSON::ParserError => e
            response.status = 400
            response.body = "invalid webhook: #{e.class}"
            return
          end

          begin
            process_uc.call(event: event)
            response.status = 200
            response.body = "ok"
          rescue StandardError => e
            response.status = 500
            response.body = "handler error: #{e.class}"
          end
        end
      end
    end
  end
end
```

注: `Billing::Action` base の有無を実装時 verify。無ければ `::Hanami::Action` を直接継承し、`slices/billing/action.rb` に base を置く。

- [ ] **Step 3: route**

```ruby
# frozen_string_literal: true

module Monolith
  class Routes < Hanami::Routes
    slice :identity, at: "/identity" do
      # TODO: Implement OAuth callback endpoint (HTTP)
    end

    slice :billing, at: "/billing" do
      post "/webhooks/stripe", to: "webhooks.stripe"
    end
  end
end
```

- [ ] **Step 4: PASS**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/actions/webhooks/stripe_spec.rb
```

- [ ] **Step 5: raw body 保持を verify**

```bash
HANAMI_ENV=test bundle exec ruby -e '
  require "hanami/prepare"
  puts Hanami.app.config.middleware.stack.map(&:first).inspect
'
```

出力を見て body を触る middleware (CSRF、body-parser 系) が居ないか確認。居る場合は billing webhook path を除外する middleware 設定を追加 (実装時判断)。

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/slices/billing/actions/ \
        dystopia/monolith/spec/slices/billing/actions/ \
        dystopia/monolith/config/routes.rb
git commit -s -m "feat(monolith/billing): add Stripe webhook HTTP action and route"
```

---

## Task 18: Reconcile rake task

**Files:**
- Create: `dystopia/monolith/lib/tasks/billing.rake`
- Create: `slices/billing/tasks/reconcile.rb`
- Create: `spec/slices/billing/tasks/reconcile_spec.rb`

**Interfaces:**
- Produces: `rake billing:reconcile` + `Billing::Tasks::Reconcile#call -> { checked:, updated:, errors: }`

- [ ] **Step 1: spec**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "support/billing/fake_stripe_client"

RSpec.describe "billing:reconcile", type: :database do
  let(:fake) { Spec::Billing::FakeStripeClient.new }
  let(:customer_repo) { Billing::Repositories::CustomerRepository.new }
  let(:sub_repo) { Billing::Repositories::SubscriptionRepository.new }

  let(:reconcile) do
    require "slices/billing/tasks/reconcile"
    Billing::Tasks::Reconcile.new(
      customer_repo: customer_repo,
      subscription_repo: sub_repo,
      stripe_client: fake
    )
  end

  it "updates local mirror when Stripe status differs from DB" do
    account = SecureRandom.uuid_v7
    customer_repo.upsert_by_account_id(account_id: account, stripe_customer_id: "cus_1")
    sub_repo.upsert_by_stripe_id(
      account_id: account, stripe_subscription_id: "sub_x", stripe_price_id: "price_g",
      status: "trialing", current_period_end: Time.now + 3600, cancel_at_period_end: false
    )
    fake.inject_subscription(
      id: "sub_x", customer_id: "cus_1", price_id: "price_g",
      status: "active", current_period_end: Time.now + 3600
    )
    diff = reconcile.call
    expect(diff[:updated]).to eq(1)
    expect(sub_repo.find_by_stripe_subscription_id("sub_x").status).to eq("active")
  end

  it "propagates status transition to past_due" do
    account = SecureRandom.uuid_v7
    customer_repo.upsert_by_account_id(account_id: account, stripe_customer_id: "cus_2")
    sub_repo.upsert_by_stripe_id(
      account_id: account, stripe_subscription_id: "sub_y", stripe_price_id: "price_g",
      status: "active", current_period_end: Time.now + 3600, cancel_at_period_end: false
    )
    fake.inject_subscription(
      id: "sub_y", customer_id: "cus_2", price_id: "price_g",
      status: "past_due", current_period_end: Time.now + 3600
    )
    reconcile.call
    expect(sub_repo.find_by_stripe_subscription_id("sub_y").status).to eq("past_due")
  end
end
```

**Note (spec 内で意図的に外している):** MVP スコープでは `known_id` (DB に既に mirror がある subscription) のみを Stripe に照会する。DB に customer 行はあるが subscription 行が無いケース (Stripe → DB 一方向欠落) は今回の reconcile では検出しない。webhook 消失は Stripe Dashboard の event resend で対応する。

- [ ] **Step 2: reconcile 実装**

```ruby
# frozen_string_literal: true

module Billing
  module Tasks
    class Reconcile
      def initialize(customer_repo:, subscription_repo:, stripe_client:)
        @customer_repo = customer_repo
        @subscription_repo = subscription_repo
        @stripe_client = stripe_client
      end

      def call
        checked = 0
        updated = 0
        errors = 0

        @customer_repo.all.each do |customer|
          begin
            local_sub = @subscription_repo.find_by_account_id(customer.account_id)
            stripe_sub = fetch_stripe_subscription(local_sub&.stripe_subscription_id)
            checked += 1
            next unless stripe_sub

            if needs_update?(local_sub, stripe_sub)
              @subscription_repo.upsert_by_stripe_id(
                account_id: customer.account_id,
                stripe_subscription_id: stripe_sub.id,
                stripe_price_id: stripe_sub.items.data.first.price.id,
                status: stripe_sub.status,
                current_period_end: Time.at(stripe_sub.current_period_end),
                cancel_at_period_end: stripe_sub.cancel_at_period_end,
                canceled_at: stripe_sub.canceled_at ? Time.at(stripe_sub.canceled_at) : nil
              )
              updated += 1
            end
          rescue => e
            errors += 1
            warn "reconcile error for account=#{customer.account_id}: #{e.class}: #{e.message}"
          end
        end

        { checked: checked, updated: updated, errors: errors }
      end

      private

      def fetch_stripe_subscription(known_id)
        return nil unless known_id
        @stripe_client.retrieve_subscription(stripe_subscription_id: known_id)
      rescue Stripe::InvalidRequestError
        nil
      end

      def needs_update?(local, remote)
        return true if local.nil?
        local.status != remote.status ||
          local.cancel_at_period_end != remote.cancel_at_period_end ||
          local.current_period_end.to_i != remote.current_period_end
      end
    end
  end
end
```

- [ ] **Step 3: rake task**

```ruby
# frozen_string_literal: true

namespace :billing do
  desc "Reconcile local billing__subscriptions with Stripe (Stripe is SOT)"
  task reconcile: :environment do
    require "slices/billing/tasks/reconcile"
    result = Billing::Tasks::Reconcile.new(
      customer_repo:     Billing::Slice["repositories.customer_repository"],
      subscription_repo: Billing::Slice["repositories.subscription_repository"],
      stripe_client:     Billing::Slice["adapters.stripe_client"]
    ).call
    puts "billing:reconcile checked=#{result[:checked]} updated=#{result[:updated]} errors=#{result[:errors]}"
  end
end
```

- [ ] **Step 4: PASS + Commit**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing/tasks/reconcile_spec.rb
git add dystopia/monolith/slices/billing/tasks/ \
        dystopia/monolith/spec/slices/billing/tasks/ \
        dystopia/monolith/lib/tasks/billing.rake
git commit -s -m "feat(monolith/billing): add reconcile rake task for Stripe/DB drift repair"
```

---

## Task 19: Full-suite green + manual dogfood + Stripe dashboard checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-08-26-billing-slice-design.md` (Rollout Considerations に完了時の Dashboard 設定を追記)

**Interfaces:** —

- [ ] **Step 1: 全 billing spec を一括 green**

```bash
HANAMI_ENV=test bundle exec rspec spec/slices/billing spec/support/billing spec/config/settings_spec.rb
```

- [ ] **Step 2: 既存 suite regression check**

```bash
HANAMI_ENV=test bundle exec rspec
```

- [ ] **Step 3: bundle install --frozen で lockfile 締め**

- [ ] **Step 4: manual dogfood 前準備 (Stripe test mode)**

Stripe Dashboard (test mode) で以下を作成し、`.env.development` に値を投入:

1. Product 2 つ ("Guest Premium", "Cast Premium")
2. 各 product に月額 Price (JPY、trial period days = 7)
3. Customer Portal 設定: cancel / update payment method / view invoices を enable、plan change を disable
4. Webhook endpoint: `customer.subscription.created` / `.updated` / `.deleted` / `.trial_will_end` / `checkout.session.completed` を enable

- [ ] **Step 5: dogfood scenario 1 (Guest でサインアップ→trial→active)**

1. `stripe listen --forward-to localhost:<port>/billing/webhooks/stripe`
2. Guest test account (Cognito 上に用意) で `CreateCheckoutSession` → 返却 URL に browser で遷移
3. test card `4242 4242 4242 4242` で決済完了 → webhook 処理
4. `GetMySubscription` で `TRIALING` 確認
5. Dashboard から subscription を強制 active 化 → `GetMySubscription` で `ACTIVE` 遷移確認

- [ ] **Step 6: dogfood scenario 2 (Portal cancel)**

1. `CreateCustomerPortalSession` → browser 遷移
2. Portal で "Cancel subscription" (期末解約)
3. `GetMySubscription` で `cancel_at_period_end = true`, status は `ACTIVE`

- [ ] **Step 7: dogfood scenario 3 (out-of-order defense)**

1. Dashboard で subscription を手動 cancel → `customer.subscription.deleted` 発火
2. Stripe CLI: `stripe trigger customer.subscription.updated`
3. `GetMySubscription` で status は `CANCELED` のまま

- [ ] **Step 8: dogfood scenario 4 (Cast plan)**

Cast test account で scenario 1〜2 を繰り返す。

- [ ] **Step 9: gap があれば spec を追加して修正**

- [ ] **Step 10: spec の Rollout Considerations に Dashboard 設定を反映**

- [ ] **Step 11: PR 更新 + Ready for review 化**

```bash
git add docs/superpowers/specs/2026-08-26-billing-slice-design.md
git commit -s -m "docs(billing): reflect actual Stripe dashboard setup in rollout section"
git push
gh pr ready
```

Draft → Ready 化を Human に諮る (作業自動化ではなく、承認後に実行)。

---

## Self-Review Notes

1. **Spec 各節 → task マッピング**:
   - §Architecture → Task 2, 4, 5-7 (relations), 16, 17
   - §Data Model → Task 3, 5-7
   - §Mirror Rule → Task 13, 14, 15
   - §Data Flows → Task 13, 14, 15
   - §Error Handling → Task 13〜17 の各 spec
   - §Testing → 各 task の TDD + Task 10 + Task 19
   - §Configuration → Task 1
   - §Rollout Considerations → Task 19

2. **`account_id` 統一 check**:
   - Repository param: `account_id:`、column: `account_id`
   - Use case param: `account_id:`
   - Handler: `current_user_id` (歴史名) を `account_id:` として use case に渡す
   - Stripe metadata: `metadata: { account_id: <sub> }`
   - Idempotency-Key: `"billing:*:<account_id>[:<ts>]"`
   - Identity 参照: `Identity::Slice["repositories.account_repository"]#find_by_id(sub)` (Task 13)

3. **未確定事項** (実装時 verify):
   - `Types::String` が Hanami settings で使えるか (Task 1)
   - relation の `Types::Bool` / `Types::Hash` 使用可否 (Task 6/7)
   - jsonb write の Sequel wrapper (Task 7)
   - `Billing::Deps[]` の auto-generate (Task 11 以降)
   - `Billing::Action` base クラスの有無 (Task 17)
   - Hanami middleware chain の raw body 保持 (Task 17 Step 5)
   - Stripe API version と `current_period_end` の位置 (Task 15)

4. **verify されるべき path**:
   - `lib/tasks/*.rake` が rake から自動 load される仕組み (existing account.rake で確認)
   - `bin/grpc` の handler register 位置 (karte 参照)
