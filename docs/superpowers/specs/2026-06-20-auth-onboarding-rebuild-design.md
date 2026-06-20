# Auth / Onboarding Rebuild — sub-project #1

Date: 2026-06-20
Status: Design spec (implementation-ready)
Scope: real な Login / Signup / Onboarding / Password reset を再建し、SMS を全環境で実 provider (Amazon SNS) 連携にする。Direction doc `2026-06-20-product-direction-mvp-design.md` の sub-project #1。法務 (本人確認/年齢確認) は対象外。

## Goal

Cast / Guest が real account を作り、ログインし、ミニマルな onboarding を経てアプリに入れるようにする。パスワード忘れも回復できる。SMS 検証コードは全環境で実生成・実送信（test は送信のみ fake）にし、固定 "0000" mock の負の遺産を撤去する。

## Grounding（現状）

- **backend identity slice は完成**: `IdentityService` に `SendSms / VerifySms / Register / Login / RefreshToken / Logout / GetCurrentAccount` が揃い、use_cases (`auth/{login,register,logout}`, `verification/{send_code,verify_code}`, `token/refresh`, `user/get_profile`) も実装済。**`ResetPassword` だけが無い。**
- **`SendCode` use_case は mock**: `ENV.fetch("MOCK_SMS_CODE", "0000")` で固定コード、`puts "[SMS MOCK]"`、`# TODO: Twilio/SNS` 付き。実送信なし。
- **frontend の auth ロジックは完成**: BFF routes (`/api/identity/{send-sms,verify-sms,register,sign-in,refresh-token,logout,me}`)、`useAuth` (requestSMS/verifySMS/register/login/logout/refresh + 401 リフレッシュ)、`authStore` (Zustand + persist)。
- **欠落は UI ページのみ**: `useAuth.register` は登録後 `/onboarding` (Guest) / `/cast/onboarding` (Cast) へ、`login` は `/` (Guest) / `/cast/home` (Cast) へ push するが、login/signup/onboarding ページが存在しない（解体済）。なお `/cast/*` の page route は元々存在せず (現状の role 出し分けは `selectRole` による単一ルート内の条件分岐で実装済 — `settings/page.tsx` / `profile/page.tsx` 参照)、この redirect 先は宙ぶらりんの負の遺産。
- **AWS SDK は既存**: `aws-sdk-s3 ~> 1.220` 経由で `aws-sdk-core 3.246` が依存ツリーにある。`aws-sdk-sns` を足すだけ。`lib/storage` に adapter pattern (base interface + env 選択 + `Storage.adapter=` 注入) の先例がある。

## Decisions

| 項目 | 決定 | Why |
|---|---|---|
| SMS provider | **Amazon SNS** (`aws-sdk-sns`)。`lib/sms` に storage と同型の adapter pattern | AWS で統一 (aws-sdk-core 既存)。Twilio 不採用 (ユーザー指定) |
| コード生成 | **全環境で常にランダム数字生成**。固定 "0000" / `MOCK_SMS_CODE` / `puts` を撤去 | 「どの環境でも正しく生成」(ユーザー指定)。mock の負の遺産を残さない |
| test/CI の送信 | **送信のみ** fake adapter (実 AWS を叩かない)。生成・検証ロジックは実 | コスト・到達不能・非決定性を回避しつつ、生成は本番同等 (ユーザー指定) |
| Onboarding 深さ | **ミニマル** (表示名 + handle のみ必須)。業種/エリア/avatar は既存 profile 編集で後追加 | signup 摩擦最小 = cold-start の Cast 獲得に有利 (ユーザー指定) |
| URL のロール分割 | **分割しない (単一ルート)**。`/onboarding`・`/` を両ロール共通とし、中身は `selectRole` で出し分け | 既存アプリは既に単一ルート + role 条件分岐で動作 (新たな複雑さゼロ)。role prefix は無印 Guest の非対称・Cast 特別扱いを生み Cast ファースト思想に逆行。`useAuth` の `/cast/home`・`/cast/onboarding` redirect (宙ぶらりんの負の遺産) を `/`・`/onboarding` に是正する |
| Password reset | **含める**。新規 `ResetPassword` RPC + use_case + frontend フロー | 実 SMS = 実ユーザーで table-stakes。負の遺産を残さない |

## Backend

### `lib/sms` — SMS adapter (storage と同型)

```
lib/sms.rb            # module Sms: adapter / adapter= / reset! / send(phone_number:, body:)
lib/sms/adapter.rb    # base: send(phone_number:, body:) -> NotImplementedError
lib/sms/sns_adapter.rb   # Aws::SNS::Client#publish (phone_number, message)
lib/sms/fake_adapter.rb  # records sent messages in-memory, no network
```

- `Sms.adapter` は env で選択: 既定 (production/development/staging) = `SnsAdapter`、test = `FakeAdapter`。`Sms.adapter=` で注入可 (spec)。`Sms.reset!` で既定に戻す。
- `SnsAdapter`: `Aws::SNS::Client.new` (region/credentials は aws-sdk 標準解決 = ENV / IAM role)。`publish(phone_number:, message:)`。SMS attributes (sender id / transactional) は adapter 内に隠蔽。
- `FakeAdapter`: `sent` 配列に `{ phone_number:, body: }` を push するだけ。

環境判定は既存の HANAMI_ENV を使う (storage の env 判定に倣う)。実 AWS 資格情報が無い dev で送信失敗しても起動はブロックしない方針 (送信は use_case 内で rescue し、コードは DB に残るので検証は可能 — ただし dev は基本 real AWS 接続前提)。

### `SendCode` use_case 改訂

```ruby
def call(phone_number:)
  code = format("%06d", SecureRandom.random_number(1_000_000))  # 6桁ランダム
  expires_at = Time.now + (60 * 10)

  verification = repo.create(phone_number: phone_number, code: code, expires_at: expires_at)
  Sms.send(phone_number: phone_number, body: "認証コード: #{code}")
  verification
end
```

- 固定 "0000" / `MOCK_SMS_CODE` / `puts` を撤去。
- コード桁数は 6 桁に統一 (現行 4 桁 mock からの変更。`verify_code` 側は文字列等値比較なので桁数非依存だが要確認)。
- 送信は `Sms.send` 経由。test は `FakeAdapter` 注入で送信を記録、spec は `verification.code` を直接読んで `VerifySms` を検証。

### `ResetPassword` (新規)

- proto: `IdentityService` に `rpc ResetPassword(ResetPasswordRequest) returns (ResetPasswordResponse)`。`ResetPasswordRequest { string phone_number; string new_password; string verification_token; }`。
- use_case `auth/reset_password`: verification_token を検証 (既存 `verify_code` / token 機構を流用) → 対象 user の password_digest を更新。`Register` / `Login` の password ハッシュ方式に合わせる。
- handler に RPC 追加 (`bin/grpc` 登録は既存 IdentityHandler なので proto require のみ確認)。
- codegen: `./bin/codegen` (Ruby + TS)。

## Frontend

`useAuth` の既存メソッド (requestSMS/verifySMS/register/login/logout) に接続する **UI ページの新規作成**が主作業。

### Pages

| route | 役割 |
|---|---|
| `/login` | phone + password → `login()`。signup / password-reset へのリンク |
| `/signup` | 多段: phone → `requestSMS` → コード入力 → `verifySMS` (→ verificationToken) → password + role(Cast/Guest) → `register()` |
| `/onboarding` | 両ロール共通ミニマル: 表示名 + handle → profile 保存 → `/` へ。role 差 (Cast に業種/エリアへの導線を一言添える等) があれば `selectRole` で出し分け |
| `/reset-password` | phone → `requestSMS` → コード → `verifySMS` → 新 password → `ResetPassword` BFF → `/login` |

- **role 別 page route は作らない** (単一ルート方針)。onboarding は `/onboarding` 1 つ、home は `/` 1 つ。
- signup の role 選択は `register(phone, password, verificationToken, role)` の role 引数 (1=Guest, 2=Cast) に渡す。
- onboarding は handle/表示名のみ。profile 保存は既存の profile 保存経路 (save_profile / BFF) を使う。
- **`useAuth` の redirect 是正 (負の遺産解消)**: `register` の redirect を Cast/Guest とも `/onboarding` に、`login` を Cast/Guest とも `/` に統一する (現状の `/cast/onboarding` / `/cast/home` は存在しないページを指す。条件分岐自体を除去して対称化)。
- **未認証 redirect**: `AppShell` は現状「hydration 前 or 未認証 = children 素通し」。これを「未認証なら `/login` へ誘導 (login/signup/reset/onboarding ページ自身は除外)」に変更。middleware ではなくクライアント側 (authStore hydration 後に判定) で実装し、auth ページ群は allow-list。

### BFF
- `/api/identity/reset-password` (POST) → `identityClient.resetPassword`。既存 identity BFF と同型。
- 既存 BFF (send-sms/verify-sms/register/sign-in/refresh-token/logout/me) は再利用。

### 負の遺産メモ
`useAuth` に `data.accessToken || data.access_token` 等の dual-format FALLBACK パースが複数ある。本 sub-project では UI 再建に集中し、この防御パースの整理は scope 外 (触る register/login の戻り contract が安定していれば別タスク)。再建で contract を確認し、不要と確証が取れた FALLBACK は落とす。

## Decomposition（実装段）

| 段 | スコープ |
|---|---|
| B1 | `lib/sms` adapter (Adapter/SnsAdapter/FakeAdapter) + `aws-sdk-sns` 追加 + bundle frozen |
| B2 | `SendCode` 改訂 (random + Sms.send、mock 撤去) + spec (FakeAdapter) |
| B3 | `ResetPassword` proto + use_case + handler + codegen + spec |
| F1 | `/login` + `/signup` ページ (useAuth 接続) |
| F2 | `/onboarding` ミニマルページ (単一ルート、両ロール共通) + `useAuth` redirect 是正 (`/cast/*` → 単一ルート) |
| F3 | `/reset-password` ページ + `/api/identity/reset-password` BFF |
| F4 | 未認証 redirect (AppShell + auth ページ allow-list) |

## Deferred / out of scope

- 本人確認 / 年齢確認 (legal、別トラック)
- rich profile onboarding (業種/エリア/avatar — 既存 profile 編集で対応)
- social login (OAuth)
- SMS のレート制限 / brute-force 防御 (運用トラック。ただし送信回数制限は将来必須)
- `useAuth` の dual-format FALLBACK の全面整理

## Verification

```bash
# backend
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity
env -u NODE_OPTIONS bundle install --frozen   # aws-sdk-sns 追加後

# proto regen
cd <repo-root> && ./bin/codegen

# frontend
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint   # 0e/0w
env -u NODE_OPTIONS pnpm build
```

成功基準:
- 全環境でランダムコード生成、固定 "0000" / `MOCK_SMS_CODE` が codebase から消えている。
- test は実 AWS を叩かず (FakeAdapter)、生成・検証ロジックは実。
- signup (phone→SMS→password→role→ミニマル profile) → login → 未認証 redirect → password reset が動く。
- role 別 page route が存在しない (単一ルート)。`/cast/*` を指す redirect が codebase から消えている。Cast/Guest とも同一ルートで、中身のみ role 出し分け。
