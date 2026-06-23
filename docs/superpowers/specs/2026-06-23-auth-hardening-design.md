# Auth Hardening Design

Date: 2026-06-23
Status: Design spec (implementation-ready)
Scope: PR #761 (auth rebuild) 後の auth サーフェスの脆弱性を広く棚卸しし、現状 main で生きている findings を一括で潰す。`docs/superpowers/specs/2026-06-20-product-direction-mvp-design.md` の「負の遺産を残さない」方針の auth hardening track。

由来: PR #761 の最終 review + 専用 security audit。法務は対象外 (direction doc 方針)。

## Goal

認証フローの replay / brute-force / token 漏洩リスクを排除する。具体的には: SMS 検証 token の単回使用化、コード試行・SMS 送信・ログインの rate limiting、refresh token の DB ハッシュ保存、access+refresh の httpOnly cookie 化 (client JS 非保持・BFF 仲介)、及び小さな堅牢化 (timing-safe 比較・password 最小長・BCrypt cost・account enumeration 抑止)。

## Grounding (現状 main, post-#761)

- **identity slice 完成**: Register/Login/Logout/RefreshToken/SendSms/VerifySms/ResetPassword/GetCurrentAccount。
- relations:
  - `identity__sms_verifications`: id, phone_number, code, expires_at, verified_at, created_at
  - `identity__refresh_tokens`: id, user_id, **token (平文)**, expires_at, created_at
  - `identity__users`: id, phone_number, password_digest, role, created_at, updated_at
- `SendCode` (#761): 6 桁ランダム生成 + `Sms.send`、mock 撤去済。
- `VerifyCode`: `find_latest_by_phone_number` → expiry → `verification.code != code` (非 timing-safe) → `mark_as_verified`。試行回数制限なし。
- `Register`/`ResetPassword`: `verification.verified_at` を要求するが **token を消費しない** (replay 可)。
- `Login`: BCrypt 照合、**brute-force 防御なし**。
- `RefreshTokenRepository`: `token` 平文で create/find/revoke。`Token::Refresh` は rotation 済 (旧 revoke → 新発行)、`Logout` は revoke 済。
- frontend: refresh + access token を `authStore` (Zustand persist) で **localStorage 永続化**。
- **JWT は RS256 + 1h TTL + ENV 鍵で OK** (変更しない)。

## Decisions

| 項目 | 決定 |
|---|---|
| スコープ | 現状 main で生きている findings 全部を 1 sub-project (複数 PR) |
| rate-limiting 保存先 | **DB (PostgreSQL)**。Redis は不採用 (新インフラ前倒し回避、ops トラックに残す) |
| refresh token | DB は **SHA256 digest 保存**。pre-prod ゆえ既存 token 失効＝再ログイン (データ損失許容) |
| token 保管 (frontend) | **access + refresh とも httpOnly cookie**。client JS はトークン非保持 (BFF がトークンを仲介)。XSS でどちらも盗めない。CSRF は **SameSite=Lax** + 全 mutation を非 GET にして対応 |
| #2 `x-user-id` なりすまし | **アプリ対応なし**。ゲートウェイ導入確定のため設計どおり。運用トラックに 2 要件記録 (下記) |
| rate-limiter 構造 | DB カウンタ判定を専用モジュールに閉じ、将来 Redis 移行を局所化 |
| 既定値 | コード試行 5 / ログイン試行 5・ロック 15 分 / SMS 送信 60秒1・日5 / refresh TTL 30 日 |

## A. SMS / 検証コード hardening (backend)

### Schema (migration)
`identity__sms_verifications` に追加:
- `consumed_at timestamptz NULL` — register/reset で token を消費した時刻
- `failed_attempts integer NOT NULL DEFAULT 0` — 誤コード入力回数

relation `SmsVerifications` に 2 属性追加。

### `SendCode` 改訂
1. **rate limit**: 同 phone_number の直近 sms_verifications を見て、最終送信が 60 秒以内なら拒否 (`Sms::RateLimitError` 等)、過去 24h に 5 件以上なら拒否。
2. **旧コード無効化**: 新コード作成前に、同 phone の未消費 (`consumed_at IS NULL`) 行を削除する。
3. (既存) ランダム 6 桁生成 → create → `Sms.send`。

### `VerifyCode` 改訂
- `verification.code != code` を **timing-safe 比較** (`Rack::Utils.secure_compare`) に。
- 不一致時: `failed_attempts += 1`。`failed_attempts >= 5` で当該行を無効化 (expire or 削除) し `VerificationError, "Too many attempts"`。
- 成功時: 現状どおり `mark_as_verified`。

### `Register` / `ResetPassword` 改訂 (token 単回使用)
- token 検証に `consumed_at.nil?` を追加 (verified かつ未消費)。
- 成功時に `consumed_at = now` を打つ → replay 遮断。
- repo に `mark_as_consumed(id)` 追加。

## B. ログイン hardening (backend)

### Schema (migration)
`identity__users` に追加:
- `failed_login_attempts integer NOT NULL DEFAULT 0`
- `locked_until timestamptz NULL`

relation `Users` に 2 属性追加。

### `Login` 改訂
- 開始時: `user.locked_until` が未来ならロック中として拒否 (汎用エラー、enumeration 回避のため "invalid credentials" 同等)。
- password 不一致: `failed_login_attempts += 1`、5 回で `locked_until = now + 15min`。
- 成功: `failed_login_attempts = 0`, `locked_until = nil` にリセット。
- user_repo に `record_failed_login` / `reset_login_attempts` / lock 判定の補助を追加。

### `Register` account enumeration 抑止
- `Sequel::UniqueConstraintViolation` (phone 重複) を捕捉し、汎用 `RegistrationError` に変換 (DB エラー漏れ＝電話番号既存の露出を防ぐ)。

### register_contract / BCrypt
- `MIN_PASSWORD_LENGTH` を **8** に (現状 4)。spec fixture も追従。
- `Register` の `BCrypt::Password.create(password)` を **`cost: 12` 明示**。

## C. refresh token (backend + frontend)

### Schema (migration)
`identity__refresh_tokens`: `token` 列を `token_digest` にリネーム (意味を digest に明確化)。pre-prod ゆえ既存行は失効 (digest と一致しない) ＝再ログイン。

### `RefreshTokenRepository` 改訂
- 内部に `digest(raw) = Digest::SHA256.hexdigest(raw)`。
- `create(token:, ...)`: `token_digest: digest(token)` で保存 (raw token は呼び出し側が保持してクライアントへ返す)。
- `find_by_token(raw)`: `where(token_digest: digest(raw)).one`。
- `revoke(raw)`: `where(token_digest: digest(raw)).delete`。
- → 呼び出し側 (Register/Login/Refresh/Logout) は raw token のまま渡し、ハッシュは repo に隠蔽。

### TTL 短縮
- 発行時の `expires_at` を `Time.now + 3600*24*60` (60日) → **30日** (`Time.now + 3600*24*30`)。Register/Login/Refresh の 3 箇所。rotation は既存。

### httpOnly cookie 化 — full BFF token-mediation (frontend + BFF)
**access + refresh とも httpOnly cookie**にし、**client JS はトークンを一切保持しない**。BFF がトークンを仲介する。

- **cookie 属性**: 両 cookie とも `HttpOnly; Secure; SameSite=Lax; Path=/`。access cookie の Max-Age = access TTL (1h)、refresh cookie = refresh TTL (30日)。SameSite=Lax + 全 mutation を非 GET にすることで cross-site POST に cookie が付かず CSRF を遮断。
- **login/register BFF** (`/api/identity/{sign-in,register}`): gRPC 応答の access + refresh をいずれも **body から除き cookie に set**。body は UI 用 identity (`{ account: { id, role, phoneNumber } }`) のみ返す。
- **認証付き BFF 全般**: client が `Authorization` ヘッダを付けるのをやめ、**BFF が access cookie を読んで gRPC へ `Authorization: Bearer` を組み立てる** (`buildGrpcHeaders` を「cookie から access を読む」方式に変更)。同一オリジンなので cookie は自動送信。
- **transparent refresh**: BFF が gRPC から `UNAUTHENTICATED` を受けたら、refresh cookie で gRPC `RefreshToken` を呼び、新 access (+ rotated refresh) を cookie に再 set して元リクエストを 1 回 retry する。refresh は **BFF 主導** (client 起点でなくなる)。この retry は BFF の共通ヘルパに集約。
- **logout BFF**: 既存 server revoke + access/refresh 両 cookie を clear (Max-Age=0)。
- **`authStore` / `useAuth` / `lib/auth`**:
  - authStore は **トークンを持たない**。UI 用に `userId` / `role` のみ保持し、これは login/register の body または `/api/identity/me` (GetCurrentAccount) から hydrate。`viewerId` は token 有無でなく identity から判定。
  - `getAuthToken` / `authFetch` の `Authorization` 付与ロジックを撤去 (cookie 自動送信に置換)。swr fetcher も同様。
  - 旧 `lib/auth/tokens.ts` の localStorage token 読み書きは撤去 (負の遺産排除)。
  - 未認証判定 (`AppShell` の `viewerId`) は identity ベースに合わせる。
- **CSRF**: SameSite=Lax を基本とし、状態変更は全て POST/PUT/DELETE (GET で mutation しない) を不変条件とする。追加の CSRF token は本 sub-project では不要 (同一オリジン BFF + SameSite=Lax + 非 GET mutation で十分)。

## D. 小修正 (frontend)
- `useAuth.logout`: refresh token 欠落でも logout BFF を呼ぶ (cookie 側で revoke 可能に)。
- `useAuth` の `console.error("...", data)`: response 全体ログを撤去、error type のみ。

## rate-limiter モジュール
DB カウンタ判定 (SMS 送信回数・コード試行・ログイン試行) のロジックは identity slice 内の専用箇所 (use_case のヘルパ or 小モジュール) に集約し、判定閾値を定数化。将来 Redis 化する際の差し替え点を 1 箇所にする。

## スコープ外 (記録のみ)
- **#2 `x-user-id` なりすまし**: ゲートウェイ導入確定により設計どおり。**運用トラック要件**: (1) ゲートウェイが client 由来の `x-user-id` を strip/上書きする、(2) gRPC サービスをゲートウェイ以外から到達不能にする (network policy)。
- Redis 化 (スケール時)。

## Decomposition (実装段)

| 段 | スコープ | 層 |
|---|---|---|
| H1 | sms_verifications migration (consumed_at + failed_attempts) + relation | backend |
| H2 | VerifyCode: timing-safe 比較 + 試行回数制限 (TDD) | backend |
| H3 | Register/ResetPassword: token 単回使用 (consumed_at) (TDD) | backend |
| H4 | SendCode: SMS 送信 rate limit + 旧コード無効化 (TDD) | backend |
| H5 | users migration (failed_login_attempts + locked_until) + relation | backend |
| H6 | Login: brute-force lockout (TDD) + Register enumeration 抑止 + password 最小長 8 + BCrypt cost | backend |
| H7 | refresh_tokens migration (token→token_digest) + repo ハッシュ化 + TTL 30日 (TDD) | backend |
| H8a | BFF token-mediation: login/register/refresh/logout BFF を cookie set/read 化、`buildGrpcHeaders` を access cookie 読み + UNAUTHENTICATED 時 transparent refresh-retry ヘルパに | frontend (BFF) |
| H8b | client 側トークン非保持化: `authStore` を identity-only に、`getAuthToken`/`authFetch`/swr fetcher の Authorization 付与撤去、`lib/auth/tokens.ts` localStorage 撤去、`AppShell` の未認証判定を identity ベースに | frontend |
| H9 | 小修正 (logout always-revoke, console.error PII) + handoff doc 更新 | frontend/docs |

## Verification

```bash
# backend
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate

# frontend
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint   # 0e/0w
env -u NODE_OPTIONS pnpm build
```

成功基準:
- 検証 token は register/reset で 1 回しか使えない (replay が拒否される)。
- コード 5 回誤りで無効化、SMS 送信が rate limit される、ログイン 5 回失敗でロック。
- refresh token は DB に平文で存在しない (digest のみ)。
- **frontend の localStorage に access も refresh も無い** (両方 httpOnly cookie、client JS はトークン非保持)。BFF が cookie を読んで gRPC へ仲介し、access 失効時は transparent refresh-retry。
- password 最小 8 文字、コード比較が timing-safe、register が電話番号既存を漏らさない。
- 既存の identity spec が全 green (閾値変更に追従)。frontend は tsc/lint/build green、login→reload 維持→logout が cookie フローで動く。
