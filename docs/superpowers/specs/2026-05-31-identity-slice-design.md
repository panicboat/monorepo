# Identity Slice Design — full-stack vertical slice

Date: 2026-05-31
Status: Design spec (implementation-ready)
Scope: identity context（アカウント credential・認証・role）を domain → proto → monolith → frontend の縦スライスで再構築。
Related: `2026-05-31-domain-context-map-design.md`（keystone、identity = 最初の縦スライス）、`2026-05-29-design-system-design.md` §7（role）/§8（cast 検証の法務）

## Goal

実績ある認証モデル（電話 + SMS OTP + password → JWT + refresh）を踏襲しつつ、JWT の扱い・トークン保存・ドメイン言語を整理して identity context を greenfield 再構築する。

## Decisions（確定）

- **認証モデル踏襲**: 電話 + SMS OTP（電話所有検証）→ register/login に password(BCrypt) + role → JWT access + refresh。
- **JWT 署名 = 非対称（RS256、または EdDSA）**: 署名鍵は発行者のみ、検証は公開鍵。将来の Gateway/多サービス検証に備える。**private key は必須**（現行の `"pan1cb0at"` ハードコード fallback は廃止、未設定なら起動失敗）。
- **寿命 = 短 access + 長 refresh**: access 短命（既定 1h）、refresh 長命（既定 60d）・single-use rotate・DB 保存・失効可。長セッション UX は refresh で担保、access 窃取窓は小さく。
- **保存 = httpOnly cookie（BFF 管理）**: access / refresh を httpOnly + Secure + SameSite cookie で保持。JS から読めず XSS 耐性。localStorage 廃止。CSRF は SameSite（Lax）で対処、必要なら state 変更系に CSRF token。
- **言語整理**: identity が所有するのは **Account**（現行 proto `UserProfile` を改名。`UserProfile` 名は profile コンテキストの語と衝突するため）。`GetCurrentUser` → `GetCurrentAccount`。role enum `ROLE_GUEST`/`ROLE_CAST` は維持。
- **handle は identity 非所有** — profile スライス所有（legacy `slug` を profile で `handle` にリネーム）。

## Domain model

identity が所有する集約・エンティティ:

- **Account**: `id (UUID)` / `phone_number (unique)` / `password_digest (BCrypt)` / `role (guest|cast)` / `created_at` / `updated_at`。
- **RefreshToken**: `id` / `account_id (FK)` / `token (opaque random)` / `expires_at` / `created_at`。single-use（rotate 時に旧を失効）。
- **SmsVerification**: `id (= verification_token)` / `phone_number` / `code` / `expires_at` / `verified_at`。

role は登録時に確定、原則不変。

## API contract — `proto/identity/v1`

`IdentityService`（整理後）:

| RPC | Request | Response | 備考 |
|---|---|---|---|
| `HealthCheck` | — | status | |
| `SendSms` | `{ phone_number }` | `{ success }` | OTP 送信 |
| `VerifySms` | `{ phone_number, code }` | `{ verification_token }` | 電話所有検証 |
| `Register` | `{ phone_number, password, verification_token, role }` | `{ access_token, refresh_token, account }` | |
| `Login` | `{ phone_number, password, role }` | `{ access_token, refresh_token, account }` | role 一致を強制 |
| `RefreshToken` | `{ refresh_token }` | `{ access_token, refresh_token }` | rotate |
| `Logout` | `{ refresh_token }` | `{ success }` | refresh 失効 |
| `GetCurrentAccount` | （Authorization） | `Account` | JWT interceptor が account_id を注入 |

`Account` message: `{ id, phone_number, role }`。`Role { ROLE_UNSPECIFIED=0, ROLE_GUEST=1, ROLE_CAST=2 }`。

> 命名: 旧 `UserProfile` → `Account`、旧 `GetCurrentUser` → `GetCurrentAccount`。

## JWT design

- **alg = RS256**（または EdDSA/Ed25519）。鍵ペアを生成し、private key を secret として配備（PEM）。public key は検証側に配布可能。
- **claims（最小）**: `sub`（account id）/ `role` / `iat` / `exp`。role を claim に入れ、authz の都度 DB 参照を避ける（role は原則不変）。
- **access exp ≈ 1h**、**refresh ≈ 60d**（いずれも env で調整可）。
- access は stateless（DB 非保存）。refresh は DB 保存し rotate/失効。
- 起動時に署名鍵が無ければ fail-fast（insecure fallback 禁止）。

## Token transport & storage

- **BFF（Next route handler）が httpOnly cookie を管理**:
  - register / login / refresh の成功時、`access`・`refresh` を httpOnly + Secure + SameSite=Lax cookie でセット。
  - アプリ → BFF リクエストは cookie を自動送信。BFF が access cookie を読み、`Authorization: Bearer` で monolith gRPC へ転送。
  - access 失効（monolith が UNAUTHENTICATED）時、BFF が refresh cookie で `RefreshToken` を呼び、新 cookie に差し替え。
  - logout で両 cookie を clear ＋ monolith で refresh 失効。
- **localStorage は使わない**。トークンは JS から不可視。
- CSRF: SameSite=Lax を基本、state 変更系（POST 等）で不足なら CSRF token を追加。

## Monolith identity slice（Ruby / Hanami）

現行スライス構造（contracts / use_cases / repositories / relations / presenters / grpc handler）を踏襲し、以下を整理:

- relations: `accounts`（旧 users）/ `refresh_tokens` / `sms_verifications`。テーブル名・命名を Account 語彙へ。
- JWT 署名を HS256 → **RS256（非対称）**へ。署名鍵 env 必須。認証 interceptor は公開鍵で検証（既存の `x-user-id` gateway-offload fallback は維持して将来に備える）。
- presenter は `Account` を返す。
- 実 SMS provider 接続（モック撤去、未設定なら fail-fast）。

## Frontend（BFF + データ層）

- BFF routes（`/api/identity/*`）: 上記 cookie 管理を実装。`me` は `GetCurrentAccount`。
- **authStore は「トークン保持」をやめ、account（id / role）のみ保持**（`GetCurrentAccount` 由来）。`isAuthenticated` は account 有無で判定。
- `useAuth`: cookie ベースに合わせ、初期化で `/api/me` を叩いて account を得る。role mapping（enum → "guest"|"cast"）は維持。
- gRPC client（`grpc.ts`）: 非対称検証に伴う変更は monolith 側中心。BFF は token を転送するのみ。

## Security notes

- 署名 private key・SMS provider 資格情報は secret 管理（env、未設定で fail-fast）。
- httpOnly cookie + 非対称署名 + 短 access + rotate refresh で、XSS 窃取・失効不能・鍵共有の各リスクを低減。

## Deferred / out of scope

- **cast の年齢/本人確認**: 自己申告では不十分（§8、未成年登録は重大犯罪）。**別 spec + 法務レビューが実装の hard gate**。**検証機構なしで cast 登録を本番投入しない**。
- **handle / username**: profile スライスで定義（identity 非所有）。legacy `slug` → `handle` リネームも profile スライス。
- 実 SMS provider の選定（プロバイダ比較）。
- 既存 lint 破損（eslint 10 × typescript-eslint）は frontend 共通課題として別途。
