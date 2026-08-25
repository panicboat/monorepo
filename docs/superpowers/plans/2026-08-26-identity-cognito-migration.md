# Identity Cognito Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自前 identity 実装を AWS Cognito User Pool に置き換え、認証責務を BFF に集約する。既存 identity データはクリーンスタート。

**Architecture:** BFF (Next.js API route) が Cognito 呼び出しの主体。monolith は `identity__accounts(id=sub, role, deactivated_at)` のみ保持し Cognito 非依存 (例外は purge cron の AdminDeleteUser 1 箇所)。BFF が Cognito access token を JWKS 検証 → `x-user-id` gRPC metadata に付与、monolith interceptor は `x-user-id` 経路のみに縮小。

**Tech Stack:** AWS Cognito User Pool / `@aws-sdk/client-cognito-identity-provider` (BFF) / `jose` (BFF JWKS) / `aws-sdk-cognitoidentityprovider` (monolith) / Terraform + Terragrunt

**Spec:** `docs/superpowers/specs/2026-08-26-identity-cognito-migration-design.md`

## Global Constraints

- **クリーンスタート**: 既存 dogfood データは全 DROP、Cognito 側にも import しない
- **不変**: admin 判断による Cognito Disable/AdminDeleteUser の経路を作らない。hard-delete trigger は本人退会 + 30 日 grace 経過 cron のみ
- **不変**: monolith は Cognito 非依存。例外は `Identity::UseCases::Account::PurgeDeactivatedAccounts` の AdminDeleteUser 呼び出し 1 箇所のみ
- **不変**: BFF は client に token を露出させない (httpOnly cookie 仲介継続)
- **BFF ↔ monolith gRPC 認証**: `x-user-id` metadata のみ。`Authorization: Bearer` は付与しない
- **account_id 型**: `identity__accounts.id` は string (Cognito sub uuid v4 を格納)。他 slice の `account_id` / `user_id` 型は変更しない
- **role 保管**: DB `identity__accounts.role` (int: 1=guest, 2=cast)。Cognito Groups / custom attribute は使わない
- **dev/test 環境**: `HANAMI_ENV=development|test` で `Cognito::FakeAdapter` (no-op)、`COGNITO_ADAPTER=fake` for BFF (in-memory + 固定 SMS code `000000`)
- **prod region**: `ap-northeast-1`
- **署名/verify hook**: git commit は `-s` 必須、`Co-Authored-By` 付与禁止 (AGENTS.md)
- **PR は Draft** で作成、conventional title を使う
- **rspec は `bundle exec rspec` で完走を成功条件とする** (memory: feedback_verify_by_running_tests / bundle_freeze_check)

---

## File Structure

### 新規作成

**Monolith**:
- `dystopia/monolith/config/db/migrate/2026XXXX_create_identity_accounts.rb` — 新 accounts テーブル
- `dystopia/monolith/slices/identity/relations/accounts.rb`
- `dystopia/monolith/slices/identity/repositories/account_repository.rb`
- `dystopia/monolith/slices/identity/use_cases/account/create_account.rb`
- `dystopia/monolith/slices/identity/use_cases/account/get_account.rb`
- `dystopia/monolith/slices/identity/use_cases/account/deactivate_account.rb`
- `dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb`
- `dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb`
- `dystopia/monolith/lib/cognito.rb`
- `dystopia/monolith/lib/cognito/adapter.rb`
- `dystopia/monolith/lib/cognito/fake_adapter.rb`
- `dystopia/monolith/lib/cognito/aws_adapter.rb`
- 上記全ての `*_spec.rb`

**Terraform**:
- `dystopia/frontend/aws/root.hcl`
- `dystopia/frontend/aws/modules/{terraform,variables,user_pool,sms_role,outputs}.tf`
- `dystopia/frontend/aws/envs/production/{env.hcl,terragrunt.hcl}`

**BFF**:
- `dystopia/frontend/src/lib/cognito/adapter.ts`
- `dystopia/frontend/src/lib/cognito/aws.ts`
- `dystopia/frontend/src/lib/cognito/fake.ts`
- `dystopia/frontend/src/lib/cognito/jwks.ts`
- `dystopia/frontend/src/app/api/identity/verify/route.ts` (verify-sms から改名)
- `dystopia/frontend/src/app/api/identity/forgot-password/route.ts` (reset-password 分割)
- `dystopia/frontend/src/app/api/identity/confirm-forgot-password/route.ts` (reset-password 分割)
- 上記関連の `*.test.ts`

### 修正

**Proto**:
- `proto/dystopia/identity/v1/service.proto` — RPC/message の削除・追加・改名 + `buf generate`

**Monolith**:
- `dystopia/monolith/slices/identity/grpc/handler.rb`
- `dystopia/monolith/slices/identity/presenters/account_presenter.rb`
- `dystopia/monolith/lib/interceptors/authentication_interceptor.rb`
- `dystopia/monolith/Gemfile`
- `dystopia/monolith/config/db/migrate/20260205000000_create_post_comments.rb:22` (FK 行削除)
- 7 slice の identity_user_repo → identity_account_repo リネーム対象:
  - `slices/post/adapters/user_adapter.rb` → `account_adapter.rb`
  - `slices/post/grpc/{like,comment,post}_handler.rb`
  - `slices/footprints/grpc/footprints_handler.rb`
  - `slices/discovery/grpc/discovery_handler.rb` + `use_cases/suggest_users.rb`
  - `slices/social/grpc/{block,follow}_handler.rb`
  - `slices/profile/grpc/profile_handler.rb` + `repositories/profile_repository.rb`
  - `slices/notifications/grpc/notification_handler.rb`
  - `slices/karte/use_cases/create_entry.rb`
- `dystopia/monolith/aws/modules/*.tf` — AdminDeleteUser IAM policy 追加

**BFF**:
- `dystopia/frontend/package.json` — deps 追加
- `dystopia/frontend/src/lib/request.ts` — buildGrpcHeaders 書き換え
- `dystopia/frontend/src/app/api/identity/sign-in/route.ts`
- `dystopia/frontend/src/app/api/identity/register/route.ts`
- `dystopia/frontend/src/app/api/identity/refresh-token/route.ts`
- `dystopia/frontend/src/app/api/identity/logout/route.ts`
- `dystopia/frontend/src/app/api/identity/me/route.ts`
- `dystopia/frontend/src/app/api/identity/deactivate/route.ts`
- `dystopia/frontend/src/app/signup/page.tsx` — 3 段 → 2 段
- `dystopia/frontend/src/modules/identity/hooks/useAuth` (相当ファイル、実装時に位置確認) — Cognito 移行後の API に合わせて書き換え

### 削除

**Monolith**:
- 8 migration: `20260114002209_create_users.rb`, `20260114003157_create_sms_verifications.rb`, `20260118000000_create_refresh_tokens.rb`, `20260227000001_unify_user_id.rb`, `20260626000000_add_consumed_at_and_failed_attempts_to_sms_verifications.rb`, `20260626000001_add_failed_login_attempts_and_locked_until_to_users.rb`, `20260626000002_rename_refresh_token_to_digest.rb`, `20260629000000_add_deactivated_at_to_users.rb`
- `slices/identity/contracts/auth/` (全)、`slices/identity/contracts/verification/` (全)
- `slices/identity/use_cases/auth/{login,register,logout,reset_password,deactivate_account}.rb`
- `slices/identity/use_cases/verification/` (全)
- `slices/identity/use_cases/token/` (全)
- `slices/identity/use_cases/user/{get_profile,purge_deactivated_accounts,purge_identity}.rb`
- `slices/identity/repositories/{refresh_token,sms_verification,user}_repository.rb`
- `slices/identity/relations/{refresh_tokens,sms_verifications,users}.rb`
- `slices/identity/presenters/auth_presenter.rb`
- `lib/auth/jwt_codec.rb`, `spec/support/jwt_keys.rb`
- `lib/sms.rb`, `lib/sms/{adapter,fake_adapter,sns_adapter}.rb`
- 上記の全 spec ファイル

**BFF**:
- `dystopia/frontend/src/app/api/identity/send-sms/route.ts`
- `dystopia/frontend/src/app/api/identity/verify-sms/route.ts` (verify に改名で対応、`git mv` 相当)
- `dystopia/frontend/src/app/api/identity/reset-password/route.ts` (2 endpoint 分割で対応)

---

## Task 1: Proto — identity service 書き換え

**Files:**
- Modify: `proto/dystopia/identity/v1/service.proto`
- Generated (via `buf generate`): monolith stubs + TypeScript client

**Interfaces:**
- Produces: RPC `GetAccount(GetAccountRequest{sub: string}) returns (Account)`, `CreateAccount(CreateAccountRequest{sub: string, role: Role}) returns (Account)`, `DeactivateAccount(DeactivateAccountRequest{}) returns (DeactivateAccountResponse{})`, `HealthCheck(HealthCheckRequest) returns (HealthCheckResponse)`。`Account{id: string, role: Role}` (phone_number 削除)。`Role` enum: `ROLE_UNSPECIFIED=0 / ROLE_GUEST=1 / ROLE_CAST=2` (現行そのまま)

- [ ] **Step 1: proto を書き換える**

```protobuf
syntax = "proto3";

package identity.v1;

service IdentityService {
  rpc HealthCheck (HealthCheckRequest) returns (HealthCheckResponse);
  rpc CreateAccount (CreateAccountRequest) returns (Account);
  rpc GetAccount (GetAccountRequest) returns (Account);
  rpc DeactivateAccount (DeactivateAccountRequest) returns (DeactivateAccountResponse);
}

message HealthCheckRequest {}
message HealthCheckResponse {
  string status = 1;
}

message CreateAccountRequest {
  string sub = 1;
  Role role = 2;
}

message GetAccountRequest {
  string sub = 1;
}

message DeactivateAccountRequest {}
message DeactivateAccountResponse {}

enum Role {
  ROLE_UNSPECIFIED = 0;
  ROLE_GUEST = 1;
  ROLE_CAST = 2;
}

message Account {
  string id = 1;
  Role role = 2;
}
```

- [ ] **Step 2: buf lint で構文検証**

Run: `cd proto && buf lint`
Expected: エラーなし

- [ ] **Step 3: `buf generate` でスタブ再生成**

Run: `cd proto && buf generate` (or repo root の `bin/codegen` があればそれを使う。実装者は `proto/README.md` を参照して確認)
Expected: monolith 側 (`dystopia/monolith/stubs/`) と frontend 側 (TypeScript client) のスタブが更新される

- [ ] **Step 4: 削除された RPC が呼び出し元に残っていないか grep**

Run: `git grep -nE "(SendSms|VerifySms|Register|Login|RefreshToken|Logout|ResetPassword|GetCurrentAccount)" -- 'dystopia/*'`
Expected: 呼び出し元 (BFF route / monolith handler / spec) にヒット。次以降のタスクで削除するので今は list を控えるだけ。ヒットが 0 になるのは Task 8/14-16 完了時点

- [ ] **Step 5: Commit**

```bash
git add proto/dystopia/identity/v1/service.proto
git add dystopia/monolith/stubs
# frontend の生成物パスは buf.gen.yaml による、実装時に git status で確認して add
git status
git commit -s -m "refactor(proto): shrink identity service to Cognito-compatible RPCs

自前 identity 実装を Cognito User Pool に置き換える設計に沿って、
identity service の RPC を account CRUD に絞る。
7 RPC (SendSms/VerifySms/Register/Login/RefreshToken/Logout/ResetPassword)
を削除、GetCurrentAccount を GetAccount(sub) に改名、CreateAccount(sub, role)
を新設。Account message から phone_number を削除。"
```

---

## Task 2: Monolith — identity 系 migration を DROP して新 accounts migration を作る

**Files:**
- Delete: `dystopia/monolith/config/db/migrate/20260114002209_create_users.rb`
- Delete: `dystopia/monolith/config/db/migrate/20260114003157_create_sms_verifications.rb`
- Delete: `dystopia/monolith/config/db/migrate/20260118000000_create_refresh_tokens.rb`
- Delete: `dystopia/monolith/config/db/migrate/20260227000001_unify_user_id.rb`
- Delete: `dystopia/monolith/config/db/migrate/20260626000000_add_consumed_at_and_failed_attempts_to_sms_verifications.rb`
- Delete: `dystopia/monolith/config/db/migrate/20260626000001_add_failed_login_attempts_and_locked_until_to_users.rb`
- Delete: `dystopia/monolith/config/db/migrate/20260626000002_rename_refresh_token_to_digest.rb`
- Delete: `dystopia/monolith/config/db/migrate/20260629000000_add_deactivated_at_to_users.rb`
- Create: `dystopia/monolith/config/db/migrate/<TIMESTAMP>_create_identity_accounts.rb` (TIMESTAMP = 現在時刻 UTC を `%Y%m%d%H%M%S`)
- Modify: `dystopia/monolith/config/db/migrate/20260205000000_create_post_comments.rb` (line 22 の FK 行削除)

**Interfaces:**
- Produces: table `identity__accounts` with columns `id: string PK` / `role: integer NOT NULL` / `deactivated_at: timestamptz NULL` / `created_at: timestamptz NOT NULL` / `updated_at: timestamptz NOT NULL`。partial index `deactivated_at IS NOT NULL`

- [ ] **Step 1: 既存 8 migration を削除**

```bash
cd dystopia/monolith
rm config/db/migrate/20260114002209_create_users.rb
rm config/db/migrate/20260114003157_create_sms_verifications.rb
rm config/db/migrate/20260118000000_create_refresh_tokens.rb
rm config/db/migrate/20260227000001_unify_user_id.rb
rm config/db/migrate/20260626000000_add_consumed_at_and_failed_attempts_to_sms_verifications.rb
rm config/db/migrate/20260626000001_add_failed_login_attempts_and_locked_until_to_users.rb
rm config/db/migrate/20260626000002_rename_refresh_token_to_digest.rb
rm config/db/migrate/20260629000000_add_deactivated_at_to_users.rb
```

- [ ] **Step 2: post_comments migration から identity への FK 行を削除**

`dystopia/monolith/config/db/migrate/20260205000000_create_post_comments.rb` の line 22 `foreign_key [:user_id], :"identity__users", on_delete: :cascade` を削除する。cascade 挙動は application 層 (Task 6 の PurgeIdentity で明示 DELETE) で担保。

- [ ] **Step 3: 新 migration ファイルを作成**

`dystopia/monolith/config/db/migrate/<TIMESTAMP>_create_identity_accounts.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"identity__accounts" do
      column :id,             String,      null: false
      column :role,           Integer,     null: false
      column :deactivated_at, DateTime,    null: true
      column :created_at,     DateTime,    null: false, default: Sequel.lit("now()")
      column :updated_at,     DateTime,    null: false, default: Sequel.lit("now()")

      primary_key [:id]
      index :deactivated_at, name: :idx_identity_accounts_deactivated_at,
            where: "deactivated_at IS NOT NULL"
    end
  end

  down do
    drop_table :"identity__accounts"
  end
end
```

- [ ] **Step 4: test DB を作り直して schema 検証**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rake db:drop db:create db:migrate`
Expected: 全 migration が通り、`identity__accounts` が作られ、旧 `identity__users` / `identity__sms_verifications` / `identity__refresh_tokens` は存在しない

- [ ] **Step 5: schema 確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec ruby -e "require 'sequel'; DB = Sequel.connect(ENV.fetch('DATABASE_URL')); puts DB.tables.grep(/identity/).inspect; puts DB.schema(:identity__accounts).inspect"`
Expected: `[:identity__accounts]` が表示され、schema に id/role/deactivated_at/created_at/updated_at が含まれる

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/config/db/migrate/
git commit -s -m "refactor(identity): destroy legacy identity tables, create identity__accounts

自前 identity テーブル 3 種 (users/sms_verifications/refresh_tokens) を
DROP し、Cognito sub を PK とする identity__accounts に置き換える。
post_comments から identity への cross-slice FK 行も削除
(application-level cascade は PurgeIdentity で担保)。"
```

---

## Task 3: Monolith — identity accounts relation + AccountRepository

**Files:**
- Delete: `dystopia/monolith/slices/identity/relations/users.rb`
- Delete: `dystopia/monolith/slices/identity/relations/refresh_tokens.rb`
- Delete: `dystopia/monolith/slices/identity/relations/sms_verifications.rb`
- Delete: `dystopia/monolith/slices/identity/repositories/user_repository.rb`
- Delete: `dystopia/monolith/slices/identity/repositories/refresh_token_repository.rb`
- Delete: `dystopia/monolith/slices/identity/repositories/sms_verification_repository.rb`
- Create: `dystopia/monolith/slices/identity/relations/accounts.rb`
- Create: `dystopia/monolith/slices/identity/repositories/account_repository.rb`
- Test: `dystopia/monolith/spec/slices/identity/relations/accounts_spec.rb`
- Test: `dystopia/monolith/spec/slices/identity/repositories/account_repository_spec.rb`
- Delete related specs: `spec/slices/identity/relations/{users,refresh_tokens,sms_verifications}_spec.rb`, `spec/slices/identity/repositories/{user,refresh_token,sms_verification}_repository_spec.rb`

**Interfaces:**
- Produces:
  - `Identity::Relations::Accounts` — schema of `identity__accounts`
  - `Identity::Repositories::AccountRepository`:
    - `#create(sub:, role:) → account` (raises `Sequel::UniqueConstraintViolation` on duplicate sub)
    - `#find_by_id(sub) → account | nil`
    - `#mark_deactivated(sub) → nil` (sets `deactivated_at = now()`)
    - `#reactivate(sub) → nil` (sets `deactivated_at = nil`)
    - `#delete(sub) → nil`
    - `#deactivated_before(cutoff) → Enumerator<account>` (for purge cron)
  - Account struct fields: `id / role / deactivated_at / created_at / updated_at`

- [ ] **Step 1: 削除対象ファイルを rm**

```bash
cd dystopia/monolith
rm slices/identity/relations/{users,refresh_tokens,sms_verifications}.rb
rm slices/identity/repositories/{user,refresh_token,sms_verification}_repository.rb
rm spec/slices/identity/relations/{users,refresh_tokens,sms_verifications}_spec.rb 2>/dev/null || true
rm spec/slices/identity/repositories/{user,refresh_token,sms_verification}_repository_spec.rb 2>/dev/null || true
```

- [ ] **Step 2: accounts_spec.rb を書く (failing test)**

`dystopia/monolith/spec/slices/identity/relations/accounts_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Identity::Relations::Accounts", type: :database do
  let(:relation) { Hanami.app.slices[:identity]["relations.accounts"] }

  it "maps to identity__accounts table" do
    expect(relation.name.dataset).to eq(:"identity__accounts")
  end

  it "defines the expected columns" do
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to contain_exactly(
      :id, :role, :deactivated_at, :created_at, :updated_at
    )
  end

  it "uses id as the primary key" do
    expect(relation.schema.primary_key_name).to eq(:id)
  end
end
```

- [ ] **Step 3: 走らせて fail 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/relations/accounts_spec.rb`
Expected: FAIL (Identity::Relations::Accounts not defined)

- [ ] **Step 4: accounts relation を実装**

`dystopia/monolith/slices/identity/relations/accounts.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module Relations
    class Accounts < Identity::DB::Relation
      schema(:"identity__accounts", as: :accounts, infer: false) do
        attribute :id,             Types::String
        attribute :role,           Types::Integer
        attribute :deactivated_at, Types::Time.optional
        attribute :created_at,     Types::Time
        attribute :updated_at,     Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 5: relation spec 通過確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/relations/accounts_spec.rb`
Expected: PASS

- [ ] **Step 6: repository spec を書く (failing test)**

`dystopia/monolith/spec/slices/identity/repositories/account_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::Repositories::AccountRepository, type: :database do
  let(:repo) { Hanami.app.slices[:identity]["repositories.account_repository"] }
  let(:sub) { "11111111-1111-1111-1111-111111111111" }

  describe "#create" do
    it "creates an account with the given sub and role" do
      account = repo.create(sub: sub, role: 1)
      expect(account.id).to eq(sub)
      expect(account.role).to eq(1)
      expect(account.deactivated_at).to be_nil
    end

    it "raises on duplicate sub" do
      repo.create(sub: sub, role: 1)
      expect { repo.create(sub: sub, role: 2) }.to raise_error(Sequel::UniqueConstraintViolation)
    end
  end

  describe "#find_by_id" do
    it "returns nil when the account does not exist" do
      expect(repo.find_by_id("nonexistent")).to be_nil
    end

    it "returns the account when it exists" do
      repo.create(sub: sub, role: 2)
      expect(repo.find_by_id(sub).role).to eq(2)
    end
  end

  describe "#mark_deactivated" do
    it "sets deactivated_at to now" do
      repo.create(sub: sub, role: 1)
      repo.mark_deactivated(sub)
      expect(repo.find_by_id(sub).deactivated_at).not_to be_nil
    end
  end

  describe "#reactivate" do
    it "clears deactivated_at" do
      repo.create(sub: sub, role: 1)
      repo.mark_deactivated(sub)
      repo.reactivate(sub)
      expect(repo.find_by_id(sub).deactivated_at).to be_nil
    end
  end

  describe "#delete" do
    it "removes the account row" do
      repo.create(sub: sub, role: 1)
      repo.delete(sub)
      expect(repo.find_by_id(sub)).to be_nil
    end
  end

  describe "#deactivated_before" do
    it "yields only accounts whose deactivated_at is older than cutoff" do
      old = "22222222-2222-2222-2222-222222222222"
      recent = "33333333-3333-3333-3333-333333333333"
      repo.create(sub: old, role: 1)
      repo.create(sub: recent, role: 1)
      repo.mark_deactivated(old)
      # Age the row by direct SQL
      repo.accounts.where(id: old).command(:update, result: :one).call(deactivated_at: Time.now - 60 * 60 * 24 * 31)
      repo.mark_deactivated(recent)

      cutoff = Time.now - 60 * 60 * 24 * 30
      ids = repo.deactivated_before(cutoff).map(&:id)
      expect(ids).to eq([old])
    end
  end
end
```

- [ ] **Step 7: 走らせて fail 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/repositories/account_repository_spec.rb`
Expected: FAIL (AccountRepository not defined)

- [ ] **Step 8: AccountRepository を実装**

`dystopia/monolith/slices/identity/repositories/account_repository.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module Repositories
    class AccountRepository < Identity::DB::Repo
      def create(sub:, role:)
        now = Time.now
        accounts.command(:create, result: :one).call(
          id: sub,
          role: role,
          created_at: now,
          updated_at: now
        )
      end

      def find_by_id(sub)
        accounts.by_pk(sub).one
      end

      def mark_deactivated(sub)
        accounts.by_pk(sub).command(:update, result: :one).call(
          deactivated_at: Time.now,
          updated_at: Time.now
        )
        nil
      end

      def reactivate(sub)
        accounts.by_pk(sub).command(:update, result: :one).call(
          deactivated_at: nil,
          updated_at: Time.now
        )
        nil
      end

      def delete(sub)
        accounts.by_pk(sub).command(:delete).call
        nil
      end

      def deactivated_before(cutoff)
        accounts.where { (deactivated_at !~ nil) & (deactivated_at < cutoff) }.each
      end
    end
  end
end
```

- [ ] **Step 9: repository spec 通過確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/repositories/account_repository_spec.rb`
Expected: PASS (全 7 example)

- [ ] **Step 10: Commit**

```bash
git add dystopia/monolith/slices/identity/relations dystopia/monolith/slices/identity/repositories dystopia/monolith/spec/slices/identity
git status
git commit -s -m "refactor(identity): replace users relation/repo with accounts

自前 identity の relations/repositories (users/refresh_tokens/
sms_verifications) を DROP し、Cognito sub を PK とする
Identity::Relations::Accounts + Identity::Repositories::AccountRepository
に置き換える。password_digest / lockout / phone-based lookup は削除、
find_by_id(sub) と本人退会向けの mark_deactivated/reactivate/delete、
purge cron 向けの deactivated_before(cutoff) を提供する。"
```

---

## Task 4: Monolith — identity account use_cases (CreateAccount / GetAccount / DeactivateAccount)

**Files:**
- Delete: `dystopia/monolith/slices/identity/use_cases/auth/{login,register,logout,reset_password,deactivate_account}.rb`
- Delete: `dystopia/monolith/slices/identity/use_cases/verification/{send_code,verify_code}.rb`
- Delete: `dystopia/monolith/slices/identity/use_cases/token/refresh.rb`
- Delete: `dystopia/monolith/slices/identity/use_cases/user/get_profile.rb`
- Delete: `dystopia/monolith/slices/identity/contracts/auth/` (全)
- Delete: `dystopia/monolith/slices/identity/contracts/verification/` (全)
- Delete: `dystopia/monolith/slices/identity/presenters/auth_presenter.rb`
- Delete: 対応する spec 群
- Create: `dystopia/monolith/slices/identity/use_cases/account/create_account.rb`
- Create: `dystopia/monolith/slices/identity/use_cases/account/get_account.rb`
- Create: `dystopia/monolith/slices/identity/use_cases/account/deactivate_account.rb`
- Test: `dystopia/monolith/spec/slices/identity/use_cases/account/{create_account,get_account,deactivate_account}_spec.rb`

**Interfaces:**
- Produces:
  - `Identity::UseCases::Account::CreateAccount#call(sub:, role:) → account` — Task 7 の grpc handler が呼ぶ
  - `Identity::UseCases::Account::GetAccount#call(sub:) → account | nil` — Task 7 で使う
  - `Identity::UseCases::Account::DeactivateAccount#call(sub:) → nil` — Task 7 で使う。DB soft delete のみ、Cognito 呼び出しなし

- [ ] **Step 1: 削除対象を rm**

```bash
cd dystopia/monolith
rm -r slices/identity/contracts/auth slices/identity/contracts/verification
rm slices/identity/use_cases/auth/{login,register,logout,reset_password,deactivate_account}.rb
rm -r slices/identity/use_cases/verification
rm -r slices/identity/use_cases/token
rm slices/identity/use_cases/user/get_profile.rb
rm slices/identity/presenters/auth_presenter.rb
rm -rf spec/slices/identity/use_cases/auth spec/slices/identity/use_cases/verification spec/slices/identity/use_cases/token
rm spec/slices/identity/use_cases/user/get_profile_spec.rb 2>/dev/null || true
rm spec/slices/identity/contracts 2>/dev/null || true
rm -rf spec/slices/identity/contracts
rm spec/slices/identity/presenters/auth_presenter_spec.rb 2>/dev/null || true
```

- [ ] **Step 2: create_account spec (failing)**

`dystopia/monolith/spec/slices/identity/use_cases/account/create_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::CreateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }
  let(:sub) { "sub-1" }

  describe "#call" do
    it "creates an account with the given sub and role" do
      account = double(:account, id: sub, role: 2)
      expect(repo).to receive(:create).with(sub: sub, role: 2).and_return(account)
      expect(use_case.call(sub: sub, role: 2)).to eq(account)
    end

    it "raises AccountAlreadyExists on duplicate sub" do
      allow(repo).to receive(:create).and_raise(Sequel::UniqueConstraintViolation)
      expect { use_case.call(sub: sub, role: 1) }.to raise_error(
        Identity::UseCases::Account::CreateAccount::AccountAlreadyExists
      )
    end
  end
end
```

- [ ] **Step 3: fail 確認 → 実装**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/create_account_spec.rb`
Expected: FAIL

`dystopia/monolith/slices/identity/use_cases/account/create_account.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class CreateAccount
        class AccountAlreadyExists < StandardError; end

        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:, role:)
          repo.create(sub: sub, role: role)
        rescue Sequel::UniqueConstraintViolation
          raise AccountAlreadyExists, "account already exists"
        end
      end
    end
  end
end
```

- [ ] **Step 4: pass 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/create_account_spec.rb`
Expected: PASS

- [ ] **Step 5: get_account spec (failing)**

`dystopia/monolith/spec/slices/identity/use_cases/account/get_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::GetAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }

  describe "#call" do
    it "returns the account when found" do
      account = double(:account, id: "sub-1", role: 1)
      allow(repo).to receive(:find_by_id).with("sub-1").and_return(account)
      expect(use_case.call(sub: "sub-1")).to eq(account)
    end

    it "returns nil when not found" do
      allow(repo).to receive(:find_by_id).with("missing").and_return(nil)
      expect(use_case.call(sub: "missing")).to be_nil
    end
  end
end
```

- [ ] **Step 6: fail 確認 → 実装**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/get_account_spec.rb`
Expected: FAIL

`dystopia/monolith/slices/identity/use_cases/account/get_account.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class GetAccount
        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:)
          repo.find_by_id(sub)
        end
      end
    end
  end
end
```

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/get_account_spec.rb`
Expected: PASS

- [ ] **Step 7: deactivate_account spec (failing)**

`dystopia/monolith/spec/slices/identity/use_cases/account/deactivate_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::DeactivateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }

  describe "#call" do
    it "marks the account as deactivated" do
      expect(repo).to receive(:mark_deactivated).with("sub-1")
      use_case.call(sub: "sub-1")
    end

    it "returns nil" do
      allow(repo).to receive(:mark_deactivated)
      expect(use_case.call(sub: "sub-1")).to be_nil
    end
  end
end
```

- [ ] **Step 8: fail 確認 → 実装**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/deactivate_account_spec.rb`
Expected: FAIL

`dystopia/monolith/slices/identity/use_cases/account/deactivate_account.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class DeactivateAccount
        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:)
          repo.mark_deactivated(sub)
          nil
        end
      end
    end
  end
end
```

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/deactivate_account_spec.rb`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add dystopia/monolith/slices/identity/use_cases dystopia/monolith/slices/identity/contracts dystopia/monolith/slices/identity/presenters
git add dystopia/monolith/spec/slices/identity
git status
git commit -s -m "refactor(identity): shrink use_cases to account CRUD

Cognito 移行で BFF に責務が移った auth (login/register/logout/reset_password),
verification (send_code/verify_code), token (refresh) の use_cases,
関連 contracts, auth_presenter を削除。account slice に
CreateAccount(sub, role) / GetAccount(sub) / DeactivateAccount(sub) を新設。"
```

---

## Task 5: Monolith — lib/cognito adapter (fake + aws)

**Files:**
- Create: `dystopia/monolith/lib/cognito.rb`
- Create: `dystopia/monolith/lib/cognito/adapter.rb`
- Create: `dystopia/monolith/lib/cognito/fake_adapter.rb`
- Create: `dystopia/monolith/lib/cognito/aws_adapter.rb`
- Test: `dystopia/monolith/spec/lib/cognito_spec.rb`
- Test: `dystopia/monolith/spec/lib/cognito/fake_adapter_spec.rb`
- Modify: `dystopia/monolith/Gemfile` (add `aws-sdk-cognitoidentityprovider`)

**Interfaces:**
- Produces:
  - `Cognito.admin_delete_user(sub:) → true | false` — Task 6 の PurgeDeactivatedAccounts が呼ぶ
  - `Cognito.adapter=` / `Cognito.reset!` — テスト用差し替え
  - Adapter contract: `#admin_delete_user(sub:)` を実装、未実装なら `NotImplementedError`
  - `Cognito::FakeAdapter` — `admin_delete_user` は log 出力のみで `true` を返す
  - `Cognito::AwsAdapter` — 実装時に `aws-sdk-cognitoidentityprovider` を lazy require、`Aws::CognitoIdentityProvider::Client#admin_delete_user` を呼び、`Aws::CognitoIdentityProvider::Errors::UserNotFoundException` は `true` (idempotent) として吸収

- [ ] **Step 1: Gemfile に aws-sdk-cognitoidentityprovider を追加**

`dystopia/monolith/Gemfile` の `aws-sdk-s3` 行の隣に:

```ruby
gem "aws-sdk-cognitoidentityprovider", "~> 1.0"
```

Run: `cd dystopia/monolith && bundle install`
Expected: エラーなし

- [ ] **Step 2: fake adapter spec (failing)**

`dystopia/monolith/spec/lib/cognito/fake_adapter_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "cognito/fake_adapter"

RSpec.describe Cognito::FakeAdapter do
  let(:adapter) { described_class.new }

  describe "#admin_delete_user" do
    it "returns true and does not raise for any sub" do
      expect { adapter.admin_delete_user(sub: "any-sub") }.not_to raise_error
      expect(adapter.admin_delete_user(sub: "any-sub")).to be(true)
    end
  end
end
```

Run: `cd dystopia/monolith && bundle exec rspec spec/lib/cognito/fake_adapter_spec.rb`
Expected: FAIL (Cognito::FakeAdapter not defined)

- [ ] **Step 3: adapter interface と fake 実装**

`dystopia/monolith/lib/cognito/adapter.rb`:

```ruby
# frozen_string_literal: true

module Cognito
  class Adapter
    def admin_delete_user(sub:)
      raise NotImplementedError
    end
  end
end
```

`dystopia/monolith/lib/cognito/fake_adapter.rb`:

```ruby
# frozen_string_literal: true

require_relative "adapter"

module Cognito
  class FakeAdapter < Adapter
    def admin_delete_user(sub:)
      warn "[cognito:fake] admin_delete_user(sub=#{sub})"
      true
    end
  end
end
```

Run: `cd dystopia/monolith && bundle exec rspec spec/lib/cognito/fake_adapter_spec.rb`
Expected: PASS

- [ ] **Step 4: aws adapter (test は integration 不要、shape だけ)**

`dystopia/monolith/lib/cognito/aws_adapter.rb`:

```ruby
# frozen_string_literal: true

require_relative "adapter"

module Cognito
  class AwsAdapter < Adapter
    def initialize(client: nil, user_pool_id: ENV.fetch("COGNITO_USER_POOL_ID"), region: ENV.fetch("COGNITO_REGION", "ap-northeast-1"))
      require "aws-sdk-cognitoidentityprovider"
      @client = client || Aws::CognitoIdentityProvider::Client.new(region: region)
      @user_pool_id = user_pool_id
    end

    def admin_delete_user(sub:)
      @client.admin_delete_user(user_pool_id: @user_pool_id, username: sub)
      true
    rescue Aws::CognitoIdentityProvider::Errors::UserNotFoundException
      # idempotent: already gone from Cognito is the desired end state
      true
    end
  end
end
```

- [ ] **Step 5: top-level Cognito module + adapter selection**

`dystopia/monolith/lib/cognito.rb`:

```ruby
# frozen_string_literal: true

require_relative "cognito/adapter"
require_relative "cognito/fake_adapter"

module Cognito
  class << self
    def adapter
      @adapter ||= default_adapter
    end

    def adapter=(adapter)
      @adapter = adapter
    end

    def reset!
      @adapter = nil
    end

    def admin_delete_user(sub:)
      adapter.admin_delete_user(sub: sub)
    end

    private

    def default_adapter
      env = ENV.fetch("HANAMI_ENV", "development")
      if env == "development" || env == "test"
        FakeAdapter.new
      else
        require_relative "cognito/aws_adapter"
        AwsAdapter.new
      end
    end
  end
end
```

- [ ] **Step 6: top-level spec (fake が default になること)**

`dystopia/monolith/spec/lib/cognito_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Cognito do
  before { described_class.reset! }
  after { described_class.reset! }

  describe ".adapter (default under HANAMI_ENV=test)" do
    it "returns a FakeAdapter" do
      expect(described_class.adapter).to be_a(Cognito::FakeAdapter)
    end
  end

  describe ".admin_delete_user" do
    it "delegates to the configured adapter" do
      fake = double(:adapter)
      expect(fake).to receive(:admin_delete_user).with(sub: "sub-1").and_return(true)
      described_class.adapter = fake
      described_class.admin_delete_user(sub: "sub-1")
    end
  end
end
```

Run: `cd dystopia/monolith && bundle exec rspec spec/lib/cognito_spec.rb spec/lib/cognito/fake_adapter_spec.rb`
Expected: PASS (両ファイル green)

- [ ] **Step 7: Commit**

```bash
git add dystopia/monolith/Gemfile dystopia/monolith/Gemfile.lock
git add dystopia/monolith/lib/cognito dystopia/monolith/lib/cognito.rb
git add dystopia/monolith/spec/lib/cognito dystopia/monolith/spec/lib/cognito_spec.rb
git status
git commit -s -m "feat(cognito): add Cognito adapter (fake + aws) module

lib/sms.rb と同じ shape の adapter pattern。公開 API は
Cognito.admin_delete_user(sub:) 1 メソッド。dev/test は FakeAdapter
(no-op)、production は AwsAdapter (aws-sdk-cognitoidentityprovider
経由) を HANAMI_ENV で自動選択。"
```

---

## Task 6: Monolith — PurgeDeactivatedAccounts + PurgeIdentity (application-level cascade + Cognito AdminDeleteUser)

**Files:**
- Delete: `dystopia/monolith/slices/identity/use_cases/user/purge_deactivated_accounts.rb`
- Delete: `dystopia/monolith/slices/identity/use_cases/user/purge_identity.rb`
- Create: `dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb`
- Create: `dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb`
- Test: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_deactivated_accounts_spec.rb`
- Test: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb`
- Delete related specs from `user/`

**Interfaces:**
- Consumes:
  - `Identity::Repositories::AccountRepository#deactivated_before(cutoff)` (Task 3)
  - `Identity::Repositories::AccountRepository#delete(sub)` (Task 3)
  - `Cognito.admin_delete_user(sub:)` (Task 5)
- Produces:
  - `Identity::UseCases::Account::PurgeDeactivatedAccounts#call → Integer` (削除件数)
  - `Identity::UseCases::Account::PurgeIdentity#call(sub:) → nil` (DB purge + Cognito AdminDeleteUser)
- Grace: `30` 日 (account-durability spec 継続)。Cognito AdminDeleteUser は `PurgeIdentity` の最後に呼ぶ (DB row 削除の前後どちらでも冪等)

- [ ] **Step 1: 旧 user/ use_cases を削除**

```bash
cd dystopia/monolith
rm slices/identity/use_cases/user/purge_deactivated_accounts.rb
rm slices/identity/use_cases/user/purge_identity.rb
rmdir slices/identity/use_cases/user 2>/dev/null || true
rm -rf spec/slices/identity/use_cases/user
```

- [ ] **Step 2: purge_identity spec (failing)**

`dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIdentity do
  let(:use_case) do
    described_class.new(
      account_repo: account_repo,
      cascades: cascades
    )
  end
  let(:account_repo) { double(:account_repository) }
  let(:cascades) { [double(:cascade_profile), double(:cascade_post_comments)] }
  let(:sub) { "sub-purge-1" }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    cascades.each { |c| allow(c).to receive(:call).with(sub: sub) }
    allow(account_repo).to receive(:delete).with(sub)
  end
  after { Cognito.reset! }

  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  it "calls each cascade with the sub" do
    cascades.each { |c| expect(c).to receive(:call).with(sub: sub) }
    use_case.call(sub: sub)
  end

  it "deletes the identity__accounts row" do
    expect(account_repo).to receive(:delete).with(sub)
    use_case.call(sub: sub)
  end

  it "calls Cognito.admin_delete_user(sub:)" do
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub)
    use_case.call(sub: sub)
  end
end
```

- [ ] **Step 3: 走らせて fail 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/purge_identity_spec.rb`
Expected: FAIL

- [ ] **Step 4: PurgeIdentity 実装**

`dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb`:

```ruby
# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      # 30 日 grace 経過後の hard-delete orchestrator。application-level cascade
      # で各 slice の PurgeAccount を呼び、identity__accounts と Cognito user を
      # 消す。cross-schema FK は張っていないため application 層で連鎖させる。
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        # cascades: array of PurgeAccount-style objects each responding to
        # #call(sub:). 現状は他 slice の PurgeAccount use_cases (profile / social /
        # post / karte / etc.) を deps に列挙して渡す形。account-durability
        # spec で導入済みの pattern を踏襲する。
        def initialize(cascades:, **kw)
          super(**kw)
          @cascades = cascades
        end

        def call(sub:)
          @cascades.each { |c| c.call(sub: sub) }
          account_repo.delete(sub)
          Cognito.admin_delete_user(sub: sub)
          nil
        end
      end
    end
  end
end
```

- [ ] **Step 5: pass 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/purge_identity_spec.rb`
Expected: PASS

- [ ] **Step 6: purge_deactivated_accounts spec (failing)**

`dystopia/monolith/spec/slices/identity/use_cases/account/purge_deactivated_accounts_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Account::PurgeDeactivatedAccounts do
  let(:use_case) do
    described_class.new(
      account_repo: account_repo,
      purge_identity: purge_identity
    )
  end
  let(:account_repo) { double(:account_repository) }
  let(:purge_identity) { double(:purge_identity) }

  describe "#call" do
    it "purges every account whose deactivated_at is older than 30 days" do
      old_a = double(:account, id: "sub-a")
      old_b = double(:account, id: "sub-b")
      allow(account_repo).to receive(:deactivated_before) do |cutoff|
        # cutoff should be roughly now - 30 days
        expect(cutoff).to be_within(60).of(Time.now - 60 * 60 * 24 * 30)
        [old_a, old_b].each
      end
      expect(purge_identity).to receive(:call).with(sub: "sub-a")
      expect(purge_identity).to receive(:call).with(sub: "sub-b")

      expect(use_case.call).to eq(2)
    end
  end
end
```

- [ ] **Step 7: 走らせて fail 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account/purge_deactivated_accounts_spec.rb`
Expected: FAIL

- [ ] **Step 8: PurgeDeactivatedAccounts 実装**

`dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      # cron が呼ぶ entry point。grace 経過 (deactivated_at < now - 30 日) の
      # 全アカウントを PurgeIdentity に投げる。
      class PurgeDeactivatedAccounts
        GRACE_SECONDS = 60 * 60 * 24 * 30

        include Identity::Deps[
          account_repo: "repositories.account_repository",
          purge_identity: "use_cases.account.purge_identity"
        ]

        def call
          cutoff = Time.now - GRACE_SECONDS
          count = 0
          account_repo.deactivated_before(cutoff).each do |account|
            purge_identity.call(sub: account.id)
            count += 1
          end
          count
        end
      end
    end
  end
end
```

- [ ] **Step 9: pass 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/use_cases/account`
Expected: PASS (Task 4 と Task 6 の全 spec)

- [ ] **Step 10: Commit**

```bash
git add dystopia/monolith/slices/identity/use_cases dystopia/monolith/spec/slices/identity/use_cases
git status
git commit -s -m "refactor(identity): move purge use_cases to account slice + wire Cognito AdminDeleteUser

PurgeDeactivatedAccounts (cron entry) と PurgeIdentity (per-sub hard-delete
orchestrator) を account/ に移し、application-level cascade は既存 pattern を
踏襲。PurgeIdentity の最後に Cognito.admin_delete_user(sub:) を呼び、
DB purge と同時に Cognito user を消して MAU 課金を抑える。"
```

---

## Task 7: Monolith — identity grpc handler / presenter を新 RPC 群に合わせる

**Files:**
- Modify: `dystopia/monolith/slices/identity/grpc/handler.rb`
- Modify: `dystopia/monolith/slices/identity/presenters/account_presenter.rb`
- Test: `dystopia/monolith/spec/slices/identity/grpc/handler_spec.rb`

**Interfaces:**
- Consumes:
  - `Identity::UseCases::Account::{CreateAccount, GetAccount, DeactivateAccount}` (Task 4)
  - `Current.user_id` (interceptor が設定、Task 8 で維持)
- Produces:
  - gRPC handler: `HealthCheck`, `CreateAccount`, `GetAccount`, `DeactivateAccount` の 4 endpoint (Task 1 の proto と一致)
  - `AccountPresenter.role_enum_to_int(enum) → Integer`, `AccountPresenter.role_int_to_enum(int) → symbol` は残す。`phone_number` 参照は削除

- [ ] **Step 1: handler_spec を書き直し (fail 前提)**

既存 `spec/slices/identity/grpc/handler_spec.rb` を Cognito 化に合わせて total rewrite。実装者は現行 spec を `git rm` してから以下を write:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::Grpc::Handler do
  let(:handler) { described_class.new }

  # Stub the resolved use_cases so we test the handler wiring, not the use_cases
  before do
    handler.instance_variable_set(:@create_account, create_account)
    handler.instance_variable_set(:@get_account, get_account)
    handler.instance_variable_set(:@deactivate_account, deactivate_account)
  end
  let(:create_account) { double(:create_account) }
  let(:get_account) { double(:get_account) }
  let(:deactivate_account) { double(:deactivate_account) }

  describe "#health_check" do
    it "returns status ok" do
      req = double(:req, message: nil)
      call = double(:call)
      response = handler.health_check(req, call)
      expect(response.status).to eq("ok")
    end
  end

  describe "#create_account" do
    it "creates an account and returns it as Account proto" do
      req = double(:req, message: double(:msg, sub: "sub-1", role: :ROLE_GUEST))
      account = double(:account, id: "sub-1", role: 1)
      expect(create_account).to receive(:call).with(sub: "sub-1", role: 1).and_return(account)
      response = handler.create_account(req, double(:call))
      expect(response.id).to eq("sub-1")
      expect(response.role).to eq(:ROLE_GUEST)
    end
  end

  describe "#get_account" do
    it "returns Account when found" do
      req = double(:req, message: double(:msg, sub: "sub-1"))
      account = double(:account, id: "sub-1", role: 2)
      allow(get_account).to receive(:call).with(sub: "sub-1").and_return(account)
      response = handler.get_account(req, double(:call))
      expect(response.role).to eq(:ROLE_CAST)
    end

    it "raises NOT_FOUND when missing" do
      req = double(:req, message: double(:msg, sub: "missing"))
      allow(get_account).to receive(:call).with(sub: "missing").and_return(nil)
      expect { handler.get_account(req, double(:call)) }.to raise_error(GRPC::NotFound)
    end
  end

  describe "#deactivate_account" do
    it "deactivates the current user's account" do
      allow(Current).to receive(:user_id).and_return("sub-1")
      expect(deactivate_account).to receive(:call).with(sub: "sub-1")
      response = handler.deactivate_account(double(:req), double(:call))
      expect(response).to be_a(Identity::V1::DeactivateAccountResponse)
    end
  end
end
```

- [ ] **Step 2: 走らせて fail 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/grpc/handler_spec.rb`
Expected: FAIL (handler が古い RPC 実装のまま)

- [ ] **Step 3: presenter を書き換え**

`dystopia/monolith/slices/identity/presenters/account_presenter.rb` を rewrite:

```ruby
# frozen_string_literal: true

module Identity
  module Presenters
    class AccountPresenter
      ROLE_ENUM_TO_INT = {
        ROLE_UNSPECIFIED: 0,
        ROLE_GUEST: 1,
        ROLE_CAST: 2
      }.freeze
      ROLE_INT_TO_ENUM = ROLE_ENUM_TO_INT.invert.freeze

      def self.role_enum_to_int(enum)
        ROLE_ENUM_TO_INT[enum]
      end

      def self.role_int_to_enum(int)
        ROLE_INT_TO_ENUM[int] || :ROLE_UNSPECIFIED
      end

      def self.to_proto(account)
        Identity::V1::Account.new(
          id: account.id,
          role: role_int_to_enum(account.role)
        )
      end
    end
  end
end
```

- [ ] **Step 4: handler を書き換え**

`dystopia/monolith/slices/identity/grpc/handler.rb` を rewrite:

```ruby
# frozen_string_literal: true

module Identity
  module Grpc
    class Handler
      include Identity::Deps[
        create_account: "use_cases.account.create_account",
        get_account: "use_cases.account.get_account",
        deactivate_account: "use_cases.account.deactivate_account"
      ]

      def health_check(_request, _call)
        Identity::V1::HealthCheckResponse.new(status: "ok")
      end

      def create_account(request, _call)
        role_int = Identity::Presenters::AccountPresenter.role_enum_to_int(request.message.role) || 1
        begin
          account = @create_account.call(sub: request.message.sub, role: role_int)
        rescue Identity::UseCases::Account::CreateAccount::AccountAlreadyExists
          raise GRPC::AlreadyExists.new("account already exists")
        end
        Identity::Presenters::AccountPresenter.to_proto(account)
      end

      def get_account(request, _call)
        account = @get_account.call(sub: request.message.sub)
        raise GRPC::NotFound.new("account not found") unless account
        Identity::Presenters::AccountPresenter.to_proto(account)
      end

      def deactivate_account(_request, _call)
        sub = Current.user_id
        raise GRPC::Unauthenticated.new("no current user") unless sub
        @deactivate_account.call(sub: sub)
        Identity::V1::DeactivateAccountResponse.new
      end
    end
  end
end
```

- [ ] **Step 5: pass 確認**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/identity/grpc/handler_spec.rb spec/slices/identity/presenters`
Expected: PASS

- [ ] **Step 6: bin/grpc に handler が登録されているか確認**

Run: `git grep -n "IdentityService\|Identity::Grpc::Handler" dystopia/monolith/bin`
Expected: `bin/grpc` に登録あり (memory: bin/grpc の Gruf 登録漏れが過去 gotcha)。無ければ登録を修正して commit する

- [ ] **Step 7: Commit**

```bash
git add dystopia/monolith/slices/identity/grpc dystopia/monolith/slices/identity/presenters dystopia/monolith/spec/slices/identity/grpc dystopia/monolith/spec/slices/identity/presenters
git status
git commit -s -m "refactor(identity): rewrite gRPC handler and presenter for account CRUD

新 proto (HealthCheck/CreateAccount/GetAccount/DeactivateAccount) に
handler を合わせる。旧 8 RPC の実装を削除、DeactivateAccount は
Current.user_id 経由で自身の sub だけを操作する。
AccountPresenter は phone_number 参照を削除、role enum↔int の変換ヘルパを維持。"
```

---

## Task 8: Monolith — interceptor 縮小 + JwtCodec / sms.rb / bcrypt / jwt 削除

**Files:**
- Modify: `dystopia/monolith/lib/interceptors/authentication_interceptor.rb`
- Delete: `dystopia/monolith/lib/auth/jwt_codec.rb`
- Delete: `dystopia/monolith/lib/sms.rb`
- Delete: `dystopia/monolith/lib/sms/adapter.rb`, `dystopia/monolith/lib/sms/fake_adapter.rb`, `dystopia/monolith/lib/sms/sns_adapter.rb`
- Delete: `dystopia/monolith/spec/support/jwt_keys.rb`
- Delete: `dystopia/monolith/spec/lib/auth/jwt_codec_spec.rb`
- Delete related SMS specs if any (`spec/lib/sms/**`)
- Modify: `dystopia/monolith/Gemfile` (remove `bcrypt`, `jwt`, `aws-sdk-sns`)
- Modify: `dystopia/monolith/spec/lib/interceptors/authentication_interceptor_spec.rb`

**Interfaces:**
- Produces: `Interceptors::AuthenticationInterceptor` は metadata `x-user-id` のみ読む。他は現行通り (`x-request-id` / `Current.user_id` / `Current.request_id` の生成)
- 削除される ENV: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, SMS 系 (`SMS_*`)

- [ ] **Step 1: bcrypt / jwt / aws-sdk-sns の他用途を grep**

Run: `git grep -nE "^require [\"']bcrypt|BCrypt\\.|::BCrypt|require [\"']jwt|JWT\\.|require [\"']aws-sdk-sns|Aws::SNS" dystopia/monolith`
Expected: 削除対象 (login/register/reset_password/refresh/jwt_codec/sns_adapter) と spec 群にしかヒットしないこと。それ以外にヒットする場合はここで対応方針を決めてから進む

- [ ] **Step 2: interceptor_spec を rewrite (failing)**

`dystopia/monolith/spec/lib/interceptors/authentication_interceptor_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "interceptors/authentication_interceptor"

RSpec.describe Interceptors::AuthenticationInterceptor do
  let(:interceptor) { described_class.new(request: request) }
  let(:request) { double(:request, metadata: metadata, context: {}) }
  let(:metadata) { {} }

  describe "#call" do
    context "when x-user-id metadata is present" do
      let(:metadata) { { "x-user-id" => "sub-1" } }

      it "sets Current.user_id to the metadata value" do
        interceptor.call { expect(Current.user_id).to eq("sub-1") }
      end
    end

    context "when x-user-id metadata is absent" do
      it "leaves Current.user_id nil" do
        interceptor.call { expect(Current.user_id).to be_nil }
      end
    end

    context "with an Authorization: Bearer header (legacy path)" do
      let(:metadata) { { "authorization" => "Bearer old-jwt" } }

      it "does NOT extract a user id from Bearer" do
        interceptor.call { expect(Current.user_id).to be_nil }
      end
    end

    it "propagates or generates a request id" do
      interceptor.call { expect(Current.request_id).not_to be_nil }
    end

    it "clears Current after the block" do
      interceptor.call {}
      expect(Current.user_id).to be_nil
      expect(Current.request_id).to be_nil
    end
  end
end
```

Run: `cd dystopia/monolith && bundle exec rspec spec/lib/interceptors/authentication_interceptor_spec.rb`
Expected: FAIL (現行 interceptor は Bearer 経路も走らせる)

- [ ] **Step 3: interceptor を書き換え**

`dystopia/monolith/lib/interceptors/authentication_interceptor.rb`:

```ruby
require 'gruf'
require 'securerandom'

module Interceptors
  class AuthenticationInterceptor < Gruf::Interceptors::ServerInterceptor
    def call
      ::Current.clear

      request_id = request.metadata['x-request-id'] || SecureRandom.uuid
      ::Current.request_id = request_id
      request.context[:request_id] = request_id

      if (uid = request.metadata['x-user-id'])
        request.context[:current_user_id] = uid
        ::Current.user_id = uid
      end

      yield
    ensure
      ::Current.clear
    end
  end
end
```

Run: `cd dystopia/monolith && bundle exec rspec spec/lib/interceptors/authentication_interceptor_spec.rb`
Expected: PASS

- [ ] **Step 4: JwtCodec / sms / jwt_keys 削除**

```bash
cd dystopia/monolith
rm -r lib/auth
rm lib/sms.rb
rm -r lib/sms
rm spec/support/jwt_keys.rb 2>/dev/null || true
rm spec/lib/auth/jwt_codec_spec.rb 2>/dev/null || true
rmdir spec/lib/auth 2>/dev/null || true
rm -rf spec/lib/sms
```

- [ ] **Step 5: Gemfile から bcrypt / jwt / aws-sdk-sns を削除**

`dystopia/monolith/Gemfile` から以下 3 行を削除:
- `gem "aws-sdk-sns", "~> 1.118"`
- `gem "jwt"`
- `gem "bcrypt"`

Run: `cd dystopia/monolith && bundle install`
Expected: Gemfile.lock 更新、エラーなし

- [ ] **Step 6: bundle install --frozen で締める (memory: bundle_freeze_check)**

Run: `cd dystopia/monolith && bundle install --frozen`
Expected: エラーなし

- [ ] **Step 7: 全 rspec を回す**

Run: `cd dystopia/monolith && bundle exec rspec`
Expected: 全 spec PASS。ここで他 slice の `identity_user_repo` 参照が残ってると fail するはず → Task 9 で対処

もし Task 9 未着手のため他 slice で fail するなら、Step 7 は Task 9 完了時に再実施として、この Task 8 では interceptor spec だけ PASS を成功条件とする。

- [ ] **Step 8: Commit**

```bash
git add dystopia/monolith/Gemfile dystopia/monolith/Gemfile.lock
git add dystopia/monolith/lib/interceptors dystopia/monolith/lib
git add dystopia/monolith/spec
git status
git commit -s -m "refactor(identity): remove self-hosted JWT/SMS/bcrypt, interceptor to x-user-id only

lib/auth/jwt_codec.rb (自前 RS256 JWT), lib/sms.rb + adapters
(自前 SMS 送信), 対応 spec + support ファイルを削除。Gemfile から
bcrypt/jwt/aws-sdk-sns を除去。authentication_interceptor は
Authorization: Bearer 経路を落とし x-user-id metadata のみ受け付ける
形に縮小 (BFF が JWKS 検証 → x-user-id 付与する経路と整合)。"
```

---

## Task 9: Monolith — 他 7 slice の identity_user_repo → identity_account_repo リネーム

**Files:**
- Rename: `dystopia/monolith/slices/post/adapters/user_adapter.rb` → `account_adapter.rb`
- Modify: `dystopia/monolith/slices/post/grpc/{like,comment,post}_handler.rb`
- Modify: `dystopia/monolith/slices/footprints/grpc/footprints_handler.rb`
- Modify: `dystopia/monolith/slices/discovery/grpc/discovery_handler.rb`
- Modify: `dystopia/monolith/slices/discovery/use_cases/suggest_users.rb`
- Modify: `dystopia/monolith/slices/social/grpc/block_handler.rb`
- Modify: `dystopia/monolith/slices/social/grpc/follow_handler.rb`
- Modify: `dystopia/monolith/slices/profile/grpc/profile_handler.rb`
- Modify: `dystopia/monolith/slices/profile/repositories/profile_repository.rb`
- Modify: `dystopia/monolith/slices/notifications/grpc/notification_handler.rb`
- Modify: `dystopia/monolith/slices/karte/use_cases/create_entry.rb`
- Modify: 上記全てに紐づく spec ファイル

**Interfaces:**
- Consumes: `Identity::Repositories::AccountRepository#find_by_id(sub) → account (id/role/deactivated_at/created_at/updated_at)` (Task 3)
- Produces: 他 slice の grpc / use_cases 契約は不変。内部の deps 名だけ `identity_user_repo` → `identity_account_repo`、method 呼び出しは `find_by_id(account_id)&.role` パターンそのまま流用可

- [ ] **Step 1: 全 slice の deps 依存名を洗い出す**

Run: `git grep -nE 'identity_user_repo|"repositories\\.user_repository"|slices\[:identity\]\\["repositories\\.user_repository"\]' dystopia/monolith`
Expected: 該当行の list。Task 9 で全て置換する

- [ ] **Step 2: user_adapter → account_adapter リネーム**

```bash
cd dystopia/monolith
git mv slices/post/adapters/user_adapter.rb slices/post/adapters/account_adapter.rb
git mv spec/slices/post/adapters/user_adapter_spec.rb spec/slices/post/adapters/account_adapter_spec.rb 2>/dev/null || true
```

ファイル内の module / class / method 名を対応リネーム:
- `Post::Adapters::UserAdapter` → `Post::Adapters::AccountAdapter`
- 中の `identity_user_repo` deps 名 → `identity_account_repo`
- `"repositories.user_repository"` → `"repositories.account_repository"`
- `user.role` → `account.role` (variable name のみ)、機能ロジックは不変

- [ ] **Step 3: 他 slice の deps 名を一括置換**

各 slice のファイル (Step 1 の grep 結果) で以下を置換:
- `identity_user_repo:` → `identity_account_repo:`
- `identity_user_repo.` → `identity_account_repo.`
- `"repositories.user_repository"` → `"repositories.account_repository"`
- `slices[:identity]["repositories.user_repository"]` → `slices[:identity]["repositories.account_repository"]`

spec 側も同じ置換を適用。

**注意** — memory `feedback_dogfood_finds_unit_gaps` の教訓: 「1 slice を fix したら **全 slice grep で sweep**」。karte で `target.role == 1` を残しているように、role 値の意味 (1=guest / 2=cast) は変えないこと。

- [ ] **Step 4: karte の import 参照 (Presenter 経由) を確認**

Run: `git grep -n "Identity::" dystopia/monolith/slices/karte`
Expected: karte が identity slice から直接 struct import していないこと (memory 教訓: 別 slice の struct は Presenter 経由)。もし直接 import がある場合は要相談

- [ ] **Step 5: 全 rspec 実行**

Run: `cd dystopia/monolith && bundle exec rspec`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith
git status
git commit -s -m "refactor: rename identity_user_repo -> identity_account_repo across slices

7 slice (post/footprints/discovery/social/profile/notifications/karte)
で identity slice への deps 参照名を account 版に付け替える。
find_by_id(account_id)&.role の呼び出しパターンとロジックは変更なし
(role: 1=guest, 2=cast の意味も継続)。post/adapters/user_adapter.rb は
account_adapter.rb に git mv。"
```

---

## Task 10: Terraform — dystopia/frontend/aws/ Cognito User Pool module

**Files:**
- Create: `dystopia/frontend/aws/root.hcl`
- Create: `dystopia/frontend/aws/modules/terraform.tf`
- Create: `dystopia/frontend/aws/modules/variables.tf`
- Create: `dystopia/frontend/aws/modules/user_pool.tf`
- Create: `dystopia/frontend/aws/modules/sms_role.tf`
- Create: `dystopia/frontend/aws/modules/outputs.tf`
- Create: `dystopia/frontend/aws/envs/production/env.hcl`
- Create: `dystopia/frontend/aws/envs/production/terragrunt.hcl`

**Interfaces:**
- Produces (Terraform outputs — Task 11 と BFF prod config で参照):
  - `user_pool_id: string`
  - `user_pool_arn: string`
  - `client_id: string`
  - `issuer: "https://cognito-idp.<region>.amazonaws.com/<user_pool_id>"`
  - `jwks_uri: "<issuer>/.well-known/jwks.json"`
- State key: `dystopia/frontend/production/terraform.tfstate`

- [ ] **Step 1: dystopia/frontend/aws/root.hcl を書く**

monolith の `dystopia/monolith/aws/root.hcl` を参考にコピーし、`local.project_name = "frontend"` に変更、state key を `dystopia/frontend/${local.environment}/terraform.tfstate` に。

- [ ] **Step 2: terraform.tf (provider 宣言)**

`dystopia/frontend/aws/modules/terraform.tf`:

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

- [ ] **Step 3: variables.tf**

`dystopia/frontend/aws/modules/variables.tf`:

```hcl
variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "environment" {
  type = string
}

variable "common_tags" {
  type    = map(string)
  default = {}
}

variable "user_pool_name" {
  type = string
}
```

- [ ] **Step 4: user_pool.tf**

`dystopia/frontend/aws/modules/user_pool.tf`:

```hcl
resource "aws_cognito_user_pool" "this" {
  name = var.user_pool_name

  alias_attributes = ["phone_number"]

  auto_verified_attributes = ["phone_number"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "phone_number"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  mfa_configuration = "OFF"

  sms_configuration {
    external_id    = "${var.user_pool_name}-cognito-sms"
    sns_caller_arn = aws_iam_role.cognito_sms.arn
    sns_region     = var.aws_region
  }

  # Guard against terraform destroy wiping the pool by accident.
  deletion_protection = "ACTIVE"

  tags = var.common_tags
}

resource "aws_cognito_user_pool_client" "bff" {
  name         = "${var.user_pool_name}-bff"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
```

- [ ] **Step 5: sms_role.tf**

`dystopia/frontend/aws/modules/sms_role.tf`:

```hcl
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "cognito_sms" {
  name = "${var.user_pool_name}-cognito-sms"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "cognito-idp.amazonaws.com" },
      Action    = "sts:AssumeRole",
      Condition = {
        StringEquals = {
          "sts:ExternalId" = "${var.user_pool_name}-cognito-sms"
        }
      }
    }]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy" "cognito_sms" {
  name = "${var.user_pool_name}-cognito-sms"
  role = aws_iam_role.cognito_sms.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["sns:Publish"],
      Resource = "*"
    }]
  })
}
```

- [ ] **Step 6: outputs.tf**

`dystopia/frontend/aws/modules/outputs.tf`:

```hcl
output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.bff.id
}

output "issuer" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "jwks_uri" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}/.well-known/jwks.json"
}
```

- [ ] **Step 7: envs/production**

`dystopia/frontend/aws/envs/production/env.hcl`:

```hcl
locals {
  environment = "production"
  aws_region  = "ap-northeast-1"
  additional_tags = {}
}
```

`dystopia/frontend/aws/envs/production/terragrunt.hcl`:

```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path   = "env.hcl"
  expose = true
}

terraform {
  source = "../../modules"
}

inputs = {
  aws_region     = include.env.locals.aws_region
  environment    = include.env.locals.environment
  user_pool_name = "dystopia-production"
  common_tags = merge(
    {
      Environment = include.env.locals.environment
    },
    include.env.locals.additional_tags
  )
}
```

- [ ] **Step 8: terraform / terragrunt validate**

Run: `cd dystopia/frontend/aws/envs/production && terragrunt hclvalidate && terragrunt init && terragrunt validate`
Expected: 全 pass。`terragrunt plan` は AWS 認証情報が必要なので実装者環境で任意

- [ ] **Step 9: Commit**

```bash
git add dystopia/frontend/aws
git commit -s -m "feat(cognito): add Cognito User Pool Terraform module

dystopia/frontend/aws/ を新設し、User Pool + BFF client + SNS SMS role
だけを Terragrunt で管理する。Lambda trigger / KMS key は使わない。
phone_number alias、USER_PASSWORD_AUTH + REFRESH_TOKEN_AUTH のみ
許可、Advanced Security OFF、Deletion Protection ACTIVE。
prod env 1 つのみ (dev/stg は BFF fake adapter)。"
```

---

## Task 11: Monolith — AdminDeleteUser IAM policy を追加

**Files:**
- Modify: `dystopia/monolith/aws/modules/main.tf` (or 適切な新 .tf ファイル分割) — IAM policy 追加、frontend の terraform_remote_state を読む dependency 追加
- Modify: `dystopia/monolith/aws/envs/production/terragrunt.hcl` — frontend の state を dependency として declare

**Interfaces:**
- Consumes: `dystopia/frontend/production/terraform.tfstate` の `user_pool_arn` output (Task 10)
- Produces: monolith pod IRSA (service account) に `cognito-idp:AdminDeleteUser` を User Pool ARN 限定で付与

- [ ] **Step 1: frontend の state を dependency に declare**

`dystopia/monolith/aws/envs/production/terragrunt.hcl` に:

```hcl
dependency "cognito" {
  config_path = "../../../frontend/aws/envs/production"

  mock_outputs = {
    user_pool_arn = "arn:aws:cognito-idp:ap-northeast-1:000000000000:userpool/mock"
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  # ... existing inputs ...
  cognito_user_pool_arn = dependency.cognito.outputs.user_pool_arn
}
```

- [ ] **Step 2: monolith module に IAM policy 追加**

`dystopia/monolith/aws/modules/main.tf` (or 新ファイル `cognito_iam.tf` を作って分割) に:

```hcl
variable "cognito_user_pool_arn" {
  type = string
}

resource "aws_iam_policy" "monolith_cognito_admin_delete" {
  name = "monolith-${var.environment}-cognito-admin-delete"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["cognito-idp:AdminDeleteUser"],
      Resource = var.cognito_user_pool_arn
    }]
  })

  tags = var.common_tags
}

# 既存の monolith pod IRSA role がある場合は attach する。無ければ
# 該当箇所を実装時に確認して追加。既存 aws-sdk-sns 用 attach を削除するのも同時に行う。
```

`dystopia/monolith/aws/modules/variables.tf` に `cognito_user_pool_arn` を追加。

- [ ] **Step 3: 旧 SNS SMS 権限の削除**

monolith の既存 IAM で `sns:Publish` を許可している policy があれば削除する (自前 SMS 送信削除に伴い不要)。

Run: `git grep -n "sns:Publish\|SNS.*Publish" dystopia/monolith/aws`
Expected: あればそのファイルから削除

- [ ] **Step 4: terragrunt validate**

Run: `cd dystopia/monolith/aws/envs/production && terragrunt hclvalidate && terragrunt init && terragrunt validate`
Expected: 全 pass (mock_outputs で dep 未 apply でも動く)

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/aws
git commit -s -m "feat(monolith): grant AdminDeleteUser on the Cognito user pool

monolith の Terraform module に User Pool ARN 限定の
cognito-idp:AdminDeleteUser policy を追加し、frontend/aws の state を
terragrunt dependency として declare。旧 SNS SMS 送信用の
sns:Publish 権限は削除。cron の PurgeDeactivatedAccounts が
Cognito user を消せるようにする。"
```

---

## Task 12: BFF — src/lib/cognito (adapter + aws + fake + jwks)

**Files:**
- Modify: `dystopia/frontend/package.json` (add `@aws-sdk/client-cognito-identity-provider`, `jose`)
- Create: `dystopia/frontend/src/lib/cognito/adapter.ts`
- Create: `dystopia/frontend/src/lib/cognito/aws.ts`
- Create: `dystopia/frontend/src/lib/cognito/fake.ts`
- Create: `dystopia/frontend/src/lib/cognito/jwks.ts`
- Test: `dystopia/frontend/src/lib/cognito/fake.test.ts`
- Test: `dystopia/frontend/src/lib/cognito/jwks.test.ts`

**Interfaces:**
- Produces:
  - `cognito: CognitoAdapter` (default export from `src/lib/cognito/adapter.ts`, env で AWS/fake 選択)
  - `CognitoAdapter` interface: `signUp(phone, password)`, `confirmSignUp(phone, code)`, `initiateAuth(phone, password)`, `refreshTokens(refreshToken)`, `globalSignOut(accessToken)`, `forgotPassword(phone)`, `confirmForgotPassword(phone, code, newPassword)`
  - `verifyAccessToken(token: string): Promise<{ sub: string }>` (from `src/lib/cognito/jwks.ts`) — JWKS 検証 (production) / fake 用 RSA 鍵検証 (dev)
- 動作条件: `process.env.COGNITO_ADAPTER === "aws"` なら AWS、それ以外は fake

- [ ] **Step 1: 依存追加**

```bash
cd dystopia/frontend
pnpm add @aws-sdk/client-cognito-identity-provider jose
```

Run: `pnpm install --frozen-lockfile`
Expected: 成功

- [ ] **Step 2: adapter interface を書く**

`dystopia/frontend/src/lib/cognito/adapter.ts`:

```typescript
export type Tokens = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
};

export type CognitoAdapter = {
  signUp(phone: string, password: string): Promise<{ userSub: string }>;
  confirmSignUp(phone: string, code: string): Promise<void>;
  initiateAuth(phone: string, password: string): Promise<Tokens>;
  refreshTokens(refreshToken: string): Promise<Pick<Tokens, "accessToken" | "idToken">>;
  globalSignOut(accessToken: string): Promise<void>;
  forgotPassword(phone: string): Promise<void>;
  confirmForgotPassword(phone: string, code: string, newPassword: string): Promise<void>;
};

let instance: CognitoAdapter | null = null;

export function cognito(): CognitoAdapter {
  if (instance) return instance;
  if (process.env.COGNITO_ADAPTER === "aws") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./aws") as { createAwsAdapter: () => CognitoAdapter };
    instance = mod.createAwsAdapter();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./fake") as { createFakeAdapter: () => CognitoAdapter };
    instance = mod.createFakeAdapter();
  }
  return instance;
}

// Testing helper
export function _resetCognitoInstance(): void {
  instance = null;
}
```

- [ ] **Step 3: fake adapter を書く (自前 RSA 署名で access token を発行)**

`dystopia/frontend/src/lib/cognito/fake.ts`:

```typescript
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { SignJWT, exportJWK } from "jose";
import { KEYUTIL, KJUR } from "jsrsasign";
import type { CognitoAdapter, Tokens } from "./adapter";

// Fake pool: shared across the whole dev process
type FakeUser = {
  sub: string;
  password: string;
  confirmed: boolean;
};

const users: Map<string, FakeUser> = new Map();
export const FAKE_CONFIRMATION_CODE = "000000";

// Deterministic RSA key so JWKS validation on the verify side stays stable
// across module reloads within the same process.
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

export async function fakeJwks(): Promise<{ keys: object[] }> {
  const jwk = await exportJWK(publicKey);
  return { keys: [{ ...jwk, kid: "fake-kid", alg: "RS256", use: "sig" }] };
}

async function signAccessToken(sub: string, expSeconds = 3600): Promise<string> {
  return await new SignJWT({ token_use: "access" })
    .setProtectedHeader({ alg: "RS256", kid: "fake-kid" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${expSeconds}s`)
    .setIssuer("fake-issuer")
    .sign(privateKey);
}

export function createFakeAdapter(): CognitoAdapter {
  return {
    async signUp(phone, password) {
      if (users.has(phone)) throw new Error("UsernameExistsException");
      const sub = randomUUID();
      users.set(phone, { sub, password, confirmed: false });
      return { userSub: sub };
    },
    async confirmSignUp(phone, code) {
      const u = users.get(phone);
      if (!u) throw new Error("UserNotFoundException");
      if (code !== FAKE_CONFIRMATION_CODE) throw new Error("CodeMismatchException");
      u.confirmed = true;
    },
    async initiateAuth(phone, password): Promise<Tokens> {
      const u = users.get(phone);
      if (!u) throw new Error("UserNotFoundException");
      if (!u.confirmed) throw new Error("UserNotConfirmedException");
      if (u.password !== password) throw new Error("NotAuthorizedException");
      const accessToken = await signAccessToken(u.sub);
      const idToken = await signAccessToken(u.sub); // fake: same
      return {
        accessToken,
        refreshToken: `fake-refresh:${u.sub}`,
        idToken
      };
    },
    async refreshTokens(refreshToken) {
      const sub = refreshToken.startsWith("fake-refresh:") ? refreshToken.slice("fake-refresh:".length) : null;
      if (!sub) throw new Error("NotAuthorizedException");
      const accessToken = await signAccessToken(sub);
      const idToken = await signAccessToken(sub);
      return { accessToken, idToken };
    },
    async globalSignOut() {
      // no-op in fake mode
    },
    async forgotPassword(phone) {
      if (!users.has(phone)) throw new Error("UserNotFoundException");
    },
    async confirmForgotPassword(phone, code, newPassword) {
      const u = users.get(phone);
      if (!u) throw new Error("UserNotFoundException");
      if (code !== FAKE_CONFIRMATION_CODE) throw new Error("CodeMismatchException");
      u.password = newPassword;
    }
  };
}

// Testing helper — reset the in-memory pool between test cases
export function _resetFakePool(): void {
  users.clear();
}
```

**注意**: `jsrsasign` は import から外して OK。実装時に `jose` の `exportJWK` だけあれば署名/検証は成立するので、上記の `jsrsasign` import 行は削除する。

- [ ] **Step 4: fake adapter test**

`dystopia/frontend/src/lib/cognito/fake.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "./fake";

describe("createFakeAdapter", () => {
  beforeEach(() => _resetFakePool());

  it("SignUp → ConfirmSignUp → InitiateAuth の flow が完走する", async () => {
    const adapter = createFakeAdapter();
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    expect(userSub).toMatch(/^[0-9a-f-]{36}$/);

    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);

    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");
    expect(tokens.accessToken).toMatch(/^eyJ/);
    expect(tokens.refreshToken).toMatch(/^fake-refresh:/);
  });

  it("未 confirm の user は InitiateAuth に失敗する", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");
    await expect(adapter.initiateAuth("+15551234567", "Passw0rd!")).rejects.toThrow(/UserNotConfirmed/);
  });

  it("誤 code は CodeMismatchException", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");
    await expect(adapter.confirmSignUp("+15551234567", "999999")).rejects.toThrow(/CodeMismatch/);
  });
});
```

Run: `cd dystopia/frontend && pnpm test src/lib/cognito/fake.test.ts`
Expected: 3 example PASS

- [ ] **Step 5: aws adapter を書く**

`dystopia/frontend/src/lib/cognito/aws.ts`:

```typescript
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AuthFlowType
} from "@aws-sdk/client-cognito-identity-provider";
import type { CognitoAdapter, Tokens } from "./adapter";

function client(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({
    region: process.env.COGNITO_REGION ?? "ap-northeast-1"
  });
}

const clientId = (): string => {
  const id = process.env.COGNITO_CLIENT_ID;
  if (!id) throw new Error("COGNITO_CLIENT_ID env is required");
  return id;
};

export function createAwsAdapter(): CognitoAdapter {
  return {
    async signUp(phone, password) {
      const c = client();
      const res = await c.send(new SignUpCommand({
        ClientId: clientId(),
        Username: phone,
        Password: password,
        UserAttributes: [{ Name: "phone_number", Value: phone }]
      }));
      if (!res.UserSub) throw new Error("Cognito SignUp returned no UserSub");
      return { userSub: res.UserSub };
    },
    async confirmSignUp(phone, code) {
      const c = client();
      await c.send(new ConfirmSignUpCommand({
        ClientId: clientId(),
        Username: phone,
        ConfirmationCode: code
      }));
    },
    async initiateAuth(phone, password): Promise<Tokens> {
      const c = client();
      const res = await c.send(new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: clientId(),
        AuthParameters: {
          USERNAME: phone,
          PASSWORD: password
        }
      }));
      const r = res.AuthenticationResult;
      if (!r?.AccessToken || !r.RefreshToken || !r.IdToken) {
        throw new Error("Cognito InitiateAuth returned no tokens");
      }
      return {
        accessToken: r.AccessToken,
        refreshToken: r.RefreshToken,
        idToken: r.IdToken
      };
    },
    async refreshTokens(refreshToken) {
      const c = client();
      const res = await c.send(new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: clientId(),
        AuthParameters: { REFRESH_TOKEN: refreshToken }
      }));
      const r = res.AuthenticationResult;
      if (!r?.AccessToken || !r.IdToken) throw new Error("Cognito refresh returned no tokens");
      return { accessToken: r.AccessToken, idToken: r.IdToken };
    },
    async globalSignOut(accessToken) {
      const c = client();
      await c.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
    },
    async forgotPassword(phone) {
      const c = client();
      await c.send(new ForgotPasswordCommand({ ClientId: clientId(), Username: phone }));
    },
    async confirmForgotPassword(phone, code, newPassword) {
      const c = client();
      await c.send(new ConfirmForgotPasswordCommand({
        ClientId: clientId(),
        Username: phone,
        ConfirmationCode: code,
        Password: newPassword
      }));
    }
  };
}
```

- [ ] **Step 6: JWKS 検証を書く**

`dystopia/frontend/src/lib/cognito/jwks.ts`:

```typescript
import { createRemoteJWKSet, jwtVerify, importJWK, type JWTPayload } from "jose";
import { fakeJwks } from "./fake";

async function localVerifier(token: string): Promise<{ sub: string }> {
  const jwks = await fakeJwks();
  const key = await importJWK(jwks.keys[0]);
  const { payload } = await jwtVerify(token, key, { issuer: "fake-issuer" });
  return extractSub(payload);
}

async function awsVerifier(token: string): Promise<{ sub: string }> {
  const region = process.env.COGNITO_REGION ?? "ap-northeast-1";
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error("COGNITO_USER_POOL_ID env is required");
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer });
  return extractSub(payload);
}

function extractSub(payload: JWTPayload): { sub: string } {
  if (typeof payload.sub !== "string") throw new Error("invalid token: no sub");
  return { sub: payload.sub };
}

export async function verifyAccessToken(token: string): Promise<{ sub: string }> {
  return process.env.COGNITO_ADAPTER === "aws" ? awsVerifier(token) : localVerifier(token);
}
```

- [ ] **Step 7: JWKS test (fake mode の signUp → initiateAuth のトークンが検証成功する)**

`dystopia/frontend/src/lib/cognito/jwks.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "./fake";
import { verifyAccessToken } from "./jwks";

describe("verifyAccessToken (fake mode)", () => {
  beforeEach(() => _resetFakePool());

  it("SignUp → ConfirmSignUp → InitiateAuth で得た access token が検証成功する", async () => {
    const adapter = createFakeAdapter();
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");

    const { sub } = await verifyAccessToken(tokens.accessToken);
    expect(sub).toBe(userSub);
  });

  it("不正な token は検証失敗する", async () => {
    await expect(verifyAccessToken("not.a.jwt")).rejects.toThrow();
  });
});
```

Run: `cd dystopia/frontend && pnpm test src/lib/cognito`
Expected: 全 PASS

- [ ] **Step 8: Commit**

```bash
git add dystopia/frontend/package.json dystopia/frontend/pnpm-lock.yaml
git add dystopia/frontend/src/lib/cognito
git status
git commit -s -m "feat(cognito): add BFF Cognito adapter (fake + aws) and JWKS verifier

CognitoAdapter interface に AWS SDK v3 実装と in-memory fake 実装。
fake は自前 RSA 鍵で access token を署名し、jose 経由の JWKS 検証も
同鍵で fake mode 用の verifier に切り替わる。SMS OTP は fake mode で
固定 code 000000 を受理する (dev/dogfood 用途)。
COGNITO_ADAPTER=aws のみ AWS SDK に接続、それ以外は fake がデフォルト。"
```

---

## Task 13: BFF — buildGrpcHeaders を JWKS 検証 + x-user-id に書き換え

**Files:**
- Modify: `dystopia/frontend/src/lib/request.ts`
- Test: `dystopia/frontend/src/lib/request.test.ts`

**Interfaces:**
- Consumes:
  - `verifyAccessToken(token) → { sub }` (Task 12)
  - Access token from `ACCESS_COOKIE` cookie (unchanged from `src/lib/auth/cookies.ts`)
- Produces:
  - `buildGrpcHeaders(req): Promise<Record<string, string>>` — returns `{ "X-Request-ID": ..., "x-user-id": <sub> }` when access token is present and valid; `{ "X-Request-ID": ... }` alone otherwise. `Authorization` は付与しない
  - Return type changes from `Record<string, string>` to `Promise<Record<string, string>>` — all callers must `await` it

**Note:** すべての identity 以外の route.ts (posts / karte / feed / ... 数十ファイル) が `buildGrpcHeaders(req)` を呼んでいる。戻り値が Promise になるので、この Task 内で全 caller を `await buildGrpcHeaders(req)` に書き換えるのが必須。

- [ ] **Step 1: 現行 caller を洗い出す**

Run: `git grep -n "buildGrpcHeaders" dystopia/frontend/src`
Expected: 全 route.ts の list。Task 13 内でこの全てを `await` に書き換える

- [ ] **Step 2: request_spec (failing)**

`dystopia/frontend/src/lib/request.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { buildGrpcHeaders } from "./request";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "./cognito/fake";
import { ACCESS_COOKIE } from "./auth/cookies";

describe("buildGrpcHeaders", () => {
  beforeEach(() => _resetFakePool());

  it("cookie が無ければ x-user-id を付けず X-Request-ID のみ返す", async () => {
    const req = new NextRequest("http://localhost/api/test", { method: "POST" });
    const headers = await buildGrpcHeaders(req);
    expect(headers["X-Request-ID"]).toBeDefined();
    expect(headers["x-user-id"]).toBeUndefined();
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("有効な cookie access token から sub を抽出して x-user-id に載せる", async () => {
    const adapter = createFakeAdapter();
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");

    const req = new NextRequest("http://localhost/api/test", { method: "POST" });
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
    const headers = await buildGrpcHeaders(req);

    expect(headers["x-user-id"]).toBe(userSub);
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("壊れた access token は x-user-id を付けない (401 判定は caller 側)", async () => {
    const req = new NextRequest("http://localhost/api/test", { method: "POST" });
    req.cookies.set(ACCESS_COOKIE, "not.a.jwt");
    const headers = await buildGrpcHeaders(req);
    expect(headers["x-user-id"]).toBeUndefined();
  });
});
```

Run: `cd dystopia/frontend && pnpm test src/lib/request.test.ts`
Expected: FAIL

- [ ] **Step 3: request.ts を書き換え**

`dystopia/frontend/src/lib/request.ts`:

```typescript
/**
 * Request utilities for consistent header handling across the application.
 *
 * BFF が Cognito access token を JWKS 検証し、sub を x-user-id gRPC
 * metadata に載せる。cookie は client には返さず、frontend は cookie の
 * 存在すら意識しない。
 */

import type { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export const HEADER_NAMES = {
  REQUEST_ID: "X-Request-ID",
  USER_ID: "x-user-id"
} as const;

export async function buildGrpcHeaders(req: NextRequest): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const requestId = req.headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
  headers[HEADER_NAMES.REQUEST_ID] = requestId;

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    try {
      const { sub } = await verifyAccessToken(accessToken);
      headers[HEADER_NAMES.USER_ID] = sub;
    } catch {
      // Token invalid: leave x-user-id off. downstream handler が 401 を返せば
      // client 側で refresh/logout 経路に流れる。
    }
  }

  return headers;
}

export function getOrCreateRequestId(headers: Headers): string {
  return headers.get(HEADER_NAMES.REQUEST_ID) || generateRequestId();
}
```

Run: `cd dystopia/frontend && pnpm test src/lib/request.test.ts`
Expected: PASS

- [ ] **Step 4: 全 caller を `await` に書き換え**

Step 1 で列挙した全 route.ts の `buildGrpcHeaders(req)` 呼び出しを `await buildGrpcHeaders(req)` に置換 (関数が async 済みならそのまま、そうでなければ async に変更)。

Run: `cd dystopia/frontend && pnpm typecheck` (or `pnpm build`)
Expected: 型エラーなし。await 忘れがあれば `Type 'Promise<...>' is not assignable to ...` エラーが出るので全部修正

- [ ] **Step 5: 全 test / build 確認**

Run: `cd dystopia/frontend && pnpm test && pnpm build`
Expected: 全 test PASS、build 成功

- [ ] **Step 6: Commit**

```bash
git add dystopia/frontend/src/lib/request.ts dystopia/frontend/src/lib/request.test.ts dystopia/frontend/src
git status
git commit -s -m "refactor(bff): verify access token JWKS and forward x-user-id, drop Authorization Bearer

buildGrpcHeaders を async に変え、cookie の access token を JWKS 検証
(fake/aws 両対応) してから sub を x-user-id gRPC metadata に載せる。
Authorization: Bearer <jwt> は monolith の interceptor 縮小と整合させて
一切付与しない。全 identity 系以外の route.ts caller を await 対応
に書き換え済み。"
```

---

## Task 14: BFF — sign-in route を Cognito 化

**Files:**
- Modify: `dystopia/frontend/src/app/api/identity/sign-in/route.ts`
- Test: `dystopia/frontend/src/app/api/identity/sign-in/route.test.ts`

**Interfaces:**
- Consumes:
  - `cognito()` (Task 12)
  - `verifyAccessToken` (Task 12)
  - `identityClient.getAccount({ sub })` (Task 1 の new RPC)
  - `identityClient.deactivateAccount({})` は使わない (deactivate route が担当)
  - `setAuthCookies` / `clearAuthCookies` from `src/lib/auth/cookies.ts`
- Produces:
  - `POST /api/identity/sign-in` — `{ phoneNumber, password, role }` を受け取り、Cognito `initiateAuth` → JWKS 検証 → `getAccount(sub)` → role 一致チェック → `deactivated_at` reactivate 判定 → cookie 発行 → `{ account: { id, role }, reactivated }` を返す。role 不一致は Cognito `globalSignOut` + `{ error: "電話番号または認証コードが正しくありません" }` + 401

- [ ] **Step 1: route.test を書く (failing)**

`dystopia/frontend/src/app/api/identity/sign-in/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "@/lib/cognito/fake";
import * as adapterMod from "@/lib/cognito/adapter";

// Mock identityClient — assumed to exist at @/lib/grpc
vi.mock("@/lib/grpc", () => ({
  identityClient: {
    getAccount: vi.fn(),
    createAccount: vi.fn(),
    deactivateAccount: vi.fn()
  }
}));

const identityMod = await import("@/lib/grpc");
const identity = identityMod.identityClient as unknown as {
  getAccount: ReturnType<typeof vi.fn>;
  createAccount: ReturnType<typeof vi.fn>;
  deactivateAccount: ReturnType<typeof vi.fn>;
};

describe("POST /api/identity/sign-in", () => {
  beforeEach(async () => {
    _resetFakePool();
    adapterMod._resetCognitoInstance();
    process.env.COGNITO_ADAPTER = "fake";
    const fake = createFakeAdapter();
    // Seed a confirmed user
    const { userSub } = await fake.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await fake.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    // Replace singleton with the same seeded fake so route.ts picks it up
    (adapterMod as unknown as { _setForTest: (a: unknown) => void })._setForTest?.(fake);
    identity.getAccount.mockReset();
    identity.deactivateAccount.mockReset();
    (globalThis as unknown as { __TEST_SEEDED_SUB__?: string }).__TEST_SEEDED_SUB__ = userSub;
  });

  it("role 一致 + アクティブアカウントは cookie 発行して 200 を返す", async () => {
    const sub = (globalThis as unknown as { __TEST_SEEDED_SUB__: string }).__TEST_SEEDED_SUB__;
    identity.getAccount.mockResolvedValue({ id: sub, role: 1, deactivatedAt: null });

    const req = new NextRequest("http://localhost/api/identity/sign-in", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!", role: 1 })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account.id).toBe(sub);
    expect(body.account.role).toBe(1);
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=/);
  });

  it("role 不一致は 401 を返し cookie を発行しない", async () => {
    const sub = (globalThis as unknown as { __TEST_SEEDED_SUB__: string }).__TEST_SEEDED_SUB__;
    identity.getAccount.mockResolvedValue({ id: sub, role: 1, deactivatedAt: null });

    const req = new NextRequest("http://localhost/api/identity/sign-in", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!", role: 2 })
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).not.toMatch(/access_token=/);
  });

  it("deactivated_at が設定済みなら reactivate してから login 成功", async () => {
    const sub = (globalThis as unknown as { __TEST_SEEDED_SUB__: string }).__TEST_SEEDED_SUB__;
    identity.getAccount.mockResolvedValue({ id: sub, role: 1, deactivatedAt: new Date().toISOString() });

    // reactivate 用の hypothetical RPC。無ければ実装時に決定。今は spec だけ書いて後で fix
    const req = new NextRequest("http://localhost/api/identity/sign-in", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!", role: 1 })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reactivated).toBe(true);
  });

  it("誤 password は 401 を返す", async () => {
    const req = new NextRequest("http://localhost/api/identity/sign-in", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "WrongPassword", role: 1 })
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

**Note (implementer)**: reactivate ケースは proto に対応 RPC が無い。Task 7 でも DeactivateAccount しか作っていない。**reactivate 用 RPC `ReactivateAccount(ReactivateAccountRequest{sub}) returns (Account)` を Task 1 の proto に追加し、Task 4 に対応 use_case `Identity::UseCases::Account::ReactivateAccount#call(sub:)` を追加する必要がある**。この plan 実行時、Task 1 と Task 4 に戻って追記する。

- [ ] **Step 2: proto に ReactivateAccount RPC を追加 (Task 1 追記)**

`proto/dystopia/identity/v1/service.proto` に:

```protobuf
service IdentityService {
  // ... 既存 ...
  rpc ReactivateAccount (ReactivateAccountRequest) returns (Account);
}

message ReactivateAccountRequest {
  string sub = 1;
}
```

Run: `cd proto && buf lint && buf generate`

- [ ] **Step 3: monolith 側に ReactivateAccount use_case + handler 追加 (Task 4 / Task 7 追記)**

`dystopia/monolith/slices/identity/use_cases/account/reactivate_account.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class ReactivateAccount
        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:)
          repo.reactivate(sub)
          repo.find_by_id(sub)
        end
      end
    end
  end
end
```

Spec:

```ruby
# frozen_string_literal: true
require "spec_helper"

RSpec.describe Identity::UseCases::Account::ReactivateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:account_repository) }
  it "clears deactivated_at and returns the account" do
    account = double(:account, id: "sub-1")
    expect(repo).to receive(:reactivate).with("sub-1")
    allow(repo).to receive(:find_by_id).with("sub-1").and_return(account)
    expect(use_case.call(sub: "sub-1")).to eq(account)
  end
end
```

`dystopia/monolith/slices/identity/grpc/handler.rb` に:

```ruby
include Identity::Deps[
  # ... 既存 ...
  reactivate_account: "use_cases.account.reactivate_account"
]

def reactivate_account(request, _call)
  account = @reactivate_account.call(sub: request.message.sub)
  Identity::Presenters::AccountPresenter.to_proto(account)
end
```

handler_spec に対応 example を追加。Run: `cd dystopia/monolith && bundle exec rspec`
Expected: PASS

- [ ] **Step 4: sign-in route.ts を実装**

`dystopia/frontend/src/app/api/identity/sign-in/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { setAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, password, role } = await req.json() as {
      phoneNumber: string;
      password: string;
      role: 1 | 2;
    };

    let tokens;
    try {
      tokens = await cognito().initiateAuth(phoneNumber, password);
    } catch {
      return NextResponse.json({ error: "電話番号または認証コードが正しくありません" }, { status: 401 });
    }

    const { sub } = await verifyAccessToken(tokens.accessToken);

    const account = await identityClient.getAccount({ sub }, { headers: await buildGrpcHeaders(req) });
    if (!account || account.role !== role) {
      await cognito().globalSignOut(tokens.accessToken).catch(() => {});
      return NextResponse.json({ error: "電話番号または認証コードが正しくありません" }, { status: 401 });
    }

    let reactivated = false;
    if (account.deactivatedAt) {
      await identityClient.reactivateAccount({ sub }, { headers: await buildGrpcHeaders(req) });
      reactivated = true;
    }

    const res = NextResponse.json({
      account: { id: account.id, role: account.role },
      reactivated
    });
    setAuthCookies(res, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    return res;
  } catch (error) {
    return handleApiError(error, "SignIn");
  }
}
```

- [ ] **Step 5: pass 確認**

Run: `cd dystopia/frontend && pnpm test src/app/api/identity/sign-in`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add proto dystopia/monolith dystopia/frontend/src/app/api/identity/sign-in dystopia/monolith/spec dystopia/frontend/src/app/api/identity/sign-in/route.test.ts
git status
git commit -s -m "feat(bff): rewrite sign-in with Cognito + role/deactivated_at check

Cognito InitiateAuth → JWKS 検証 → GetAccount(sub) で role 一致確認と
deactivated_at reactivate 判定。role 不一致は GlobalSignOut + 401 で
Cognito 側 session を確実に切る。副作用として proto に
ReactivateAccount(sub) を追加、monolith 側にも対応 use_case + handler
を追加した (reactivate は login 時のみ、admin 経路は作らない)。"
```

---

## Task 15: BFF — register + verify route (send-sms 削除、verify-sms → verify に改名)

**Files:**
- Delete: `dystopia/frontend/src/app/api/identity/send-sms/route.ts`
- Modify: `dystopia/frontend/src/app/api/identity/register/route.ts`
- `git mv`: `dystopia/frontend/src/app/api/identity/verify-sms/route.ts` → `dystopia/frontend/src/app/api/identity/verify/route.ts`
- Test: `dystopia/frontend/src/app/api/identity/register/route.test.ts`
- Test: `dystopia/frontend/src/app/api/identity/verify/route.test.ts`

**Interfaces:**
- Consumes: `cognito()`, `verifyAccessToken`, `identityClient.createAccount({ sub, role })`, `setAuthCookies`
- Produces:
  - `POST /api/identity/register` — payload `{ phoneNumber, password }`。`cognito().signUp(phone, password)` を呼び 200 だけ返す (cookie 未発行)
  - `POST /api/identity/verify` — payload `{ phoneNumber, code, password, role }`。`cognito().confirmSignUp(phone, code)` → `cognito().initiateAuth(phone, password)` → JWKS 検証 → sub 抽出 → `identityClient.createAccount({ sub, role })` → cookie 発行

- [ ] **Step 1: send-sms を削除**

```bash
cd dystopia/frontend
rm -r src/app/api/identity/send-sms
```

- [ ] **Step 2: verify-sms を verify に mv**

```bash
git mv src/app/api/identity/verify-sms src/app/api/identity/verify
```

- [ ] **Step 3: register route の test を書く (failing)**

`dystopia/frontend/src/app/api/identity/register/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { _resetFakePool } from "@/lib/cognito/fake";
import { _resetCognitoInstance } from "@/lib/cognito/adapter";

describe("POST /api/identity/register", () => {
  beforeEach(() => {
    _resetFakePool();
    _resetCognitoInstance();
    process.env.COGNITO_ADAPTER = "fake";
  });

  it("SignUp 成功時に 200 を返し cookie は発行しない", async () => {
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).not.toMatch(/access_token=/);
  });

  it("既存 phone_number は 409 を返す", async () => {
    const req1 = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" })
    });
    await POST(req1);
    const req2 = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "AnotherPass!" })
    });
    const res = await POST(req2);
    expect(res.status).toBe(409);
  });
});
```

Run: `pnpm test src/app/api/identity/register/route.test.ts`
Expected: FAIL

- [ ] **Step 4: register route.ts を書き換え**

`dystopia/frontend/src/app/api/identity/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, password } = await req.json() as {
      phoneNumber: string;
      password: string;
    };

    try {
      await cognito().signUp(phoneNumber, password);
    } catch (err) {
      if (err instanceof Error && /UsernameExistsException/.test(err.message)) {
        return NextResponse.json({ error: "この電話番号は既に登録されています" }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Register");
  }
}
```

Run: `pnpm test src/app/api/identity/register/route.test.ts`
Expected: PASS

- [ ] **Step 5: verify route の test を書く (failing)**

`dystopia/frontend/src/app/api/identity/verify/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { _resetFakePool, FAKE_CONFIRMATION_CODE, createFakeAdapter } from "@/lib/cognito/fake";
import { _resetCognitoInstance } from "@/lib/cognito/adapter";

vi.mock("@/lib/grpc", () => ({
  identityClient: {
    createAccount: vi.fn(),
    getAccount: vi.fn(),
    deactivateAccount: vi.fn(),
    reactivateAccount: vi.fn()
  }
}));

const { identityClient } = await import("@/lib/grpc");
const identity = identityClient as unknown as {
  createAccount: ReturnType<typeof vi.fn>;
};

describe("POST /api/identity/verify", () => {
  beforeEach(async () => {
    _resetFakePool();
    _resetCognitoInstance();
    process.env.COGNITO_ADAPTER = "fake";
    // Seed the fake pool via a SignUp so verify can Confirm
    const fake = createFakeAdapter();
    await fake.signUp("+15551234567", "Passw0rd!Passw0rd!");
    identity.createAccount.mockResolvedValue({ id: "will-be-cognito-sub", role: 1 });
  });

  it("code 正しい時に ConfirmSignUp + InitiateAuth + CreateAccount + cookie 発行", async () => {
    const { POST } = await import("./route");
    identity.createAccount.mockImplementation(async ({ sub, role }) => ({ id: sub, role }));

    const req = new NextRequest("http://localhost/api/identity/verify", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: "+15551234567",
        code: FAKE_CONFIRMATION_CODE,
        password: "Passw0rd!Passw0rd!",
        role: 1
      })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=/);
    expect(identity.createAccount).toHaveBeenCalledOnce();
  });

  it("code が誤りなら 400 を返し CreateAccount は呼ばない", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/identity/verify", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: "+15551234567",
        code: "999999",
        password: "Passw0rd!Passw0rd!",
        role: 1
      })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(identity.createAccount).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm test src/app/api/identity/verify/route.test.ts`
Expected: FAIL

- [ ] **Step 6: verify route.ts を書き換え**

`dystopia/frontend/src/app/api/identity/verify/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { setAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, code, password, role } = await req.json() as {
      phoneNumber: string;
      code: string;
      password: string;
      role: 1 | 2;
    };

    try {
      await cognito().confirmSignUp(phoneNumber, code);
    } catch (err) {
      if (err instanceof Error && /CodeMismatch|ExpiredCode/.test(err.message)) {
        return NextResponse.json({ error: "認証コードが正しくありません" }, { status: 400 });
      }
      throw err;
    }

    const tokens = await cognito().initiateAuth(phoneNumber, password);
    const { sub } = await verifyAccessToken(tokens.accessToken);

    await identityClient.createAccount({ sub, role }, { headers: await buildGrpcHeaders(req) });

    const res = NextResponse.json({ account: { id: sub, role } });
    setAuthCookies(res, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    return res;
  } catch (error) {
    return handleApiError(error, "Verify");
  }
}
```

Run: `pnpm test src/app/api/identity/register src/app/api/identity/verify`
Expected: 全 PASS

- [ ] **Step 7: Commit**

```bash
git add dystopia/frontend/src/app/api/identity
git status
git commit -s -m "feat(bff): rewrite register and verify routes for Cognito

register を SignUp のみ (SMS は Cognito が自動送信、cookie 未発行)、
verify (旧 verify-sms から改名) を ConfirmSignUp + InitiateAuth +
CreateAccount + cookie 発行の 1 flow に統合。send-sms route は
Cognito 側が担うため削除。verify request の payload に password と role
を含める (BFF server-side に平文 password を持たせない設計)。"
```

---

## Task 16: BFF — refresh-token / logout / me / deactivate route

**Files:**
- Modify: `dystopia/frontend/src/app/api/identity/refresh-token/route.ts`
- Modify: `dystopia/frontend/src/app/api/identity/logout/route.ts`
- Modify: `dystopia/frontend/src/app/api/identity/me/route.ts`
- Modify: `dystopia/frontend/src/app/api/identity/deactivate/route.ts`
- Test: 各 route の `route.test.ts`

**Interfaces:**
- Consumes: `cognito()`, `verifyAccessToken`, `identityClient.getAccount({ sub })`, `identityClient.deactivateAccount({})`, `setAuthCookies` / `clearAuthCookies` / `getRefreshCookie` / `getAccessCookie`

- [ ] **Step 1: refresh-token test + 実装**

`dystopia/frontend/src/app/api/identity/refresh-token/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import { _resetFakePool, createFakeAdapter, FAKE_CONFIRMATION_CODE } from "@/lib/cognito/fake";
import { _resetCognitoInstance } from "@/lib/cognito/adapter";

describe("POST /api/identity/refresh-token", () => {
  beforeEach(() => {
    _resetFakePool();
    _resetCognitoInstance();
    process.env.COGNITO_ADAPTER = "fake";
  });

  it("有効な refresh_token cookie で新 access_token cookie を返す", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!");

    const req = new NextRequest("http://localhost/api/identity/refresh-token", { method: "POST" });
    req.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=/);
  });

  it("refresh_token cookie 無しは 401 + cookie clear", async () => {
    const req = new NextRequest("http://localhost/api/identity/refresh-token", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

`dystopia/frontend/src/app/api/identity/refresh-token/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { getRefreshCookie, setAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshCookie(req);
    if (!refreshToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    let refreshed;
    try {
      refreshed = await cognito().refreshTokens(refreshToken);
    } catch {
      const res = NextResponse.json({ error: "ログインしてください" }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, { accessToken: refreshed.accessToken, refreshToken });
    return res;
  } catch (error) {
    return handleApiError(error, "RefreshToken");
  }
}
```

Run: `pnpm test src/app/api/identity/refresh-token`
Expected: 全 PASS

- [ ] **Step 2: logout test + 実装**

`dystopia/frontend/src/app/api/identity/logout/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { getAccessCookie, clearAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (accessToken) {
      await cognito().globalSignOut(accessToken).catch(() => {});
    }
    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    return res;
  } catch (error) {
    return handleApiError(error, "Logout");
  }
}
```

Test (簡易):

```typescript
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("POST /api/identity/logout", () => {
  it("cookie を clear して 200 を返す", async () => {
    const req = new NextRequest("http://localhost/api/identity/logout", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=;/);
  });
});
```

Run: `pnpm test src/app/api/identity/logout`
Expected: PASS

- [ ] **Step 3: me route test + 実装**

`dystopia/frontend/src/app/api/identity/me/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { getAccessCookie } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/cognito/jwks";

export async function GET(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (!accessToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }
    let sub;
    try {
      ({ sub } = await verifyAccessToken(accessToken));
    } catch {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }
    const account = await identityClient.getAccount({ sub }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ account: { id: account.id, role: account.role } });
  } catch (error) {
    return handleApiError(error, "Me");
  }
}
```

- [ ] **Step 4: deactivate route test + 実装**

`dystopia/frontend/src/app/api/identity/deactivate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { getAccessCookie, clearAuthCookies } from "@/lib/auth/cookies";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const accessToken = getAccessCookie(req);
    if (!accessToken) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    await identityClient.deactivateAccount({}, { headers: await buildGrpcHeaders(req) });
    await cognito().globalSignOut(accessToken).catch(() => {});

    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    return res;
  } catch (error) {
    return handleApiError(error, "Deactivate");
  }
}
```

- [ ] **Step 5: 全 test + build 確認**

Run: `cd dystopia/frontend && pnpm test src/app/api/identity && pnpm build`
Expected: 全 PASS + build 成功

- [ ] **Step 6: Commit**

```bash
git add dystopia/frontend/src/app/api/identity/{refresh-token,logout,me,deactivate}
git status
git commit -s -m "feat(bff): rewrite refresh-token, logout, me, deactivate routes for Cognito

refresh-token: cookie の refresh token で Cognito RefreshToken flow を回し
新 access token cookie を返す。
logout: GlobalSignOut + cookie clear。
me: cookie の access token を JWKS 検証して sub 抽出、GetAccount を返す。
deactivate: DeactivateAccount → GlobalSignOut + cookie clear
(soft delete のみ、Cognito 側 Delete/Disable は使わない)。"
```

---

## Task 17: BFF — reset-password 2 endpoint 分割

**Files:**
- Delete: `dystopia/frontend/src/app/api/identity/reset-password/route.ts`
- Create: `dystopia/frontend/src/app/api/identity/forgot-password/route.ts`
- Create: `dystopia/frontend/src/app/api/identity/confirm-forgot-password/route.ts`
- Test: 各 route の test

**Interfaces:**
- Produces:
  - `POST /api/identity/forgot-password` — `{ phoneNumber }` → `cognito().forgotPassword(phone)` → 200
  - `POST /api/identity/confirm-forgot-password` — `{ phoneNumber, code, newPassword }` → `cognito().confirmForgotPassword(...)` → 200

- [ ] **Step 1: 旧 route を削除**

```bash
cd dystopia/frontend
rm -r src/app/api/identity/reset-password
```

- [ ] **Step 2: forgot-password route + test**

`dystopia/frontend/src/app/api/identity/forgot-password/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber } = await req.json() as { phoneNumber: string };
    try {
      await cognito().forgotPassword(phoneNumber);
    } catch (err) {
      // prevent user enumeration: return 200 even if user does not exist
      if (err instanceof Error && /UserNotFoundException/.test(err.message)) {
        return NextResponse.json({ ok: true });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "ForgotPassword");
  }
}
```

`dystopia/frontend/src/app/api/identity/forgot-password/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { _resetFakePool, createFakeAdapter } from "@/lib/cognito/fake";
import { _resetCognitoInstance } from "@/lib/cognito/adapter";

describe("POST /api/identity/forgot-password", () => {
  beforeEach(async () => {
    _resetFakePool();
    _resetCognitoInstance();
    process.env.COGNITO_ADAPTER = "fake";
    const fake = createFakeAdapter();
    await fake.signUp("+15551234567", "Passw0rd!");
  });

  it("既存 phone で 200", async () => {
    const req = new NextRequest("http://localhost/api/identity/forgot-password", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567" })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("未存在 phone でも 200 (enumeration 対策)", async () => {
    const req = new NextRequest("http://localhost/api/identity/forgot-password", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+19999999999" })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: confirm-forgot-password route + test**

`dystopia/frontend/src/app/api/identity/confirm-forgot-password/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { cognito } from "@/lib/cognito/adapter";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, code, newPassword } = await req.json() as {
      phoneNumber: string;
      code: string;
      newPassword: string;
    };
    try {
      await cognito().confirmForgotPassword(phoneNumber, code, newPassword);
    } catch (err) {
      if (err instanceof Error && /CodeMismatch|ExpiredCode/.test(err.message)) {
        return NextResponse.json({ error: "認証コードが正しくありません" }, { status: 400 });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "ConfirmForgotPassword");
  }
}
```

- [ ] **Step 4: 全 test 確認**

Run: `cd dystopia/frontend && pnpm test src/app/api/identity`
Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/app/api/identity
git status
git commit -s -m "feat(bff): split reset-password into forgot / confirm-forgot endpoints

reset-password 単一 endpoint を Cognito 標準の 2-step に沿って分割:
- forgot-password: ForgotPassword を呼び SMS OTP を送る (未存在 phone
  でも 200 を返して user enumeration を防ぐ)。
- confirm-forgot-password: ConfirmForgotPassword で新パスワードを設定。"
```

---

## Task 18: Frontend UI — signup ページを 2 段化 + useAuth hook 更新

**Files:**
- Modify: `dystopia/frontend/src/app/signup/page.tsx`
- Modify: `dystopia/frontend/src/modules/identity/hooks/useAuth.*` (実装時に位置を確認)
- 実装時に確認する追加箇所: signup を呼び出している他 component、useAuth のシグネチャに依存している他 hook

**Interfaces:**
- Consumes: `POST /api/identity/register`, `POST /api/identity/verify`, `POST /api/identity/sign-in`
- Produces:
  - `useAuth` hook: `register(phone, password)` / `verify(phone, code, password, role)` / `signIn(phone, password, role)` / `signOut()` — 旧 `requestSMS` / `verifySMS` は削除

- [ ] **Step 1: useAuth hook の現状シグネチャを確認**

Run: `git grep -n "requestSMS\|verifySMS\|useAuth" dystopia/frontend/src`
Expected: 使い方の全 list

- [ ] **Step 2: useAuth hook を書き換え**

現行の `requestSMS(phone)` / `verifySMS(phone, code) → token` / `register(phone, password, token, role)` を、新 API に合わせて `register(phone, password) / verify(phone, code, password, role) / signIn(phone, password, role) / signOut()` に置き換える。verify 成功時に cookie が発行されて即 authenticated 状態になるので、`register` は「SMS 送信のみ完了、まだ login されていない」段階、`verify` が「login 完了」段階。

- [ ] **Step 3: signup/page.tsx を 2 段化**

Step type を `Step = "credentials" | "code"` に変え、`credentials` step で phone + password + role を入力、`code` step で SMS code を入力して verify を呼ぶ。verify 成功時に home にリダイレクト。

`dystopia/frontend/src/app/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Step = "credentials" | "code";

export default function SignupPage() {
  const { register, verify } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(phone, password);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verify(phone, code, password, role);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "認証コードの検証に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <h1 className="text-2xl font-semibold">新規登録</h1>
      {error && <p className="text-red-600">{error}</p>}

      {step === "credentials" && (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <label className="block">
            <span>電話番号</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="block">
            <span>パスワード</span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <fieldset className="space-y-2">
            <legend>役割</legend>
            <label className="flex items-center gap-2">
              <input type="radio" checked={role === 1} onChange={() => setRole(1)} /> ゲスト
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={role === 2} onChange={() => setRole(2)} /> キャスト
            </label>
          </fieldset>
          <Button type="submit" disabled={submitting}>SMS を送信</Button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <p>登録した電話番号に届いた 6 桁のコードを入力してください。</p>
          <label className="block">
            <span>認証コード</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <Button type="submit" disabled={submitting}>登録を完了</Button>
        </form>
      )}

      <p>既にアカウントをお持ちですか？ <Link href="/login">ログイン</Link></p>
    </main>
  );
}
```

- [ ] **Step 4: browser で手動確認 (dev server)**

Run: `cd dystopia/frontend && pnpm dev` → browser で `/signup` を開き 2 段 flow を実行
Expected: fake mode で phone+password+role を入力 → SMS code (固定 `000000`) を入力 → home にリダイレクトされて login 済み状態

- [ ] **Step 5: pnpm build 確認**

Run: `cd dystopia/frontend && pnpm build && pnpm lint`
Expected: build 成功、lint pass

- [ ] **Step 6: Commit**

```bash
git add dystopia/frontend/src/app/signup dystopia/frontend/src/modules/identity/hooks
git status
git commit -s -m "feat(ui): shrink signup flow to 2 steps aligned with Cognito

現行 3 段 (phone → SMS → password/details) を 2 段に統合:
- credentials: phone + password + role を一括入力し register を呼ぶ
  (Cognito が SMS を自動送信)
- code: SMS OTP を入力し verify を呼び (ConfirmSignUp + InitiateAuth +
  CreateAccount + cookie 発行の 1 flow)、home にリダイレクト。
useAuth hook のシグネチャも新 API (register/verify/signIn/signOut) に統一、
旧 requestSMS/verifySMS は削除。"
```

---

## Task 19: Local e2e dogfood 検証 + doc 更新

**Files:**
- Modify: `docs/superpowers/2026-06-XX-local-e2e-run.md` (or reference memory の該当 doc、実装時に位置確認)

**Interfaces:**
- Consumes: 全前 Task で構築された monolith + frontend + fake Cognito adapter
- Produces: dogfood 手順 doc の更新版 (JWT 鍵準備削除、SMS 固定 code 明記、signup UI 2 段対応)

- [ ] **Step 1: local dogfood 手順を実行**

memory `reference_local_e2e_run` の手順を Cognito 版に読み替えて実行:
1. monolith を起動 (`HANAMI_ENV=development bundle exec bin/grpc`)
2. frontend を起動 (`COGNITO_ADAPTER=fake pnpm dev`)
3. puppeteer-core で `/signup` を開き 2 段 flow を通す (SMS code = `000000`)
4. login / karte / follow / message / bookmark / footprints などを回す
5. logout → login (reactivate 経路は次)
6. deactivate → 一度 logout 状態
7. DB で `identity__accounts.deactivated_at = now() - interval '31 days'` を手動 UPDATE
8. `bundle exec rake account:purge_deactivated` を実行 → row 消失 + fake adapter の log 確認
9. 全 slice の spec で `bundle exec rspec` が green
10. `pnpm test && pnpm build` が green

Expected: 全 flow が期待通り。壊れた slice があればここで発見、Task 内で修正する

- [ ] **Step 2: local e2e run doc を更新**

memory の指す doc を Cognito 版に更新 (JWT 秘密鍵準備を削除、SMS adapter fake → Cognito fake adapter (`COGNITO_ADAPTER=fake`, code = `000000`)、signup UI 2 段対応)。

- [ ] **Step 3: Commit + Draft PR**

```bash
git add docs
git status
git commit -s -m "docs: update local e2e run for Cognito migration"
git push -u origin HEAD
gh pr create --draft --title "feat(identity): migrate to AWS Cognito User Pool" --body "See docs/superpowers/specs/2026-08-26-identity-cognito-migration-design.md and docs/superpowers/plans/2026-08-26-identity-cognito-migration.md."
```

---

## Task 20: Prod cutover runbook (手動 / user 同席)

**Files:** documentation only (実装対象なし。runbook は memory + PR description に残す)

**Interfaces:**
- Consumes: Terraform + BFF/monolith image がすべて main にマージ済みの状態
- Produces: prod Cognito User Pool 稼働 + 全 dogfood データ再構築 + 新 image デプロイ完了

**Warning**: この Task は user 同席で実行する。データ損失 (dogfood データ全消) が発生するため、subagent が独断で走らせない。

- [ ] **Step 1: pre-cutover checklist**

- [ ] PR merged to main
- [ ] Frontend AWS 用の `dystopia/frontend/aws/envs/production` に AWS 認証情報が通っている
- [ ] Monolith AWS 用の同認証情報で `terragrunt plan` が期待通り出る (旧 SNS 権限削除 + AdminDeleteUser 追加)
- [ ] Kubernetes Secrets update の権限がある
- [ ] Prod DB への直接接続 (psql) 権限がある

- [ ] **Step 2: Terraform apply (frontend/aws)**

Run: `cd dystopia/frontend/aws/envs/production && terragrunt apply`
Expected: User Pool + Client + SMS role が作成され、outputs (user_pool_id / client_id / user_pool_arn / issuer / jwks_uri) を取得

- [ ] **Step 3: Kubernetes Secrets に Cognito 設定を反映**

Manual: BFF pod の env に `COGNITO_ADAPTER=aws`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION=ap-northeast-1` を注入 (Kubernetes Secret 経由、ESO パターンが既存なら踏襲)。

- [ ] **Step 4: Terraform apply (monolith/aws)**

Run: `cd dystopia/monolith/aws/envs/production && terragrunt apply`
Expected: monolith pod IRSA に AdminDeleteUser 権限、旧 SNS 権限が削除される。`COGNITO_USER_POOL_ID` / `COGNITO_REGION` env を monolith pod に注入

- [ ] **Step 5: Prod DB destroy + recreate**

**警告: データ損失。user 承認後に実行。**

```bash
# 1. スナップショット (safety net、後述の No negative legacy 方針で
#    使わない前提だが取る)
aws rds create-db-snapshot --db-instance-identifier monolith-production --db-snapshot-identifier pre-cognito-migration

# 2. DROP + CREATE (実装時に運用者の許可を得てから実行)
psql -h <prod-endpoint> -U postgres -c "DROP DATABASE monolith;"
psql -h <prod-endpoint> -U postgres -c "CREATE DATABASE monolith;"

# 3. Migrate
kubectl exec -it deploy/monolith -- bundle exec rake db:migrate
```

Expected: `identity__accounts` + 他 slice の空 table が存在する。旧 `identity__users` は無い

- [ ] **Step 6: Deploy 新 image**

新 BFF + monolith image を prod に deploy (既存 CI/CD flow)

- [ ] **Step 7: Smoke test**

Manual: prod frontend で
1. `/signup` で 1 件アカウント作成 (実 SMS 受信可能な番号で)
2. logout → `/login` で再ログイン
3. `/settings/deactivate` (or 対応 UI) で退会
4. `/login` で再ログイン → auto-reactivate

Expected: 全成功。fail した場合は原因を切り分け (JWKS 到達 / IAM / Cognito client_id 不整合 等)

---

## Self-Review

**Spec coverage**:
- Section A (AWS Cognito User Pool) → Task 10
- Section B (DB schema) → Task 2, Task 3
- Section C (Monolith proto/slice/lib/Gemfile/ENV/IAM/他 slice) → Task 1, 3, 4, 5, 6, 7, 8, 9, 11
- Section D (BFF cognito/route/UI) → Task 12, 13, 14, 15, 16, 17, 18
- Section E (Test 戦略) → 各 Task の Step 内で TDD、Task 19 で dogfood
- Section F (dev/dogfood 環境) → Task 12 (fake adapter), Task 19 (doc update)
- Section G (移行手順) → Task 20 (prod runbook)

**Placeholder scan**: `TBD` / `TODO` を残していない。`2026XXXX_` は migration timestamp 生成時に確定する意図的 placeholder。`docs/superpowers/2026-06-XX-local-e2e-run.md` は memory の指す doc の位置確認を「実装時」に委ねている (Task 19 Step 2 で明示)。

**Type consistency**:
- `Cognito.admin_delete_user(sub:)` (Task 5) が Task 6 で呼ばれる — 一致
- `AccountRepository#{find_by_id, mark_deactivated, reactivate, delete, deactivated_before}` (Task 3) が Task 4/6/7 で呼ばれる — 一致
- `Identity::UseCases::Account::{CreateAccount, GetAccount, DeactivateAccount, ReactivateAccount, PurgeIdentity, PurgeDeactivatedAccounts}` (Task 4, 6, 14 追記) が Task 7 handler で使用 — 一致
- `verifyAccessToken(token)` (Task 12) が Task 13, 14, 16 で使用 — 一致
- `cognito()` factory (Task 12) が Task 14, 15, 16, 17 で使用 — 一致
- proto `ReactivateAccount` 追加 (Task 14 で追記) → Task 7 handler にも追加 → Task 4 use_case 追加。plan では Task 14 内でまとめて処理。

**追記事項** (self-review で気付いた点):
- Task 14 内で proto と monolith 両方を修正する必要があり、独立 task にすると review checkpoint が増えるので Task 14 に折り込む形とした
- Task 19 は full-stack dogfood タスクで long-running。実行時は memory `feedback_dogfood_finds_unit_gaps` の教訓 (1 slice fix したら全 slice grep で sweep) を守る

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-26-identity-cognito-migration.md`.

Per CLAUDE.md Plan Execution rule, ユーザーに実行方式を選んでもらう:

1. **codex-driven-development** (herdr session 前提、Codex に implementer を委譲)
2. **subagent-driven-development** (Claude subagent で並列実行)
3. **executing-plans** (このセッションでインライン実行)

どれで進めるか教えてください。
