# Billing Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monolith に `billing` slice を追加し、Guest / Cast それぞれ 1 tier の月額 Stripe subscription 基盤 (Checkout + Customer Portal + webhook mirror + entitlement query) を提供する。

**Architecture:** Hanami 3 slice。karte slice をテンプレートに `db/{relation,repo,struct}.rb` + `repositories/` + `use_cases/` + `grpc/handler` + `adapters/` + `actions/webhooks/` を作る。Stripe SDK 呼び出しは `Billing::Adapters::StripeClient` に集約し spec では `FakeStripeClient` に差し替え。DB への書き込み口を webhook のみに絞り、event dedupe + `canceled` 終端ルールで冪等・out-of-order 耐性を持たせる。

**Tech Stack:** Ruby, Hanami 3 (slice), Gruf (gRPC), ROM-SQL + Sequel, PostgreSQL, dry-operation / dry-validation, Stripe Ruby SDK, RSpec + database_cleaner-sequel, protoc + grpc_ruby_plugin (buf).

**Spec:** `docs/superpowers/specs/2026-08-26-billing-slice-design.md`

## Global Constraints

- Ruby version は monolith の既存 `.ruby-version` に従う (勝手に上げない)
- Hanami は `~> 3.0`、`hanami-*` gem 群は既存の Gemfile pin を維持
- 新規追加 gem: `stripe` (バージョンは実装時に latest stable を採用、Gemfile.lock を締める)
- 全ての Ruby ファイル冒頭に `# frozen_string_literal: true` を置く
- モジュール名: 常に `Billing::…` (例: `Billing::Repositories::CustomerRepository`)
- DB schema 名 / table 名: `billing__customers` / `billing__subscriptions` / `billing__stripe_events` (Postgres schema `billing` の下)
- gRPC service 名: `billing.v1.BillingService`
- Stripe status enum は文字列で DB 保存 (`trialing / active / incomplete / incomplete_expired / past_due / canceled / unpaid / paused`)
- Proto の Subscription.Status enum は spec §Architecture に列挙 (`STATUS_UNSPECIFIED=0` から)
- Stripe API 呼び出しは全て `Billing::Adapters::StripeClient` 経由 (直接 `::Stripe::…` を触るのは adapter とテスト用 fake のみ)
- Stripe → DB の書き込み口は webhook のみ (`process_webhook_event` use case)。他 use case / rake task が subscription 行を作ることは禁止 (reconcile task を除く)
- webhook 対象 event: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `checkout.session.completed`
- Idempotency-Key: Customer 作成 = `"billing:create_customer:<user_id>"`、Checkout Session = `"billing:create_checkout:<user_id>:<yyyymmddhh>"`、Portal Session = `"billing:create_portal:<user_id>:<yyyymmddhh>"`
- コミット: `-s` 必須、`Co-Authored-By` 付与禁止 (AGENTS.md)
- 出力言語: 日本語 (コード内 identifier / commit message / PR title は英語) (AGENTS.md)
- テストコード内の期待値の meaning は日本語コメント可、identifier は英語
- CI は rspec を回さない (memory "Monolith verification")。**各タスクの完了条件に "ローカルで対象 spec を green" を含める**
- Gemfile を触ったら push 前に `bundle install --frozen` で lockfile 整合性を確認 (memory "Bundle freeze check")

## Reference (implementation-time にこれらを見ろ)

- **spec**: `docs/superpowers/specs/2026-08-26-billing-slice-design.md` (全ての決定はここに書かれている)
- **slice template**: `dystopia/monolith/slices/karte/` を全面参照。DB scaffolding / grpc handler / use_case / adapter パターン全部同じ
- **gRPC handler の base**: `dystopia/monolith/slices/karte/grpc/{handler,karte_handler}.rb`
- **use_case DI パターン**: `dystopia/monolith/slices/karte/use_cases/get_my_access.rb` (最小例)
- **repository パターン**: `dystopia/monolith/slices/karte/repositories/{access,entry}_repository.rb`
- **use_case spec パターン**: `dystopia/monolith/spec/slices/karte/use_cases/get_my_access_spec.rb`
- **repository spec パターン**: `dystopia/monolith/spec/slices/karte/repositories/entry_repository_spec.rb` (type: :database、実 DB)
- **migration 例**: `dystopia/monolith/config/db/migrate/20260628000000_create_karte_schema.rb`
- **rake task 例**: `dystopia/monolith/lib/tasks/account.rake`
- **gRPC server 登録**: `dystopia/monolith/bin/grpc` の proto require 部分に追加
- **spec_helper**: `dystopia/monolith/spec/spec_helper.rb` (DatabaseCleaner setup 済)

---

## Task 1: Add stripe gem + monolith settings scaffolding

**Files:**
- Modify: `dystopia/monolith/Gemfile`
- Modify: `dystopia/monolith/Gemfile.lock` (bundler が更新)
- Modify: `dystopia/monolith/config/settings.rb`

**Interfaces:**
- Consumes: —
- Produces:
  - `Hanami.app["settings"].stripe_api_key : String`
  - `Hanami.app["settings"].stripe_webhook_secret : String`
  - `Hanami.app["settings"].stripe_price_id_guest : String`
  - `Hanami.app["settings"].stripe_price_id_cast : String`
  - `Hanami.app["settings"].billing_success_url : String`
  - `Hanami.app["settings"].billing_cancel_url : String`
  - `Hanami.app["settings"].billing_portal_return_url : String`
  - `::Stripe` (gem loaded)

- [ ] **Step 1: Gemfile に stripe gem を追加**

`dystopia/monolith/Gemfile` の `gem "jwt"` の下あたり (外部 API 群) に追加:

```ruby
gem "stripe"
```

- [ ] **Step 2: bundle install で lockfile 更新**

```bash
cd dystopia/monolith
bundle install
```

- [ ] **Step 3: settings.rb に STRIPE_* / BILLING_* を追加**

`dystopia/monolith/config/settings.rb` を以下に差し替える:

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

`Types::String` は Hanami 標準 (`Hanami::Settings` 内で参照可能)。既存 slice で使用例が無ければ `Dry::Types['string']` を代替として使う (実装時に verify)。

- [ ] **Step 4: `.env.test` (existing) と `.env.development` (existing) に dummy 値を追加**

各 env ファイルを Read で確認し、以下を追加 (既存の env ファイルを探して format に従う):

```
STRIPE_API_KEY=sk_test_dummy_replace_via_stripe_dashboard
STRIPE_WEBHOOK_SECRET=whsec_dummy_replace_via_stripe_dashboard
STRIPE_PRICE_ID_GUEST=price_dummy_guest
STRIPE_PRICE_ID_CAST=price_dummy_cast
BILLING_SUCCESS_URL=http://localhost:3000/settings/billing?checkout=success
BILLING_CANCEL_URL=http://localhost:3000/settings/billing?checkout=cancel
BILLING_PORTAL_RETURN_URL=http://localhost:3000/settings/billing
```

env ファイルが存在しない場合はスキップ (実装時に判断)。

- [ ] **Step 5: bundle install --frozen で lockfile 整合性確認**

```bash
cd dystopia/monolith
bundle install --frozen
```

Expected: エラーなく完了

- [ ] **Step 6: 動作確認スペック (settings が読める)**

`dystopia/monolith/spec/config/settings_spec.rb` を新規作成:

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
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/config/settings_spec.rb
```

Expected: PASS (dummy 値がロードされる)

- [ ] **Step 8: Commit**

```bash
git add dystopia/monolith/Gemfile dystopia/monolith/Gemfile.lock \
        dystopia/monolith/config/settings.rb \
        dystopia/monolith/spec/config/settings_spec.rb
git commit -s -m "feat(monolith/billing): add stripe gem and billing settings scaffolding"
```

---

## Task 2: Proto definition + codegen + gRPC boot wiring

**Files:**
- Create: `proto/dystopia/billing/v1/service.proto`
- Modify: `dystopia/monolith/bin/grpc` (proto require 追加)
- Generated (via `bin/codegen`): `dystopia/monolith/stubs/billing/**`

**Interfaces:**
- Consumes: —
- Produces:
  - `::Billing::V1::BillingService::Service` (gRPC service class)
  - `::Billing::V1::Subscription` (with `Status` enum)
  - `::Billing::V1::GetMySubscriptionRequest / Response`
  - `::Billing::V1::CreateCheckoutSessionRequest / Response`
  - `::Billing::V1::CreateCustomerPortalSessionRequest / Response`

- [ ] **Step 1: Proto を作成**

`proto/dystopia/billing/v1/service.proto` を新規作成:

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

- [ ] **Step 2: codegen を実行して stubs を生成**

```bash
cd dystopia/monolith
bundle exec bin/codegen
```

Expected: `dystopia/monolith/stubs/billing/v1/service_pb.rb` と `service_services_pb.rb` が生成される

- [ ] **Step 3: bin/grpc に proto require を追加**

`dystopia/monolith/bin/grpc` を Read し、既存の `require "karte/v1/service_services_pb"` の下 (アルファ順的には近い位置) に追加:

```ruby
require "billing/v1/service_services_pb"
```

- [ ] **Step 4: 生成物の smoke 確認**

```bash
cd dystopia/monolith
bundle exec ruby -Istubs -e 'require "billing/v1/service_services_pb"; puts ::Billing::V1::BillingService::Service.rpc_descs.keys.inspect'
```

Expected: `[:GetMySubscription, :CreateCheckoutSession, :CreateCustomerPortalSession]`

- [ ] **Step 5: enum 値の確認**

```bash
cd dystopia/monolith
bundle exec ruby -Istubs -e 'require "billing/v1/service_services_pb"; puts ::Billing::V1::Subscription::Status.constants.inspect'
```

Expected: 全 status 値が並ぶ

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
- Create: `dystopia/monolith/config/db/migrate/YYYYMMDDHHMMSS_create_billing_schema.rb` (実装時のタイムスタンプで命名)

**Interfaces:**
- Consumes: —
- Produces: `billing.customers` / `billing.subscriptions` / `billing.stripe_events` テーブル (Postgres schema `billing`)

- [ ] **Step 1: migration ファイル作成**

タイムスタンプ生成:

```bash
date -u '+%Y%m%d%H%M%S'
```

そのタイムスタンプを prefix にして `dystopia/monolith/config/db/migrate/<TS>_create_billing_schema.rb` を作成 (karte migration に倣う):

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS billing"

    create_table :"billing__customers" do
      column :id, :uuid, null: false
      column :user_id, :uuid, null: false
      column :stripe_customer_id, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:user_id], name: :uq_billing_customers_user_id
      unique [:stripe_customer_id], name: :uq_billing_customers_stripe_customer_id
    end

    create_table :"billing__subscriptions" do
      column :id, :uuid, null: false
      column :user_id, :uuid, null: false
      column :stripe_subscription_id, :text, null: false
      column :stripe_price_id, :text, null: false
      column :status, :text, null: false
      column :current_period_end, :timestamptz, null: false
      column :cancel_at_period_end, :boolean, null: false, default: false
      column :canceled_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:user_id], name: :uq_billing_subscriptions_user_id
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
cd dystopia/monolith
HANAMI_ENV=test bundle exec rake db:migrate
```

Expected: エラーなく完了。3 テーブルが `billing` schema に作られる

- [ ] **Step 3: schema 確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec ruby -e '
  require "hanami/prepare"
  db = Hanami.app["db.gateway"].connection
  puts db["SELECT table_name FROM information_schema.tables WHERE table_schema = ?", "billing"].map(:table_name).inspect
'
```

Expected: `["customers", "subscriptions", "stripe_events"]` (順不同)

- [ ] **Step 4: rollback / re-migrate で down 動作確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rake db:rollback
HANAMI_ENV=test bundle exec rake db:migrate
```

Expected: 両方エラーなく完了

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/config/db/migrate/
git commit -s -m "feat(monolith/billing): add migration for billing schema (customers/subscriptions/stripe_events)"
```

---

## Task 4: Billing slice DB scaffolding

**Files:**
- Create: `dystopia/monolith/slices/billing/db/relation.rb`
- Create: `dystopia/monolith/slices/billing/db/repo.rb`
- Create: `dystopia/monolith/slices/billing/db/struct.rb`

**Interfaces:**
- Consumes: `Monolith::DB::{Relation,Repo,Struct}` (既存)
- Produces:
  - `Billing::DB::Relation < Monolith::DB::Relation`
  - `Billing::DB::Repo < Monolith::DB::Repo`
  - `Billing::DB::Struct < Monolith::DB::Struct`

これらは karte と同じく空の subclass。以降のタスクで作る repository が継承する。

- [ ] **Step 1: 3 ファイルを作成**

`dystopia/monolith/slices/billing/db/relation.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

`dystopia/monolith/slices/billing/db/repo.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

`dystopia/monolith/slices/billing/db/struct.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module DB
    class Struct < Monolith::DB::Struct
    end
  end
end
```

- [ ] **Step 2: slice boot smoke 確認 (Hanami が slice を認識するか)**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec ruby -e '
  require "hanami/prepare"
  puts ::Billing::Slice.class.name
  puts ::Billing::DB::Repo.superclass.name
'
```

Expected: `Hanami::Slice` (または継承クラス名) と `Monolith::DB::Repo`

- [ ] **Step 3: Commit**

```bash
git add dystopia/monolith/slices/billing/db/
git commit -s -m "feat(monolith/billing): add DB scaffolding for billing slice"
```

---

## Task 5: CustomerRepository (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/repositories/customer_repository_spec.rb`
- Create: `dystopia/monolith/slices/billing/repositories/customer_repository.rb`

**Interfaces:**
- Consumes: `Billing::DB::Repo`
- Produces: `Billing::Repositories::CustomerRepository` with:
  - `#upsert_by_user_id(user_id:, stripe_customer_id:) -> Struct` (行 upsert、既存なら stripe_customer_id 更新)
  - `#find_by_user_id(user_id) -> Struct | nil`
  - `#find_by_stripe_customer_id(stripe_customer_id) -> Struct | nil`
  - `#all -> Array<Struct>` (reconcile task 用)

- [ ] **Step 1: 失敗する spec を書く**

`dystopia/monolith/spec/slices/billing/repositories/customer_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/customer_repository"

RSpec.describe Billing::Repositories::CustomerRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:user_id) { SecureRandom.uuid_v7 }
  let(:stripe_customer_id) { "cus_test_#{SecureRandom.hex(8)}" }

  describe "#upsert_by_user_id" do
    it "creates a new row when user is new" do
      row = repo.upsert_by_user_id(user_id: user_id, stripe_customer_id: stripe_customer_id)
      expect(row.user_id).to eq(user_id)
      expect(row.stripe_customer_id).to eq(stripe_customer_id)
      expect(row.id).not_to be_nil
    end

    it "updates stripe_customer_id when a row for user already exists" do
      repo.upsert_by_user_id(user_id: user_id, stripe_customer_id: "cus_old")
      updated = repo.upsert_by_user_id(user_id: user_id, stripe_customer_id: "cus_new")
      expect(updated.stripe_customer_id).to eq("cus_new")
      expect(repo.find_by_user_id(user_id).stripe_customer_id).to eq("cus_new")
    end
  end

  describe "#find_by_user_id" do
    it "returns nil when no row exists" do
      expect(repo.find_by_user_id(user_id)).to be_nil
    end

    it "returns the row when it exists" do
      repo.upsert_by_user_id(user_id: user_id, stripe_customer_id: stripe_customer_id)
      row = repo.find_by_user_id(user_id)
      expect(row.stripe_customer_id).to eq(stripe_customer_id)
    end
  end

  describe "#find_by_stripe_customer_id" do
    it "returns the row when it exists" do
      repo.upsert_by_user_id(user_id: user_id, stripe_customer_id: stripe_customer_id)
      row = repo.find_by_stripe_customer_id(stripe_customer_id)
      expect(row.user_id).to eq(user_id)
    end

    it "returns nil when not found" do
      expect(repo.find_by_stripe_customer_id("cus_missing")).to be_nil
    end
  end

  describe "#all" do
    it "returns every customer row" do
      3.times { |i| repo.upsert_by_user_id(user_id: SecureRandom.uuid_v7, stripe_customer_id: "cus_#{i}") }
      expect(repo.all.size).to eq(3)
    end
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/customer_repository_spec.rb
```

Expected: FAIL (`uninitialized constant Billing::Repositories::CustomerRepository`)

- [ ] **Step 3: repository を実装**

`dystopia/monolith/slices/billing/repositories/customer_repository.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module Repositories
    class CustomerRepository < Billing::DB::Repo
      def upsert_by_user_id(user_id:, stripe_customer_id:)
        now = Time.now
        existing = customers.where(user_id: user_id).one
        if existing
          customers.by_pk(existing.id).command(:update).call(
            stripe_customer_id: stripe_customer_id,
            updated_at: now
          )
        else
          customers.command(:create).call(
            id: SecureRandom.uuid_v7,
            user_id: user_id,
            stripe_customer_id: stripe_customer_id
          )
        end
      end

      def find_by_user_id(user_id)
        customers.where(user_id: user_id).one
      end

      def find_by_stripe_customer_id(stripe_customer_id)
        customers.where(stripe_customer_id: stripe_customer_id).one
      end

      def all
        customers.to_a
      end
    end
  end
end
```

注: `customers` は ROM の relation。karte では `entry_records` / `access_records` のように `_records` suffix を使用しているが、これは karte の relation クラス側で自動命名を上書きしている可能性がある。実装時に karte の relation を確認し、同じ命名規約 (`customers` そのまま or `customer_records`) を採用する。

- [ ] **Step 4: spec を実行して pass を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/customer_repository_spec.rb
```

Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/billing/repositories/customer_repository.rb \
        dystopia/monolith/spec/slices/billing/repositories/customer_repository_spec.rb
git commit -s -m "feat(monolith/billing): add CustomerRepository"
```

---

## Task 6: SubscriptionRepository (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/repositories/subscription_repository_spec.rb`
- Create: `dystopia/monolith/slices/billing/repositories/subscription_repository.rb`

**Interfaces:**
- Consumes: `Billing::DB::Repo`
- Produces: `Billing::Repositories::SubscriptionRepository` with:
  - `#upsert_by_stripe_id(user_id:, stripe_subscription_id:, stripe_price_id:, status:, current_period_end:, cancel_at_period_end:) -> Struct`
  - `#find_by_user_id(user_id) -> Struct | nil`
  - `#find_by_stripe_subscription_id(id) -> Struct | nil`
  - `#find_active_by_user_id(user_id) -> Struct | nil` (`status IN ('trialing','active') AND current_period_end > now()`)
  - `#mark_canceled(stripe_subscription_id:, canceled_at:)` (status=canceled, canceled_at セット)

- [ ] **Step 1: 失敗する spec を書く**

`dystopia/monolith/spec/slices/billing/repositories/subscription_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/subscription_repository"

RSpec.describe Billing::Repositories::SubscriptionRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:user_id) { SecureRandom.uuid_v7 }
  let(:sub_id) { "sub_#{SecureRandom.hex(8)}" }
  let(:price_id) { "price_test_guest" }
  let(:period_end) { Time.now + 30 * 24 * 60 * 60 }

  def upsert(overrides = {})
    repo.upsert_by_stripe_id(
      user_id: user_id,
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
      # 1 user 1 subscription 前提の unique(user_id) が守られていること
      expect(repo.find_by_user_id(user_id).stripe_subscription_id).to eq(sub_id)
    end
  end

  describe "#find_active_by_user_id" do
    it "returns row when status=active and current_period_end in future" do
      upsert(status: "active", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_user_id(user_id)).not_to be_nil
    end

    it "returns row when status=trialing and current_period_end in future" do
      upsert(status: "trialing", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_user_id(user_id)).not_to be_nil
    end

    it "returns nil when status=past_due" do
      upsert(status: "past_due", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_user_id(user_id)).to be_nil
    end

    it "returns nil when current_period_end is in the past even if status=active" do
      upsert(status: "active", current_period_end: Time.now - 3600)
      expect(repo.find_active_by_user_id(user_id)).to be_nil
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

- [ ] **Step 2: spec を実行して失敗を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/subscription_repository_spec.rb
```

Expected: FAIL

- [ ] **Step 3: repository を実装**

`dystopia/monolith/slices/billing/repositories/subscription_repository.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module Repositories
    class SubscriptionRepository < Billing::DB::Repo
      def upsert_by_stripe_id(user_id:, stripe_subscription_id:, stripe_price_id:, status:,
                              current_period_end:, cancel_at_period_end:, canceled_at: nil)
        now = Time.now
        existing = subscriptions.where(stripe_subscription_id: stripe_subscription_id).one
        attrs = {
          user_id: user_id,
          stripe_price_id: stripe_price_id,
          status: status,
          current_period_end: current_period_end,
          cancel_at_period_end: cancel_at_period_end,
          canceled_at: canceled_at,
          updated_at: now
        }
        if existing
          subscriptions.by_pk(existing.id).command(:update).call(attrs)
        else
          subscriptions.command(:create).call(
            attrs.merge(id: SecureRandom.uuid_v7, stripe_subscription_id: stripe_subscription_id)
          )
        end
      end

      def find_by_user_id(user_id)
        subscriptions.where(user_id: user_id).one
      end

      def find_by_stripe_subscription_id(stripe_subscription_id)
        subscriptions.where(stripe_subscription_id: stripe_subscription_id).one
      end

      def find_active_by_user_id(user_id)
        subscriptions
          .where(user_id: user_id, status: %w[trialing active])
          .where { current_period_end > Time.now }
          .one
      end

      def mark_canceled(stripe_subscription_id:, canceled_at:)
        subscriptions
          .where(stripe_subscription_id: stripe_subscription_id)
          .command(:update)
          .call(status: "canceled", canceled_at: canceled_at, updated_at: Time.now)
      end
    end
  end
end
```

- [ ] **Step 4: spec を実行して pass を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/subscription_repository_spec.rb
```

Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/billing/repositories/subscription_repository.rb \
        dystopia/monolith/spec/slices/billing/repositories/subscription_repository_spec.rb
git commit -s -m "feat(monolith/billing): add SubscriptionRepository"
```

---

## Task 7: StripeEventRepository (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/repositories/stripe_event_repository_spec.rb`
- Create: `dystopia/monolith/slices/billing/repositories/stripe_event_repository.rb`

**Interfaces:**
- Consumes: `Billing::DB::Repo`
- Produces: `Billing::Repositories::StripeEventRepository` with:
  - `#find_by_stripe_event_id(id) -> Struct | nil`
  - `#insert_received(stripe_event_id:, event_type:, payload:) -> Struct` (`processed_at` は nil)
  - `#mark_processed(stripe_event_id:)` (processed_at=now, error_message=nil)
  - `#mark_failed(stripe_event_id:, error_message:)` (processed_at は nil のまま、error_message セット)

- [ ] **Step 1: 失敗する spec を書く**

`dystopia/monolith/spec/slices/billing/repositories/stripe_event_repository_spec.rb`:

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

- [ ] **Step 2: spec を実行して失敗を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/stripe_event_repository_spec.rb
```

Expected: FAIL

- [ ] **Step 3: repository を実装**

`dystopia/monolith/slices/billing/repositories/stripe_event_repository.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module Repositories
    class StripeEventRepository < Billing::DB::Repo
      def find_by_stripe_event_id(stripe_event_id)
        stripe_events.where(stripe_event_id: stripe_event_id).one
      end

      def insert_received(stripe_event_id:, event_type:, payload:)
        stripe_events.command(:create).call(
          id: SecureRandom.uuid_v7,
          stripe_event_id: stripe_event_id,
          event_type: event_type,
          payload: Sequel.pg_jsonb(payload)
        )
      end

      def mark_processed(stripe_event_id:)
        stripe_events
          .where(stripe_event_id: stripe_event_id)
          .command(:update)
          .call(processed_at: Time.now, error_message: nil)
      end

      def mark_failed(stripe_event_id:, error_message:)
        stripe_events
          .where(stripe_event_id: stripe_event_id)
          .command(:update)
          .call(error_message: error_message)
      end
    end
  end
end
```

注: `Sequel.pg_jsonb(payload)` は Postgres jsonb 列への insert に必要な wrapper。実装時に他 slice で jsonb を扱っている箇所があれば同じ方式を採用。無ければ `payload.to_json` + カラム型変換に頼る (要 verify)。

- [ ] **Step 4: spec を実行して pass を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/repositories/stripe_event_repository_spec.rb
```

Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/billing/repositories/stripe_event_repository.rb \
        dystopia/monolith/spec/slices/billing/repositories/stripe_event_repository_spec.rb
git commit -s -m "feat(monolith/billing): add StripeEventRepository"
```

---

## Task 8: PlanRegistry config

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/config/plan_registry_spec.rb`
- Create: `dystopia/monolith/slices/billing/config/plan_registry.rb`

**Interfaces:**
- Consumes: `Hanami.app["settings"]`
- Produces: `Billing::Config::PlanRegistry`
  - `#price_id_for(role) -> String` (`role` は Integer: 1=Guest, 2=Cast)
  - `UnsupportedRoleError` 例外クラス

`identity__users.role` は Integer で `1 = Guest`。Cast の値は既存 code の実装を実装時に確認 (`Identity::Slice` 内の enum 定義を参照)。本 plan では `1=Guest`, `2=Cast` を仮定するが verify する。

- [ ] **Step 1: 失敗する spec を書く**

`dystopia/monolith/spec/slices/billing/config/plan_registry_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/config/plan_registry"

RSpec.describe Billing::Config::PlanRegistry do
  subject(:registry) do
    described_class.new(
      guest_price_id: "price_g",
      cast_price_id: "price_c"
    )
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

- [ ] **Step 2: spec を実行して失敗を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/config/plan_registry_spec.rb
```

Expected: FAIL

- [ ] **Step 3: 実装**

`dystopia/monolith/slices/billing/config/plan_registry.rb`:

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

- [ ] **Step 4: spec を実行して pass を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/config/plan_registry_spec.rb
```

Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/billing/config/plan_registry.rb \
        dystopia/monolith/spec/slices/billing/config/plan_registry_spec.rb
git commit -s -m "feat(monolith/billing): add PlanRegistry for role→price_id mapping"
```

---

## Task 9: StripeClient adapter (real ::Stripe wrapper)

**Files:**
- Create: `dystopia/monolith/slices/billing/adapters/stripe_client.rb`
- Create: `dystopia/monolith/spec/slices/billing/adapters/stripe_client_spec.rb` (interface のみ検証、real API は呼ばない)

**Interfaces:**
- Consumes: `::Stripe` (gem)、`Hanami.app["settings"]`
- Produces: `Billing::Adapters::StripeClient` with:
  - `#create_customer(user_id:, idempotency_key:) -> ::Stripe::Customer`
  - `#create_checkout_session(customer_id:, price_id:, success_url:, cancel_url:, idempotency_key:) -> ::Stripe::Checkout::Session`
  - `#create_billing_portal_session(customer_id:, return_url:, idempotency_key:) -> ::Stripe::BillingPortal::Session`
  - `#retrieve_subscription(stripe_subscription_id:) -> ::Stripe::Subscription`
  - `#construct_webhook_event(payload:, sig_header:, secret:) -> ::Stripe::Event` (raises `Stripe::SignatureVerificationError` / `JSON::ParserError`)

- [ ] **Step 1: spec を書く (interface / signature 検証のみ)**

`dystopia/monolith/spec/slices/billing/adapters/stripe_client_spec.rb`:

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

`dystopia/monolith/slices/billing/adapters/stripe_client.rb`:

```ruby
# frozen_string_literal: true

require "stripe"

module Billing
  module Adapters
    class StripeClient
      def initialize(api_key:)
        @api_key = api_key
      end

      def create_customer(user_id:, idempotency_key:)
        ::Stripe::Customer.create(
          { metadata: { user_id: user_id.to_s } },
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

- [ ] **Step 3: spec を実行**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/adapters/stripe_client_spec.rb
```

Expected: 全 PASS

- [ ] **Step 4: Commit**

```bash
git add dystopia/monolith/slices/billing/adapters/stripe_client.rb \
        dystopia/monolith/spec/slices/billing/adapters/stripe_client_spec.rb
git commit -s -m "feat(monolith/billing): add StripeClient adapter around the Stripe SDK"
```

---

## Task 10: FakeStripeClient (spec support)

**Files:**
- Create: `dystopia/monolith/spec/support/billing/fake_stripe_client.rb`
- Create: `dystopia/monolith/spec/support/billing/fake_stripe_client_spec.rb`

**Interfaces:**
- Consumes: `Billing::Adapters::StripeClient` (interface parity)
- Produces: `Spec::Billing::FakeStripeClient` (namespace は spec 内)
  - StripeClient と同じ method signature
  - in-memory hash で customer / subscription / checkout_session / portal_session を保持
  - decisive な id (`cus_fake_<n>`, `sub_fake_<n>`, `cs_fake_<n>`, `ps_fake_<n>`) を返す
  - `#construct_webhook_event` は fixed secret (`whsec_fake`) + 実 HMAC で通す実装 (`Stripe::Webhook::Signature` を使い実 SDK ロジックを再利用)
  - test-only 補助: `#inject_subscription(user_id:, ...)`, `#raise_on_next_call(error)`, `#recorded_calls`, `#reset!`

- [ ] **Step 1: fake の interface parity spec を書く**

`dystopia/monolith/spec/support/billing/fake_stripe_client_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "support/billing/fake_stripe_client"
require "slices/billing/adapters/stripe_client"

RSpec.describe Spec::Billing::FakeStripeClient do
  subject(:fake) { described_class.new }

  it "has the same public interface as the real StripeClient" do
    real_methods = Billing::Adapters::StripeClient.instance_methods(false).sort
    fake_methods = (described_class.instance_methods(false) - described_class.instance_methods(true)).sort
    # fake 側は test-only 補助 method を持つので、real の method 集合を include していれば OK
    real_methods.each do |m|
      expect(described_class.instance_methods).to include(m), "fake is missing #{m}"
    end
  end

  it "create_customer returns a customer-like object with id and metadata" do
    result = fake.create_customer(user_id: "user-1", idempotency_key: "k1")
    expect(result.id).to match(/\Acus_fake_/)
    expect(result.metadata["user_id"]).to eq("user-1")
  end

  it "create_customer is idempotent by idempotency_key" do
    a = fake.create_customer(user_id: "user-1", idempotency_key: "same-key")
    b = fake.create_customer(user_id: "user-1", idempotency_key: "same-key")
    expect(a.id).to eq(b.id)
  end

  it "create_checkout_session returns object with .url" do
    fake.create_customer(user_id: "user-1", idempotency_key: "k1")
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

- [ ] **Step 2: spec 実行して失敗確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/support/billing/fake_stripe_client_spec.rb
```

Expected: FAIL

- [ ] **Step 3: FakeStripeClient を実装**

`dystopia/monolith/spec/support/billing/fake_stripe_client.rb`:

```ruby
# frozen_string_literal: true

require "stripe"
require "openssl"

module Spec
  module Billing
    class FakeStripeClient
      FAKE_SECRET = "whsec_fake"

      def initialize
        reset!
      end

      def reset!
        @customers = {}          # cus_id -> {id, metadata}
        @customers_by_key = {}   # idempotency_key -> cus_id
        @subscriptions = {}      # sub_id -> Struct
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

      # ---- StripeClient interface ----

      def create_customer(user_id:, idempotency_key:)
        maybe_raise!
        record(:create_customer, user_id: user_id, idempotency_key: idempotency_key)
        return @customers[@customers_by_key[idempotency_key]] if @customers_by_key.key?(idempotency_key)

        @seq[:customer] += 1
        id = "cus_fake_#{@seq[:customer]}"
        cus = OpenStruct.new(id: id, metadata: { "user_id" => user_id.to_s })
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

      # ---- helpers for tests ----

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

- [ ] **Step 4: spec を実行して pass 確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/support/billing/fake_stripe_client_spec.rb
```

Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/spec/support/billing/
git commit -s -m "test(monolith/billing): add FakeStripeClient for spec-level Stripe substitution"
```

---

## Task 11: Queries::ActiveSubscription (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/queries/active_subscription_spec.rb`
- Create: `dystopia/monolith/slices/billing/queries/active_subscription.rb`

**Interfaces:**
- Consumes: `Billing::Repositories::SubscriptionRepository`
- Produces: `Billing::Queries::ActiveSubscription`
  - `#call(user_id) -> Struct | nil` (`SubscriptionRepository#find_active_by_user_id` の thin wrapper。他 slice から `::Billing::Slice["queries.active_subscription"]` で参照される entitlement 判定原型)

- [ ] **Step 1: spec を書く**

`dystopia/monolith/spec/slices/billing/queries/active_subscription_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/queries/active_subscription"

RSpec.describe Billing::Queries::ActiveSubscription do
  let(:sub_repo) { double(:subscription_repo) }
  subject(:query) { described_class.new(subscription_repo: sub_repo) }

  it "returns row from find_active_by_user_id" do
    row = double(:sub)
    allow(sub_repo).to receive(:find_active_by_user_id).with("u1").and_return(row)
    expect(query.call("u1")).to be(row)
  end

  it "returns nil when repo returns nil" do
    allow(sub_repo).to receive(:find_active_by_user_id).with("u1").and_return(nil)
    expect(query.call("u1")).to be_nil
  end
end
```

- [ ] **Step 2: spec を実行して失敗確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/queries/active_subscription_spec.rb
```

- [ ] **Step 3: 実装**

`dystopia/monolith/slices/billing/queries/active_subscription.rb`:

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

      def call(user_id)
        subscription_repo.find_active_by_user_id(user_id)
      end
    end
  end
end
```

- [ ] **Step 4: pass 確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/queries/active_subscription_spec.rb
```

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/billing/queries/ \
        dystopia/monolith/spec/slices/billing/queries/
git commit -s -m "feat(monolith/billing): add ActiveSubscription query for entitlement lookups"
```

---

## Task 12: GetMySubscription use case (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/use_cases/get_my_subscription_spec.rb`
- Create: `dystopia/monolith/slices/billing/use_cases/get_my_subscription.rb`

**Interfaces:**
- Consumes: `Billing::Repositories::SubscriptionRepository`
- Produces: `Billing::UseCases::GetMySubscription`
  - `#call(user_id:) -> Hash | nil` — 未加入なら nil、そうでなければ `{ status: String, current_period_end: Time, cancel_at_period_end: Boolean, price_id: String }`

Handler 側で proto enum への変換を行う (`STATUS_UNSPECIFIED` 等)。use_case はドメイン形式のまま返す。

- [ ] **Step 1: spec を書く**

`dystopia/monolith/spec/slices/billing/use_cases/get_my_subscription_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/get_my_subscription"

RSpec.describe Billing::UseCases::GetMySubscription do
  let(:sub_repo) { double(:subscription_repo) }
  subject(:use_case) { described_class.new(subscription_repo: sub_repo) }

  let(:user_id) { "u1" }

  it "returns nil when no subscription row exists" do
    allow(sub_repo).to receive(:find_by_user_id).with(user_id).and_return(nil)
    expect(use_case.call(user_id: user_id)).to be_nil
  end

  it "returns a hash mirroring the row" do
    period_end = Time.now + 3600
    row = OpenStruct.new(
      status: "trialing",
      current_period_end: period_end,
      cancel_at_period_end: false,
      stripe_price_id: "price_g"
    )
    allow(sub_repo).to receive(:find_by_user_id).with(user_id).and_return(row)

    result = use_case.call(user_id: user_id)
    expect(result).to eq(
      status: "trialing",
      current_period_end: period_end,
      cancel_at_period_end: false,
      price_id: "price_g"
    )
  end
end
```

- [ ] **Step 2: 失敗確認 → 実装**

`dystopia/monolith/slices/billing/use_cases/get_my_subscription.rb`:

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

      def call(user_id:)
        row = subscription_repo.find_by_user_id(user_id)
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

- [ ] **Step 3: pass 確認 + commit**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/get_my_subscription_spec.rb
git add dystopia/monolith/slices/billing/use_cases/get_my_subscription.rb \
        dystopia/monolith/spec/slices/billing/use_cases/get_my_subscription_spec.rb
git commit -s -m "feat(monolith/billing): add GetMySubscription use case"
```

---

## Task 13: CreateCheckoutSession use case (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/use_cases/create_checkout_session_spec.rb`
- Create: `dystopia/monolith/slices/billing/use_cases/create_checkout_session.rb`

**Interfaces:**
- Consumes:
  - `Billing::Repositories::CustomerRepository`
  - `Billing::Repositories::SubscriptionRepository`
  - `Billing::Adapters::StripeClient` (fake 差し替え)
  - `Billing::Config::PlanRegistry`
  - `Hanami.app["settings"]` の `billing_success_url` / `billing_cancel_url`
  - `Identity::Slice["repositories.user_repository"]` で `role` を取得 (実装時 verify、karte `create_entry.rb` に同 pattern あり)
- Produces: `Billing::UseCases::CreateCheckoutSession`
  - `#call(user_id:) -> Hash({ url: String })`
  - 例外: `Billing::UseCases::CreateCheckoutSession::AlreadyActiveError` / `UnsupportedRoleError` / `UserNotFoundError`

- [ ] **Step 1: spec を書く**

`dystopia/monolith/spec/slices/billing/use_cases/create_checkout_session_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/create_checkout_session"
require "support/billing/fake_stripe_client"

RSpec.describe Billing::UseCases::CreateCheckoutSession do
  let(:customer_repo) { double(:customer_repo) }
  let(:subscription_repo) { double(:subscription_repo) }
  let(:user_repo) { double(:user_repo) }
  let(:plan_registry) { Billing::Config::PlanRegistry.new(guest_price_id: "price_g", cast_price_id: "price_c") }
  let(:stripe_client) { Spec::Billing::FakeStripeClient.new }

  subject(:use_case) do
    described_class.new(
      customer_repo: customer_repo,
      subscription_repo: subscription_repo,
      user_repo: user_repo,
      plan_registry: plan_registry,
      stripe_client: stripe_client,
      success_url: "https://app/success",
      cancel_url: "https://app/cancel"
    )
  end

  let(:user_id) { "u1" }
  let(:guest_user) { OpenStruct.new(id: user_id, role: 1) }
  let(:cast_user)  { OpenStruct.new(id: user_id, role: 2) }

  before do
    allow(subscription_repo).to receive(:find_active_by_user_id).with(user_id).and_return(nil)
  end

  context "when user is a guest with no prior customer" do
    before do
      allow(user_repo).to receive(:find_by_id).with(user_id).and_return(guest_user)
      allow(customer_repo).to receive(:find_by_user_id).with(user_id).and_return(nil)
      allow(customer_repo).to receive(:upsert_by_user_id)
    end

    it "creates a Stripe customer, upserts, and returns checkout url" do
      expect(customer_repo).to receive(:upsert_by_user_id).with(user_id: user_id, stripe_customer_id: match(/\Acus_fake_/))
      result = use_case.call(user_id: user_id)
      expect(result[:url]).to match(%r{\Ahttps://checkout\.stripe\.test/})
      calls = stripe_client.recorded_calls.map { |c| c[:method] }
      expect(calls).to include(:create_customer, :create_checkout_session)
    end

    it "uses the guest price id for role=1" do
      use_case.call(user_id: user_id)
      checkout_call = stripe_client.recorded_calls.find { |c| c[:method] == :create_checkout_session }
      expect(checkout_call[:args][:price_id]).to eq("price_g")
    end
  end

  context "when user is a cast with existing customer" do
    let(:existing_customer) { OpenStruct.new(user_id: user_id, stripe_customer_id: "cus_existing") }

    before do
      allow(user_repo).to receive(:find_by_id).with(user_id).and_return(cast_user)
      allow(customer_repo).to receive(:find_by_user_id).with(user_id).and_return(existing_customer)
    end

    it "does NOT create a new Stripe customer" do
      use_case.call(user_id: user_id)
      call_methods = stripe_client.recorded_calls.map { |c| c[:method] }
      expect(call_methods).not_to include(:create_customer)
      expect(call_methods).to include(:create_checkout_session)
    end

    it "uses the cast price id and existing customer id" do
      use_case.call(user_id: user_id)
      checkout_call = stripe_client.recorded_calls.find { |c| c[:method] == :create_checkout_session }
      expect(checkout_call[:args][:price_id]).to eq("price_c")
      expect(checkout_call[:args][:customer_id]).to eq("cus_existing")
    end
  end

  context "when user already has an active subscription" do
    before do
      allow(user_repo).to receive(:find_by_id).with(user_id).and_return(guest_user)
      allow(subscription_repo).to receive(:find_active_by_user_id).with(user_id).and_return(OpenStruct.new)
    end

    it "raises AlreadyActiveError" do
      expect { use_case.call(user_id: user_id) }.to raise_error(described_class::AlreadyActiveError)
    end
  end

  context "when user is unknown" do
    before { allow(user_repo).to receive(:find_by_id).with(user_id).and_return(nil) }

    it "raises UserNotFoundError" do
      expect { use_case.call(user_id: user_id) }.to raise_error(described_class::UserNotFoundError)
    end
  end

  context "when user role has no billing plan" do
    before do
      allow(user_repo).to receive(:find_by_id).with(user_id).and_return(OpenStruct.new(id: user_id, role: 99))
    end

    it "raises UnsupportedRoleError" do
      expect { use_case.call(user_id: user_id) }.to raise_error(described_class::UnsupportedRoleError)
    end
  end

  context "when Stripe raises APIConnectionError" do
    before do
      allow(user_repo).to receive(:find_by_id).with(user_id).and_return(guest_user)
      allow(customer_repo).to receive(:find_by_user_id).with(user_id).and_return(nil)
      allow(customer_repo).to receive(:upsert_by_user_id)
      stripe_client.raise_on_next_call(Stripe::APIConnectionError.new("network"))
    end

    it "propagates the Stripe error" do
      expect { use_case.call(user_id: user_id) }.to raise_error(Stripe::APIConnectionError)
    end
  end
end
```

- [ ] **Step 2: 失敗確認 → 実装**

`dystopia/monolith/slices/billing/use_cases/create_checkout_session.rb`:

```ruby
# frozen_string_literal: true

module Billing
  module UseCases
    class CreateCheckoutSession
      class AlreadyActiveError < StandardError; end
      class UserNotFoundError < StandardError; end
      class UnsupportedRoleError < StandardError; end

      include Billing::Deps[
        customer_repo:      "repositories.customer_repository",
        subscription_repo:  "repositories.subscription_repository",
        stripe_client:      "adapters.stripe_client",
        plan_registry:      "config.plan_registry"
      ]

      def initialize(customer_repo: nil, subscription_repo: nil, stripe_client: nil,
                     plan_registry: nil, user_repo: nil,
                     success_url: nil, cancel_url: nil, **kwargs)
        super(**kwargs.merge(
          customer_repo: customer_repo,
          subscription_repo: subscription_repo,
          stripe_client: stripe_client,
          plan_registry: plan_registry
        ).compact)
        @user_repo = user_repo
        @success_url = success_url || Hanami.app["settings"].billing_success_url
        @cancel_url  = cancel_url  || Hanami.app["settings"].billing_cancel_url
      end

      def call(user_id:)
        user = user_repo.find_by_id(user_id)
        raise UserNotFoundError, "user=#{user_id} not found" unless user

        price_id = begin
          plan_registry.price_id_for(user.role)
        rescue Billing::Config::PlanRegistry::UnsupportedRoleError => e
          raise UnsupportedRoleError, e.message
        end

        raise AlreadyActiveError, "user=#{user_id} already has active subscription" if subscription_repo.find_active_by_user_id(user_id)

        existing = customer_repo.find_by_user_id(user_id)
        stripe_customer_id = existing&.stripe_customer_id
        unless stripe_customer_id
          customer = stripe_client.create_customer(
            user_id: user_id,
            idempotency_key: "billing:create_customer:#{user_id}"
          )
          stripe_customer_id = customer.id
          customer_repo.upsert_by_user_id(user_id: user_id, stripe_customer_id: stripe_customer_id)
        end

        session = stripe_client.create_checkout_session(
          customer_id: stripe_customer_id,
          price_id: price_id,
          success_url: @success_url,
          cancel_url: @cancel_url,
          idempotency_key: "billing:create_checkout:#{user_id}:#{Time.now.strftime('%Y%m%d%H')}"
        )
        { url: session.url }
      end

      private

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.user_repository"]
      end
    end
  end
end
```

- [ ] **Step 3: pass + commit**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/create_checkout_session_spec.rb
git add dystopia/monolith/slices/billing/use_cases/create_checkout_session.rb \
        dystopia/monolith/spec/slices/billing/use_cases/create_checkout_session_spec.rb
git commit -s -m "feat(monolith/billing): add CreateCheckoutSession use case"
```

---

## Task 14: CreateCustomerPortalSession use case (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/use_cases/create_customer_portal_session_spec.rb`
- Create: `dystopia/monolith/slices/billing/use_cases/create_customer_portal_session.rb`

**Interfaces:**
- Consumes:
  - `Billing::Repositories::CustomerRepository`
  - `Billing::Adapters::StripeClient`
  - `Hanami.app["settings"].billing_portal_return_url`
- Produces: `Billing::UseCases::CreateCustomerPortalSession`
  - `#call(user_id:) -> Hash({ url: String })`
  - 例外: `CustomerNotCreatedError`

- [ ] **Step 1: spec を書く**

`dystopia/monolith/spec/slices/billing/use_cases/create_customer_portal_session_spec.rb`:

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

  let(:user_id) { "u1" }

  it "raises when no customer row exists for the user" do
    allow(customer_repo).to receive(:find_by_user_id).with(user_id).and_return(nil)
    expect { use_case.call(user_id: user_id) }.to raise_error(described_class::CustomerNotCreatedError)
  end

  it "returns a portal url when customer exists" do
    allow(customer_repo).to receive(:find_by_user_id).with(user_id).and_return(
      OpenStruct.new(stripe_customer_id: "cus_existing")
    )
    result = use_case.call(user_id: user_id)
    expect(result[:url]).to match(%r{\Ahttps://billing\.stripe\.test/})
    call = stripe_client.recorded_calls.first
    expect(call[:args][:customer_id]).to eq("cus_existing")
    expect(call[:args][:return_url]).to eq("https://app/return")
  end
end
```

- [ ] **Step 2: 実装**

`dystopia/monolith/slices/billing/use_cases/create_customer_portal_session.rb`:

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

      def call(user_id:)
        row = customer_repo.find_by_user_id(user_id)
        raise CustomerNotCreatedError, "user=#{user_id} has no Stripe customer" unless row

        session = stripe_client.create_billing_portal_session(
          customer_id: row.stripe_customer_id,
          return_url: @return_url,
          idempotency_key: "billing:create_portal:#{user_id}:#{Time.now.strftime('%Y%m%d%H')}"
        )
        { url: session.url }
      end
    end
  end
end
```

- [ ] **Step 3: pass + commit**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/create_customer_portal_session_spec.rb
git add dystopia/monolith/slices/billing/use_cases/create_customer_portal_session.rb \
        dystopia/monolith/spec/slices/billing/use_cases/create_customer_portal_session_spec.rb
git commit -s -m "feat(monolith/billing): add CreateCustomerPortalSession use case"
```

---

## Task 15: ProcessWebhookEvent use case (TDD)

**Files:**
- Create: `dystopia/monolith/spec/slices/billing/use_cases/process_webhook_event_spec.rb`
- Create: `dystopia/monolith/slices/billing/use_cases/process_webhook_event.rb`

**Interfaces:**
- Consumes:
  - `Billing::Repositories::StripeEventRepository`
  - `Billing::Repositories::CustomerRepository`
  - `Billing::Repositories::SubscriptionRepository`
- Produces: `Billing::UseCases::ProcessWebhookEvent`
  - `#call(event:) -> Symbol` — 戻り値は `:processed` / `:duplicate` / `:ignored`。例外は上位に伝播 (webhook action 側で 500 応答)
  - `event` は `::Stripe::Event` (Adapter が構築したもの)

Transaction は Sequel 経由: `Hanami.app["db.gateway"].connection.transaction { ... }`。

Out-of-order defense: 既存 `billing__subscriptions` の `status` が `canceled` の場合、`customer.subscription.updated` を受けても upsert しない (canceled 終端ルール)。

- [ ] **Step 1: spec を書く**

`dystopia/monolith/spec/slices/billing/use_cases/process_webhook_event_spec.rb`:

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

  let(:user_id) { SecureRandom.uuid_v7 }
  let(:stripe_customer_id) { "cus_1" }
  let(:stripe_subscription_id) { "sub_1" }
  let(:period_end) { Time.now + 3600 }

  before do
    customer_repo.upsert_by_user_id(user_id: user_id, stripe_customer_id: stripe_customer_id)
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
      result = use_case.call(event: event)
      expect(result).to eq(:processed)
      sub = subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
      expect(sub.status).to eq("trialing")
      expect(sub.user_id).to eq(user_id)
      stored = stripe_event_repo.find_by_stripe_event_id(event.id)
      expect(stored.processed_at).not_to be_nil
    end
  end

  describe "customer.subscription.updated" do
    it "updates status to past_due" do
      created = make_event("customer.subscription.created", subscription_status: "active")
      use_case.call(event: created)
      updated = make_event("customer.subscription.updated", subscription_status: "past_due")
      use_case.call(event: updated)
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
      second = use_case.call(event: event)
      expect(second).to eq(:duplicate)
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

- [ ] **Step 2: 失敗確認 → 実装**

`dystopia/monolith/slices/billing/use_cases/process_webhook_event.rb`:

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
          # customer.subscription.trial_will_end / checkout.session.completed / それ以外は受信ログのみ
          :ignored
        end
      end

      def upsert_subscription(object)
        existing = subscription_repo.find_by_stripe_subscription_id(object.id)
        return if existing && existing.status == "canceled" # out-of-order 防御 (canceled 終端)

        customer = customer_repo.find_by_stripe_customer_id(object.customer)
        raise "no billing__customers row for stripe customer=#{object.customer}" unless customer

        subscription_repo.upsert_by_stripe_id(
          user_id: customer.user_id,
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

注: `current_period_end` は Stripe API version により Subscription 直下か Item 側に来る可能性 (spec §Open Items)。実装時に採用 API version を確認し、Item 側なら `object.items.data.first.current_period_end` を使う。

- [ ] **Step 3: pass + commit**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/use_cases/process_webhook_event_spec.rb
git add dystopia/monolith/slices/billing/use_cases/process_webhook_event.rb \
        dystopia/monolith/spec/slices/billing/use_cases/process_webhook_event_spec.rb
git commit -s -m "feat(monolith/billing): add ProcessWebhookEvent use case with dedupe and canceled-terminal defense"
```

---

## Task 16: BillingHandler (gRPC) + gRPC boot registration

**Files:**
- Create: `dystopia/monolith/slices/billing/grpc/handler.rb`
- Create: `dystopia/monolith/slices/billing/grpc/billing_handler.rb`
- Modify: `dystopia/monolith/bin/grpc` (BillingHandler の register)
- Create: `dystopia/monolith/spec/slices/billing/grpc/billing_handler_spec.rb`

**Interfaces:**
- Consumes: use cases (get_my_subscription / create_checkout_session / create_customer_portal_session)、`::Billing::V1::*` proto messages
- Produces: `Billing::Grpc::BillingHandler` (Gruf handler)

- [ ] **Step 1: handler base を作る**

`dystopia/monolith/slices/billing/grpc/handler.rb`:

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

- [ ] **Step 2: BillingHandler を実装**

`dystopia/monolith/slices/billing/grpc/billing_handler.rb`:

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
        result = get_uc.call(user_id: current_user_id)
        response = ::Billing::V1::GetMySubscriptionResponse.new
        response.subscription = subscription_to_proto(result) if result
        response
      end

      def create_checkout_session
        authenticate_user!
        result = wrap_errors { checkout_uc.call(user_id: current_user_id) }
        ::Billing::V1::CreateCheckoutSessionResponse.new(url: result[:url])
      end

      def create_customer_portal_session
        authenticate_user!
        result = wrap_errors { portal_uc.call(user_id: current_user_id) }
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
      rescue Billing::UseCases::CreateCheckoutSession::AlreadyActiveError => e
        fail!(:failed_precondition, :failed_precondition, e.message)
      rescue Billing::UseCases::CreateCheckoutSession::UserNotFoundError,
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

- [ ] **Step 3: bin/grpc に handler register を追加**

`dystopia/monolith/bin/grpc` を Read して、他 handler が register される場所を探し (`Gruf.configure` 前後)、以下を該当箇所に追加:

```ruby
require_relative "../slices/billing/grpc/handler"
require_relative "../slices/billing/grpc/billing_handler"
```

karte 等が同様に手動 require されている場合その並びに沿う。

- [ ] **Step 4: handler の light-weight spec (proto mapping と error dispatch のみ)**

`dystopia/monolith/spec/slices/billing/grpc/billing_handler_spec.rb`:

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

Handler の RPC 動作全体は Gruf の in-process test が必要で複雑なため、MVP では STATUS_MAP と静的 wire のみを spec で守り、実 RPC は Task 19 の dogfood で検証する。

- [ ] **Step 5: pass + commit**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/grpc/billing_handler_spec.rb
git add dystopia/monolith/slices/billing/grpc/ \
        dystopia/monolith/spec/slices/billing/grpc/ \
        dystopia/monolith/bin/grpc
git commit -s -m "feat(monolith/billing): add gRPC BillingHandler and register in gRPC boot"
```

---

## Task 17: Webhook HTTP action + route

**Files:**
- Create: `dystopia/monolith/slices/billing/actions/webhooks/stripe.rb`
- Modify: `dystopia/monolith/config/routes.rb`
- Create: `dystopia/monolith/spec/slices/billing/actions/webhooks/stripe_spec.rb`

**Interfaces:**
- Consumes: `Billing::UseCases::ProcessWebhookEvent`, `Billing::Adapters::StripeClient#construct_webhook_event`, `Hanami.app["settings"].stripe_webhook_secret`
- Produces: Hanami action at `POST /billing/webhooks/stripe`

- [ ] **Step 1: action spec を書く**

`dystopia/monolith/spec/slices/billing/actions/webhooks/stripe_spec.rb`:

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
    # Deps 差し替え。実装時に Billing::Slice の register override 方法を確認して差し替える。
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

- [ ] **Step 2: action を実装**

`dystopia/monolith/slices/billing/actions/webhooks/stripe.rb`:

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
            # Stripe が retry (最大 3 日) するので例外は上に投げない
          end
        end
      end
    end
  end
end
```

注: `Billing::Action` の base クラスが存在するかは実装時に verify。他 slice が Hanami action を持っているか (`identity` slice の routes.rb の TODO コメントから推測)。無ければ `Hanami::Action` を直接継承 (`class Stripe < ::Hanami::Action`) し、必要な base 定義は `slices/billing/action.rb` に置く。

- [ ] **Step 3: route を追加**

`dystopia/monolith/config/routes.rb` を修正:

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

- [ ] **Step 4: spec 実行 → pass**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/actions/webhooks/stripe_spec.rb
```

- [ ] **Step 5: raw body 保持の verify**

Hanami の middleware chain が body を消費していないことを確認するため、以下を実行:

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec ruby -e '
  require "hanami/prepare"
  puts Hanami.app.config.middleware.stack.map(&:first).inspect
'
```

reader は出力を見て、body を触るような middleware (CSRF、body-parser 系) が action より前に居ないか確認。居る場合は billing action の path をこれらから除外する middleware 設定を追加 (実装時判断)。

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
- Create: `dystopia/monolith/spec/slices/billing/tasks/reconcile_spec.rb`

**Interfaces:**
- Consumes: `Billing::Repositories::CustomerRepository#all`, `Billing::Repositories::SubscriptionRepository`, `Billing::Adapters::StripeClient#retrieve_subscription`
- Produces: `rake billing:reconcile` task

- [ ] **Step 1: reconcile ロジックを spec で駆動**

`dystopia/monolith/spec/slices/billing/tasks/reconcile_spec.rb`:

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

  it "creates mirror rows for subscriptions Stripe knows but DB does not" do
    user = SecureRandom.uuid_v7
    customer_repo.upsert_by_user_id(user_id: user, stripe_customer_id: "cus_1")
    fake.inject_subscription(
      id: "sub_x", customer_id: "cus_1", price_id: "price_g",
      status: "active", current_period_end: Time.now + 3600
    )
    # DB has no subscription row yet
    diff = reconcile.call
    expect(diff[:updated]).to eq(1)
    expect(sub_repo.find_by_stripe_subscription_id("sub_x").status).to eq("active")
  end

  it "updates status when Stripe and DB differ" do
    user = SecureRandom.uuid_v7
    customer_repo.upsert_by_user_id(user_id: user, stripe_customer_id: "cus_2")
    sub_repo.upsert_by_stripe_id(
      user_id: user, stripe_subscription_id: "sub_y", stripe_price_id: "price_g",
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

- [ ] **Step 2: reconcile class を実装**

`dystopia/monolith/slices/billing/tasks/reconcile.rb`:

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
            local_sub = @subscription_repo.find_by_user_id(customer.user_id)
            stripe_sub = fetch_stripe_subscription(local_sub&.stripe_subscription_id, customer.stripe_customer_id)
            checked += 1
            next unless stripe_sub

            if needs_update?(local_sub, stripe_sub)
              @subscription_repo.upsert_by_stripe_id(
                user_id: customer.user_id,
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
            warn "reconcile error for user=#{customer.user_id}: #{e.class}: #{e.message}"
          end
        end

        { checked: checked, updated: updated, errors: errors }
      end

      private

      def fetch_stripe_subscription(known_id, _customer_id)
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

**Note:** MVP スコープでは `known_id` (DB に既に mirror がある subscription) のみを Stripe に照会し、DB に無い subscription の発見 (Stripe → DB 一方向欠落) はスコープ外とする。DB 側に customer だが subscription 行が無い状態は「まだ購入していない or webhook 未着」で、後者は Stripe Dashboard の event resend で個別対応する。

- [ ] **Step 3: rake task を作る**

`dystopia/monolith/lib/tasks/billing.rake`:

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

- [ ] **Step 4: pass + commit**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing/tasks/reconcile_spec.rb
git add dystopia/monolith/slices/billing/tasks/ \
        dystopia/monolith/spec/slices/billing/tasks/ \
        dystopia/monolith/lib/tasks/billing.rake
git commit -s -m "feat(monolith/billing): add reconcile rake task for Stripe/DB drift repair"
```

---

## Task 19: Full-suite green + manual dogfood + Stripe dashboard checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-08-26-billing-slice-design.md` — 「Rollout Considerations」に完了時の Dashboard 設定チェックリストを補足

**Interfaces:** —

- [ ] **Step 1: 全 billing spec を一括で回して green を確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec spec/slices/billing spec/support/billing spec/config/settings_spec.rb
```

Expected: 全 PASS。1 個でも fail していれば実装に戻る。

- [ ] **Step 2: 既存 spec suite に regression を出していないか確認**

```bash
cd dystopia/monolith
HANAMI_ENV=test bundle exec rspec
```

Expected: 全 PASS (billing 追加以前と同数以上の green)。既存 spec が壊れた場合は原因を特定して修正 (billing 追加が原因なら本 plan の task 内で修正)。

- [ ] **Step 3: bundle install --frozen で lockfile 締め**

```bash
cd dystopia/monolith
bundle install --frozen
```

- [ ] **Step 4: manual dogfood 前準備 (Stripe test mode)**

Stripe Dashboard (test mode) で以下を作成:

1. Product 2 つ ("Guest Premium", "Cast Premium")
2. 各 product に月額 Price を作成 (JPY、trial period days = 7 で仮設定)
3. Price ID を控える (`price_...`)
4. Customer Portal 設定: cancel / update payment method / view invoices を enable、plan change を disable
5. Webhook endpoint を追加 (URL は Stripe CLI forward の localhost で OK): `customer.subscription.created` / `.updated` / `.deleted` / `.trial_will_end` / `checkout.session.completed` を enable、signing secret を控える
6. Secret key を控える

`.env.development` に控えた値を投入:

```
STRIPE_API_KEY=sk_test_<controlled>
STRIPE_WEBHOOK_SECRET=whsec_<controlled>
STRIPE_PRICE_ID_GUEST=price_<guest>
STRIPE_PRICE_ID_CAST=price_<cast>
```

- [ ] **Step 5: dogfood scenario 1 (Guest でサインアップ→trial→active)**

以下は memory reference `reference_local_e2e_run` に従って monolith + frontend + Stripe CLI forward を起動して手動で確認する:

```bash
# ターミナル 1
stripe listen --forward-to localhost:3001/billing/webhooks/stripe
```

以下 3 つを手動で確認 (該当画面が frontend に未実装なら gRPC call で直接叩く。frontend 統合は次フェーズ):

1. Guest test user (role=1) を作り、`CreateCheckoutSession` を呼ぶ → 返ってきた URL に browser で遷移
2. test card `4242 4242 4242 4242` で決済完了 → Stripe が webhook を送信 → monolith 側で `customer.subscription.created` が処理される
3. `GetMySubscription` を呼ぶ → `status = TRIALING` が返る
4. Stripe CLI: `stripe trigger customer.subscription.updated` (status=active に fixture 上変わるようなら active、そうでなければ Dashboard から手動で subscription を更新) → `GetMySubscription` で `ACTIVE` に遷移

- [ ] **Step 6: dogfood scenario 2 (Portal cancel)**

1. `CreateCustomerPortalSession` を呼び URL 取得 → browser 遷移
2. Portal で "Cancel subscription" (期末解約)
3. return_url に戻る
4. `GetMySubscription` を呼ぶ → `cancel_at_period_end = true`, status は変化なし (`ACTIVE`)

- [ ] **Step 7: dogfood scenario 3 (out-of-order defense)**

1. Stripe CLI: `stripe trigger customer.subscription.deleted` (現在の sub に対して発火する trigger は fixture で難しい場合、Dashboard で手動 cancel を実行)
2. その直後に `stripe trigger customer.subscription.updated`
3. `GetMySubscription` を呼ぶ → status は `CANCELED` のまま (updated で active に戻らないこと)

- [ ] **Step 8: dogfood scenario 4 (Cast plan)**

Cast test user (role=2) を作って scenario 1〜2 を繰り返す。price_id が cast plan を指すことを確認。

- [ ] **Step 9: gap があれば spec を追加して修正**

dogfood で見つかった不整合は「症状 → 原因 → 対応 spec」の順で追記し、対応 task を新設して修正。memory `feedback_dogfood_finds_unit_gaps` に従う。

- [ ] **Step 10: spec の Rollout Considerations に Dashboard 設定手順を反映**

`docs/superpowers/specs/2026-08-26-billing-slice-design.md` の Rollout Considerations に、Step 4 で実際に設定した項目 (trial 日数の実値、Portal の実 config など) を反映する。仕様と実運用の乖離を防ぐ。

- [ ] **Step 11: PR 更新 + Ready for review 化**

```bash
cd dystopia/monolith
git add docs/superpowers/specs/2026-08-26-billing-slice-design.md
git commit -s -m "docs(billing): reflect actual Stripe dashboard setup in rollout section"
git push
gh pr ready
```

Draft → Ready 化を Human に諮る (作業自動化ではなく、承認後に実行)。

---

## Self-Review Notes

以下を実装者が Task 19 実行前に必ず確認する:

1. **Spec の各節がタスクにマップされているか**:
   - §Architecture → Task 2 (proto), Task 4 (DB scaffolding), Task 16 (gRPC), Task 17 (webhook action)
   - §Data Model → Task 3 (migration), Task 5〜7 (repositories)
   - §Mirror Rule → Task 13, 14, 15 (use cases)
   - §Data Flows → Task 13, 14, 15
   - §Error Handling → Task 13〜17 の各 spec
   - §Testing → 各 task の TDD 内、Task 10 (FakeStripeClient), Task 19 (dogfood)
   - §Configuration → Task 1
   - §Rollout Considerations → Task 19

2. **型・名前の一貫性**:
   - `Billing::Repositories::CustomerRepository`, `SubscriptionRepository`, `StripeEventRepository`
   - `Billing::UseCases::{GetMySubscription, CreateCheckoutSession, CreateCustomerPortalSession, ProcessWebhookEvent}`
   - `Billing::Queries::ActiveSubscription`
   - `Billing::Adapters::StripeClient`
   - `Billing::Config::PlanRegistry`
   - `Billing::Grpc::{Handler, BillingHandler}`
   - `Billing::Actions::Webhooks::Stripe`
   - `Billing::Tasks::Reconcile`
   - `Spec::Billing::FakeStripeClient`

3. **未確定事項** (実装時に verify):
   - `Types::String` が Hanami settings で使えるか (Task 1)
   - relation 命名 (`customers` vs `customer_records`) — karte を verify (Task 5)
   - jsonb write の Sequel wrapper (Task 7)
   - `identity__users.role` の Cast 値 (Task 8 で 2 と仮定、identity slice で verify)
   - `Billing::Deps[]` が Hanami slice で auto-generate されるか (karte の書き方から yes と推測、Task 11 以降で verify)
   - `Billing::Action` base クラスの有無 (Task 17)
   - Hanami middleware chain が raw body を保持するか (Task 17 Step 5)
   - Stripe API version と `current_period_end` の位置 (Task 15)

4. **verify されるべき path** (実装時 sanity check):
   - `dystopia/monolith/lib/tasks/*.rake` が rake から自動で load される仕組み (existing account.rake の load path を確認)
   - `bin/grpc` の handler register 順序 (karte がどう入っているか)

これらは実装時に対応し、想定と異なれば該当 task 内で spec / 実装を調整する。
