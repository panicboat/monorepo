# Identity Cognito Migration Design

Date: 2026-08-26
Status: Design spec (implementation-ready)
Scope: 現行の自前 identity 実装 (`identity__users` / SMS 検証 / 自前 JWT / bcrypt / brute-force lockout / refresh token 管理) を **AWS Cognito User Pool** に置き換える。認証責務を BFF に集約し、monolith は Cognito 非依存の業務ドメインに集中させる。既存 identity データはクリーンスタート (No negative legacy 方針)。

由来: 自前 identity 実装 (`docs/superpowers/specs/2026-06-23-auth-hardening-design.md`) を維持する運用負担を削減し、将来の Federation / Passkey / Hosted UI / 多クライアント対応の受け皿を Cognito に持たせるため。「凍結しない」不変 (`docs/superpowers/specs/2026-06-29-account-durability-design.md`) は本 spec でも継続、Cognito 側の Disable/AdminDeleteUser を admin 判断で使う経路を作らない。

## Concept

現在:
- `identity__users` (id/phone_number/password_digest/role/failed_login_attempts/locked_until/deactivated_at) + `identity__sms_verifications` + `identity__refresh_tokens`
- 自前 JWT (`Auth::JwtCodec`, RS256, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`)
- bcrypt cost 12、SMS 単回使用、rate limit、brute-force lockout (5 fail → 15 min)、refresh token digest 化
- BFF (Next.js API route) が gRPC 経由 monolith identity RPC を呼び、httpOnly cookie で token 仲介

移行後:
- **AWS Cognito User Pool** (phone_number alias、SMS OTP verification、USER_PASSWORD_AUTH、MFA off、ASF off)
- **BFF が Cognito 呼び出しの主体**。frontend は cookie の存在すら意識しない
- **BFF が Cognito access token を JWKS 検証 → sub 抽出 → `x-user-id` gRPC metadata に付与**
- **monolith は Cognito 非依存**。`identity__accounts` (id = Cognito sub, role, deactivated_at) のみ保持
- 既存の identity データは全 DROP、他 slice も clean slate (dogfood 段階のため)

## Decisions

| 項目 | 決定 |
|---|---|
| 移行方式 | **クリーンスタート**。既存 dogfood データを全 DROP、Cognito ゼロ発 |
| 認証フロー | 現行相当 (SignUp → ConfirmSignUp (SMS OTP) → 以降 USER_PASSWORD_AUTH)。login 時 SMS なし、password のみ |
| account_id | **Cognito sub を直接利用** (マッピングテーブル無し)。uuid v4 なので既存 string 型と互換 |
| role 保管 | **DB `identity__accounts.role`** (Cognito 非依存)。Cognito Groups / custom attribute は使わない |
| dev/dogfood SMS | **BFF 側 CognitoAdapter fake 実装** (in-memory、固定 code `000000`)。prod のみ AWS Cognito、Custom SMS Sender Lambda 不採用 |
| brute-force lockout | **Cognito 標準 rate limit にダウングレード**。auth-hardening spec のこの項目は明示的に落とす。PreAuthentication Lambda / ASF は不採用 |
| Cognito 呼び出し主体 | **BFF (Next.js API route)**。将来 BFF を独立 service に切り出しても Cognito 依存はそこに閉じる |
| BFF ↔ monolith 認証 | **BFF が JWKS 検証 → `x-user-id` gRPC metadata のみ付与**。`Authorization: Bearer` 経路と `JwtCodec` は削除 |
| purge cron | **monolith cron に 1 箇所 Cognito SDK 依存を許容** (`Identity::UseCases::Account::PurgeDeactivatedAccounts` から AdminDeleteUser)。他は全て Cognito 非依存 |
| Cognito Disable/AdminDeleteUser | **admin 判断による Disable/Delete は禁止**。本人退会 → 30 日 grace → hard-delete cron からの AdminDeleteUser のみ許容 |
| Terraform 配置 | **`dystopia/frontend/aws/`** (BFF が呼び出し主体のため隣接)。将来 auth-service に切り出す際に module ごと移す |
| 使う AWS リソース | Cognito User Pool + Client + SNS SMS role のみ。**Lambda trigger / KMS 一切不採用** |

## Invariants (継続)

`docs/superpowers/specs/2026-06-29-account-durability-design.md` の invariants を継続、Cognito 側にも波及させる:

1. **admin による永久 BAN / 永久 suspend / 永久削除の経路を作らない** (Cognito Disable/AdminDeleteUser 含む)
2. **hard-delete の唯一の trigger は (本人 deactivate request) AND (grace 期間経過)**。cron 以外に Cognito AdminDeleteUser を呼ぶ場所を作らない
3. **BFF は client に token を露出させない** (httpOnly cookie 仲介、frontend は Cognito SDK を持たない)
4. **monolith は Cognito 非依存を維持**。例外は `PurgeDeactivatedAccounts` cron の AdminDeleteUser 呼び出し 1 箇所のみ

## Non-Goals

- Federation (Google/Apple/LINE), Passkey, Hosted UI, TOTP MFA, Advanced Security Features は本 spec では enable しない (将来の受け皿として User Pool を作るが今回スコープ外)
- 複数クライアント同時対応 (mobile app 等) は本 spec では対応しない
- Cognito → 別 identity provider への移行 tooling
- 既存 dogfood ユーザーの Cognito への import (全消しでクリーンスタート)
- `trust__*` / `portfolio__*` 系 migration の cleanup (identity と無関係の遺産、別 PR で扱う)

## Grounding (現状 main、2026-08-26)

### 現行 identity slice

- `identity__users(id string PK, phone_number, password_digest, role int, failed_login_attempts, locked_until, deactivated_at, created_at, updated_at)`
- `identity__sms_verifications` + `identity__refresh_tokens`
- proto: `proto/dystopia/identity/v1/service.proto` に 10 RPC (HealthCheck / SendSms / VerifySms / Register / Login / RefreshToken / Logout / ResetPassword / GetCurrentAccount / DeactivateAccount)
- use_cases: `auth/{login,register,logout,reset_password,deactivate_account}` / `verification/{send_code,verify_code}` / `token/refresh` / `user/{get_profile,purge_deactivated_accounts,purge_identity}`
- lib: `lib/auth/jwt_codec.rb` (RS256, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`), `lib/sms.rb` + `lib/sms/{adapter,fake_adapter,sns_adapter}.rb`, `lib/interceptors/authentication_interceptor.rb` (Bearer decode + `x-user-id` の 2 経路)

### 他 slice の identity 参照

7 slice が `identity_user_repo.find_by_id(account_id)&.role` パターンで role を参照:
- post/adapters/user_adapter.rb (+ 同 slice の post_handler)
- footprints/grpc/footprints_handler.rb
- discovery/grpc/discovery_handler.rb (+ use_cases/suggest_users.rb)
- social/grpc/{block,follow}_handler.rb
- profile/grpc/profile_handler.rb (+ repositories/profile_repository.rb)
- notifications/grpc/notification_handler.rb
- karte/use_cases/create_entry.rb (`target.role == 1` チェック)

### cross-slice FK (現状 1 箇所)

- `config/db/migrate/20260205000000_create_post_comments.rb:22`: `foreign_key [:user_id], :"identity__users", on_delete: :cascade`
- 他の cross-slice FK は `portfolio__*` / `trust__*` 系のみで identity と無関係

### 現行 BFF

- `src/app/api/identity/` に 9 route (`send-sms / verify-sms / register / sign-in / refresh-token / logout / me / deactivate / reset-password`)
- `src/lib/auth/cookies.ts` — access/refresh cookie helper
- `src/lib/request.ts::buildGrpcHeaders` — cookie の access_token を `Authorization: Bearer <jwt>` gRPC metadata に付与

### 現行 Terraform / AWS

- `dystopia/monolith/aws/{modules,envs/production}` (RDS PostgreSQL)、production env のみ Terraform 管理
- `dystopia/frontend/aws/` 未存在
- root.hcl は state key `dystopia/<service>/<env>/terraform.tfstate` を共有 bucket に置く terragrunt 構成

## A. AWS Cognito User Pool (`dystopia/frontend/aws/`)

### 新設 directory 構成

```
dystopia/frontend/aws/
├── root.hcl                # monolith 側の root.hcl と同構造 (state key = dystopia/frontend/<env>/terraform.tfstate)
├── modules/
│   ├── terraform.tf        # provider 宣言、required_version
│   ├── variables.tf
│   ├── user_pool.tf        # aws_cognito_user_pool + aws_cognito_user_pool_client
│   ├── sms_role.tf         # SNS 発行用 aws_iam_role + aws_iam_role_policy
│   └── outputs.tf          # user_pool_id / client_id / user_pool_arn / issuer / jwks_uri
└── envs/
    └── production/
        ├── env.hcl
        └── terragrunt.hcl
```

### User Pool 設定

| 項目 | 値 |
|---|---|
| Name | `dystopia-production` |
| Sign-in alias | `phone_number` (E.164) のみ |
| Standard attribute | `phone_number` (required, mutable) |
| Custom attribute | なし (role は DB 側) |
| Password policy | 12 文字以上 / 大文字 / 小文字 / 数字 / 記号 (register_contract 相当) |
| MFA | OFF |
| SMS verification | `AutoVerifiedAttributes = [phone_number]` |
| Advanced Security | OFF |
| Deletion Protection | ACTIVE |
| Lambda trigger | なし |

### User Pool Client 設定

| 項目 | 値 |
|---|---|
| Auth flows | `USER_PASSWORD_AUTH`, `REFRESH_TOKEN_AUTH` |
| Generate secret | false (BFF は confidential client だが、Cognito SDK v3 が SecretHash を透過に扱えるため false でよい) |
| Access token TTL | 1h (現行相当) |
| Refresh token TTL | 30d (現行相当) |
| ID token TTL | 1h |
| Prevent user existence errors | true (アカウント列挙 hardening) |

### IAM

- SNS 発行用 role: Cognito service assume、`sns:Publish` を SMS 送信対象に付与

### Terraform outputs

- `user_pool_id`, `user_pool_arn`, `client_id`, `issuer` (`https://cognito-idp.<region>.amazonaws.com/<user_pool_id>`), `jwks_uri`

## B. DB schema

### DROP (destroy & recreate、新 migration に置き換え)

- 既存 `20260114002209_create_users.rb` / `20260114003157_create_sms_verifications.rb` / `20260118000000_create_refresh_tokens.rb` / `20260227000001_unify_user_id.rb` / `20260626000000_add_consumed_at_and_failed_attempts_to_sms_verifications.rb` / `20260626000001_add_failed_login_attempts_and_locked_until_to_users.rb` / `20260626000002_rename_refresh_token_to_digest.rb` / `20260629000000_add_deactivated_at_to_users.rb` の **9 migration ファイルを削除**
- `20260205000000_create_post_comments.rb:22` の FK 行 (`foreign_key [:user_id], :"identity__users", on_delete: :cascade`) を **直接削除** (destroy & recreate なのでリライト可)

### 新規 migration `2026XXXX_create_identity_accounts.rb`

```
create_table :"identity__accounts" do
  column :id,             :string,      null: false          # Cognito sub (uuid v4)
  column :role,           :integer,     null: false          # 1=guest, 2=cast
  column :deactivated_at, :timestamptz, null: true
  column :created_at,     :timestamptz, null: false, default: Sequel.lit("now()")
  column :updated_at,     :timestamptz, null: false, default: Sequel.lit("now()")
  primary_key [:id]
  index :deactivated_at, where: "deactivated_at IS NOT NULL"
end
```

- 他 slice の `user_id` / `account_id` 列型は変更なし (現行 string 型のまま Cognito sub を格納)
- cross-slice FK は 0 に (post_comments の 1 箇所を削除で達成)

## C. Monolith

### proto (`proto/dystopia/identity/v1/service.proto`)

**削除する RPC (7)**: `SendSms` / `VerifySms` / `Register` / `Login` / `RefreshToken` / `Logout` / `ResetPassword`

**残す (2)**: `HealthCheck` / `DeactivateAccount`

**改名 + 引数変更 (1)**:
- `GetCurrentAccount(Empty) returns (Account)` → `GetAccount(GetAccountRequest{sub}) returns (Account)`
  - Cognito 移行で BFF が sub を明示的に持つので、`Current` 経由の暗黙引数ではなく明示引数に

**新規 RPC (1)**:
- `CreateAccount(CreateAccountRequest{sub, role}) returns (Account)` — BFF が Cognito ConfirmSignUp 直後に呼ぶ

**message**:
- `Account`: `phone_number` フィールドを削除 (Cognito 側管理、DB に持たない)
- 上記 7 削除 RPC に紐づく request/response message 全削除
- `Role` enum は残す

**`buf generate` で TypeScript + Ruby stub 再生成**

### identity slice Ruby コード

**削除**:
- `slices/identity/contracts/auth/` `slices/identity/contracts/verification/` (全ファイル)
- `slices/identity/use_cases/auth/{login,register,logout,reset_password}.rb`
- `slices/identity/use_cases/verification/{send_code,verify_code}.rb`
- `slices/identity/use_cases/token/refresh.rb`
- `slices/identity/use_cases/user/get_profile.rb` (→ `use_cases/account/get_account.rb` に再作成)
- `slices/identity/repositories/{refresh_token,sms_verification}_repository.rb`
- `slices/identity/relations/{refresh_tokens,sms_verifications}.rb`
- `slices/identity/presenters/auth_presenter.rb`

**リネーム + 縮小**:
- `slices/identity/relations/users.rb` → `slices/identity/relations/accounts.rb` (schema は `identity__accounts`)
- `slices/identity/repositories/user_repository.rb` → `slices/identity/repositories/account_repository.rb`
  - 残すメソッド: `find_by_id(sub)` / `create(sub:, role:)` / `mark_deactivated(sub)` / `reactivate(sub)` / `delete(sub)`
  - 削除するメソッド: `find_by_phone_number`, `record_failed_login`, `lock_until`, `reset_login_attempts`, `update_password_digest` 等 bcrypt/lockout/phone-based lookup
- `slices/identity/use_cases/auth/deactivate_account.rb` → `slices/identity/use_cases/account/deactivate_account.rb` (DB soft delete のみ、Cognito 呼び出しなし)
- `slices/identity/use_cases/user/purge_deactivated_accounts.rb` → `slices/identity/use_cases/account/purge_deactivated_accounts.rb` (30 日 grace 判定は不変、最後に `Cognito.admin_delete_user(sub:)` を呼ぶ)
- `slices/identity/use_cases/user/purge_identity.rb` → `slices/identity/use_cases/account/purge_identity.rb` (post_comments の cascade を明示 DELETE 化。他 slice への application-level cascade は既存の PurgeAccount pattern を継続)

**新規**:
- `slices/identity/use_cases/account/create_account.rb` — sub + role を受けて `identity__accounts` に行作成、unique 制約違反は `AccountAlreadyExists` に変換
- `slices/identity/use_cases/account/get_account.rb` — sub で find、nil 時は gRPC NOT_FOUND

**grpc/handler.rb**: 上記 RPC 実装を反映 (8 メソッド削除、2 メソッド追加/改名)

**presenters/account_presenter.rb**: `phone_number` 参照を削除、`role_enum_to_int` / `role_int_to_enum` は残す

### lib 側

**削除**:
- `lib/auth/jwt_codec.rb`
- `lib/sms.rb` + `lib/sms/{adapter,fake_adapter,sns_adapter}.rb`
- `spec/support/jwt_keys.rb`

**修正**:
- `lib/interceptors/authentication_interceptor.rb` — `extract_user_id` から Bearer decode 経路を削除、`x-user-id` メタデータ経路のみに。`Auth::JwtCodec` の require も削除

**新規**:
- `lib/cognito.rb` (既存 `lib/sms.rb` と同じ shape の adapter pattern):
  - 公開 API: `Cognito.admin_delete_user(sub:)` の 1 メソッドのみ
  - `Cognito::Adapter` (interface)
  - `Cognito::FakeAdapter` (no-op、log 出力のみ)
  - `Cognito::AwsAdapter` (`aws-sdk-cognitoidentityprovider` を lazy require)
  - `default_adapter` は `HANAMI_ENV` で切り替え (test/development → Fake、それ以外 → Aws)

### Gemfile

- 削除: `bcrypt`, `jwt`, `aws-sdk-sns` (他用途がないことを実装時 grep で確認)
- 追加: `aws-sdk-cognitoidentityprovider`

### ENV

- 削除: `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, SMS 系
- 追加: `COGNITO_USER_POOL_ID` (prod のみ、terraform output 経由)、`COGNITO_REGION` (default `ap-northeast-1`)

### IAM (monolith side)

- `AdminDeleteUser` のみ許可する policy を作成、対象 resource は `COGNITO_USER_POOL_ARN` (terraform_remote_state で `dystopia/frontend/production` の output を参照)
- 既存の SNS `Publish` 権限は削除

### 他 slice への波及 (rename のみ、ロジック不変)

7 slice で `identity_user_repo` deps を `identity_account_repo` にリネーム:
- post/adapters/user_adapter.rb → account_adapter.rb (中身も対応リネーム)
- footprints/grpc/footprints_handler.rb
- discovery/grpc/discovery_handler.rb + use_cases/suggest_users.rb
- social/grpc/{block,follow}_handler.rb
- profile/grpc/profile_handler.rb + repositories/profile_repository.rb
- notifications/grpc/notification_handler.rb
- karte/use_cases/create_entry.rb (`target.role == 1` チェックは変更なし)

## D. BFF (`dystopia/frontend/`)

### 新規 `src/lib/cognito/`

既存 `dystopia/monolith/lib/sms.rb` の adapter pattern を TypeScript で踏襲。framework 依存は許容 (シンプルさ優先)、ただし Next.js `NextRequest`/`NextResponse` 型は adapter interface に含めない (adapter は plain function)。

- `adapter.ts` — interface + factory (`process.env.COGNITO_ADAPTER` で AWS/fake 選択、dev default = fake)
  - `signUp(phone, password) → { userSub }`
  - `confirmSignUp(phone, code) → void`
  - `initiateAuth(phone, password) → { accessToken, refreshToken, idToken }`
  - `refreshTokens(refreshToken) → { accessToken, idToken }`
  - `globalSignOut(accessToken) → void`
  - `forgotPassword(phone) → void`
  - `confirmForgotPassword(phone, code, newPassword) → void`
- `aws.ts` — AWS SDK v3 実装 (`@aws-sdk/client-cognito-identity-provider`)
- `fake.ts` — dev 用 in-memory 実装 (phone → sub Map、code は固定 `000000`、自前 RSA 鍵で access token を署名)
- `jwks.ts` — Cognito JWKS で access token 検証 (`jose` 使用、issuer と client_id 検証、キャッシュ 12h)

### 書き換え: 9 route.ts (既存パターン踏襲、直書き)

- `sign-in/route.ts` — `cognito.initiateAuth()` → JWKS 検証 → sub 抽出 → `identityClient.getAccount(sub)` で role 突合 + `deactivated_at` reactivate 判定 → 不一致なら `cognito.globalSignOut()` + 401 / 一致なら cookie 発行
- `register/route.ts` — `cognito.signUp(phone, password)` のみ (SignUp が SMS OTP 送信)、200 だけ返す (cookie 未発行)。password と role は BFF server-side に保持せず、frontend が state に持って次段 verify request の payload に含めて送る (server-side に平文 password を一時保持する経路は作らない)
- `verify-sms/route.ts` → `verify/route.ts` に改名 — payload は `{ phone, code, password, role }`。`cognito.confirmSignUp(phone, code)` → `cognito.initiateAuth(phone, password)` → sub 抽出 → `identityClient.createAccount(sub, role)` → cookie 発行
- `refresh-token/route.ts` — cookie の refresh token で `cognito.refreshTokens()` → cookie 更新
- `logout/route.ts` — `cognito.globalSignOut()` + `clearAuthCookies`
- `me/route.ts` — cookie の access token を JWKS 検証 → sub → `identityClient.getAccount(sub)` → 返却
- `deactivate/route.ts` — `identityClient.deactivateAccount(sub)` → `cognito.globalSignOut()` + `clearAuthCookies`
- `reset-password/route.ts` — 2 endpoint に分割: `cognito.forgotPassword(phone)` と `cognito.confirmForgotPassword(phone, code, newPassword)`

### 削除

- `src/app/api/identity/send-sms/` — Cognito SignUp が SMS 送信を担うため不要

### `src/lib/request.ts::buildGrpcHeaders` 修正

- 現行: cookie の access_token を `Authorization: Bearer <jwt>` gRPC metadata に付与
- 修正後: cookie の access token を JWKS 検証 → sub 抽出 → `x-user-id: <sub>` gRPC metadata に付与。`Authorization: Bearer` は付与しない
- 検証結果は request scope で 1 度だけ実行 (`X-Request-ID` と同じライフサイクル)、検証失敗は 401 を route 側で返す

### cookie

- 現行 `src/lib/auth/cookies.ts` の `access_token` / `refresh_token` cookie 名を維持 (Cognito の access / refresh に対応)
- id_token は BFF 内部でも使わないので cookie に持たない
- SameSite=Lax / httpOnly / secure (prod) の属性は現行維持

### frontend UI 影響

- **register 画面**: 現行 3〜4 段 (電話 → SMS 送信 → コード入力 → password) → **2 段** (電話 + password 入力 → SMS コード入力) に再編。role 選択は現行通り最初の段で
- **login / logout / me / deactivate / refresh / reset-password**: endpoint と request/response shape 不変、UI 側変更なし
- 実装時に UI 側の差分を最小化する形で書く

### 新規 npm 依存

- `@aws-sdk/client-cognito-identity-provider`
- `jose` (JWKS 検証、Edge runtime 対応)

### 新規 env

- prod: `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`
- dev/test: `COGNITO_ADAPTER=fake` (default: fake in dev/test)

## E. Test 戦略

### BFF

- Unit spec: `src/lib/cognito/*` を fake adapter でテスト、9 route.ts の flow を fake で駆動
- Integration: SignUp → ConfirmSignUp → InitiateAuth → RefreshToken → GlobalSignOut の full flow を fake で通す
- JWKS 検証は fake adapter が自前 RSA 鍵で署名 → 検証側も同じ鍵で成功する形

### monolith

- 削除対象の use_case/contract/repo/relation spec は全削除
- 新規 spec: `spec/slices/identity/use_cases/account/{create_account,get_account,deactivate_account,purge_identity,purge_deactivated_accounts}_spec.rb`
- 新規 spec: `spec/lib/cognito_spec.rb` (fake adapter が呼ばれること、aws adapter は integration 対象外)
- `spec/lib/interceptors/authentication_interceptor_spec.rb` — Bearer decode ケース削除、`x-user-id` 経路のみに整理
- 削除: `spec/lib/auth/jwt_codec_spec.rb`, `spec/support/jwt_keys.rb`
- 他 7 slice の spec は `identity_user_repo` → `identity_account_repo` リネームに追随

### CI

- BFF CI は fake adapter で完結、AWS 認証情報不要
- monolith CI は現行通り (Cognito 呼び出し部分は fake で完結)
- Terraform module は `terraform validate` を追加 (既存 aws/modules に validate ステップがあるか要確認、無ければ本移行スコープ外)

## F. dev / dogfood 環境

### BFF

- `COGNITO_ADAPTER=fake` (dev default)
- fake adapter は in-memory で phone → sub Map、SMS OTP は固定 code `000000` を受理
- fake adapter が発行する access token は fake 用 RSA 鍵で署名、JWKS 検証も fake 用鍵で動く (fake の jwks entry を jwks.ts の env 分岐で読む)

### monolith

- `HANAMI_ENV=development` / `test` で `Cognito::FakeAdapter` (`admin_delete_user` は log 出力のみ no-op)
- prod のみ `Cognito::AwsAdapter`

### local e2e run (`docs/superpowers/2026-06-XX-local-e2e-run.md` 相当を更新)

- **削除**: JWT 秘密鍵の自前準備手順
- **変更**: SMS adapter fake → Cognito fake adapter (固定 code `000000`)
- **変更**: register の入力段数が 3〜4 段 → 2 段に対応した puppeteer 手順の更新
- **不変**: 旧 monolith process kill / puppeteer-core 起動 / monolith log 併走監視

## G. 移行手順

### 実行順序

1. **worktree/branch 準備** (この spec の branch = `feat/identity-cognito-migration`)
2. **Terraform module 追加** — `dystopia/frontend/aws/{modules,envs/production}` 新設
3. **proto 変更** — `identity/v1/service.proto` 書き換え、`buf generate` で TypeScript + Ruby stub 再生成
4. **monolith 側変更** — identity slice 削除 + accounts への縮小 / `lib/cognito.rb` 追加 / interceptor 変更 / Gemfile 更新 / 他 7 slice の deps リネーム / migration ファイル削除 + 新 migration
5. **monolith spec 更新** — 削除 + 新規 + 他 slice リネーム追随、`bundle exec rspec` green
6. **BFF 側変更** — `src/lib/cognito/*` 追加 / 9 route.ts 書き換え / `buildGrpcHeaders` 変更 / package.json 更新
7. **BFF spec 更新** — `pnpm test` green、`pnpm build` green
8. **local e2e で dogfood 検証** — fake adapter で 1 セッション貫通 (memory `feedback_dogfood_finds_unit_gaps`)
9. **Draft PR 作成** — memory `feedback_create_draft_prs`
10. **Terraform apply (prod)** — User Pool 作成、outputs を Secrets/ConfigMap に反映
11. **prod DB destroy + recreate** — 既存 dogfood データを全 DROP、新 migration で再構築 (No negative legacy 方針、データ損失は許容)
12. **BFF/monolith deploy** — 新 image を prod へ
13. **prod smoke test** — register 1 件 / login / logout / self deactivate

### 検証コマンド (実装完了時、feedback_verify_by_running_tests)

1. `bundle exec rspec` monolith 全 spec green
2. `pnpm test` frontend spec green
3. `pnpm build` frontend build green
4. local e2e で dogfood: register → login → 主要 slice の動作 (karte / feed / follow / message) → logout → login → deactivate → 30 日相当を手動 SQL 更新で simulate → cron 実行で hard-delete 確認 (DB row 消失 + fake Cognito.admin_delete_user が呼ばれた log)
5. prod smoke: terraform apply → BFF/monolith deployment → register 1 件 / login / logout / self deactivate

### ROLLBACK

- Prod cutover はデータ損失を伴うので実質不可 (No negative legacy 方針で許容)
- 実装期間中は `COGNITO_ADAPTER=fake` で常時 green を維持、cutover 直前に aws に切り替え
- Cognito User Pool は `deletion_protection = ACTIVE` で誤削除防止

### スコープ外の既知遺産 (別 PR で扱う)

- `trust__reviews` 系 migration (memory 上 destroy 済みの trust slice の残骸)
- `portfolio__*` prefix の migration (現行 slice ディレクトリ名との naming inconsistency)
- 現行 cross-slice FK のうち identity 以外 (`portfolio__` 参照など)
- BFF を Next.js API route から独立 service (auth-dedicated backend) に切り出すリファクタ (今回は Terraform module を `dystopia/frontend/aws/` に置き、切り出し時に module ごと移す前提)
