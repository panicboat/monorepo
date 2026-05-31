# Identity Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** identity context を整理する — proto/API の命名を Account に統一、JWT を非対称(RS256)・短 access+長 refresh に、frontend のトークン保持を httpOnly cookie へ移す。認証モデル（電話+SMS OTP+password→JWT+refresh）は踏襲。

**Architecture:** proto rename はモノリスと frontend の両 consumer を壊すため、各ビルドターゲットごとに「自分の stub 再生成＋参照更新」を 1 タスクにまとめて build-green を保つ。JWT は共有 lib（`Auth::JwtCodec`）に集約し RS256 化。frontend は BFF が httpOnly cookie を set/read/refresh/clear し、authStore はトークンを持たず account のみ保持。

**Tech Stack:** proto/buf、Ruby/Hanami/ROM gruf（monolith）、Next 16 BFF/React/Zustand（frontend）、`jwt` gem、ConnectRPC。

**Spec:** `docs/superpowers/specs/2026-05-31-identity-slice-design.md`。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-identity-slice`。branch `feat/identity-slice`。push しない。
- 2 つのビルドターゲット: **monolith**（`services/monolith/workspace`、Ruby）と **frontend**（`services/frontend/workspace`、TS）。stub は別コマンド・別ディレクトリで commit 済み:
  - monolith: `cd services/monolith/workspace && ruby bin/codegen` → `stubs/identity/v1/`
  - frontend: `cd services/frontend/workspace && pnpm proto:gen` → `src/stub/identity/v1/`
- proto は単一共有ファイル `proto/identity/v1/service.proto`。Task 1 で編集し monolith stub のみ再生成、frontend stub の再生成は Task 3 まで遅らせて frontend を green に保つ（その間 proto と frontend stub は drift するが frontend はビルド可能、アプリは再構築中で非機能なので許容）。
- frontend に test framework は無い。検証は `pnpm build`。monolith は RSpec があれば使う（無ければ起動/コンパイル確認）。
- **Deferred（本プラン外）**: DB テーブル `users→accounts` リネーム（relation/repo/FK 列の大カスケード、内部命名で低価値）/ 実 SMS provider（未選定、モック据え置き）。

## File Structure

- Modify: `proto/identity/v1/service.proto` — rename
- Regenerate: `services/monolith/workspace/stubs/identity/v1/*`、`services/frontend/workspace/src/stub/identity/v1/*`
- Modify (monolith): `slices/identity/grpc/handler.rb`、`slices/identity/presenters/{user_presenter.rb→account_presenter.rb, auth_presenter.rb}`、`slices/identity/use_cases/auth/{login,register}.rb`、`slices/identity/use_cases/token/refresh.rb`、`lib/interceptors/authentication_interceptor.rb`
- Create (monolith): `lib/auth/jwt_codec.rb`
- Modify (frontend): `src/stub` 参照箇所 — `src/modules/identity/hooks/useAuth.tsx`、`src/modules/identity/types.ts`、`src/stores/authStore.ts`、`src/lib/api-helpers.ts`、`src/lib/request.ts`、`src/app/api/identity/{sign-in,register,refresh-token,me,logout}/route.ts`

---

## Task 1: proto rename + monolith 参照更新（monolith green）

**Files:** `proto/identity/v1/service.proto`、monolith stubs、handler/presenters/use_cases。

- [ ] **Step 1: proto を rename**

`proto/identity/v1/service.proto` を編集:
- `rpc GetCurrentUser (google.protobuf.Empty) returns (UserProfile);` → `rpc GetCurrentAccount (google.protobuf.Empty) returns (Account);`
- `message UserProfile { ... }` → `message Account { ... }`（中身 id/phone_number/role は不変）
- `RegisterResponse` と `LoginResponse` の `UserProfile user_profile = 2;` → `Account account = 2;`

- [ ] **Step 2: monolith stub を再生成**

Run: `cd services/monolith/workspace && ruby bin/codegen`
Expected: `✅ Done.`。`stubs/identity/v1/service_pb.rb` / `service_services_pb.rb` に `Account` / `GetCurrentAccount` が反映。

- [ ] **Step 3: handler を更新**

`slices/identity/grpc/handler.rb`:
- `rpc :GetCurrentUser, ::Google::Protobuf::Empty, ::Identity::V1::UserProfile` → `rpc :GetCurrentAccount, ::Google::Protobuf::Empty, ::Identity::V1::Account`
- `def get_current_user` → `def get_current_account`（本体はそのまま）
- 末尾 private の `UserPresenter = Identity::Presenters::UserPresenter` → `AccountPresenter = Identity::Presenters::AccountPresenter`、`def register`/`def login` 内の `UserPresenter.role_enum_to_int` → `AccountPresenter.role_enum_to_int`、`get_current_account` 内 `UserPresenter.to_proto` → `AccountPresenter.to_proto`

- [ ] **Step 4: presenter を rename/更新**

`slices/identity/presenters/user_presenter.rb` を `account_presenter.rb` にリネームし、クラス名 `UserPresenter`→`AccountPresenter`、`::Identity::V1::UserProfile.new(...)`→`::Identity::V1::Account.new(...)`。role 変換メソッドは不変。

```bash
cd services/monolith/workspace && git mv slices/identity/presenters/user_presenter.rb slices/identity/presenters/account_presenter.rb
```

`account_presenter.rb`:
```ruby
# frozen_string_literal: true

module Identity
  module Presenters
    class AccountPresenter
      def self.to_proto(account)
        return nil unless account

        ::Identity::V1::Account.new(
          id: account[:id],
          phone_number: account[:phone_number],
          role: role_int_to_enum(account[:role])
        )
      end

      def self.role_int_to_enum(role_int)
        case role_int
        when 2 then :ROLE_CAST
        else :ROLE_GUEST
        end
      end

      def self.role_enum_to_int(role_enum)
        case role_enum
        when :ROLE_CAST, 2 then 2
        when :ROLE_GUEST, 1 then 1
        else nil
        end
      end
    end
  end
end
```

`slices/identity/presenters/auth_presenter.rb` の `user_profile:` フィールドと参照を `account:` に、`UserPresenter`→`AccountPresenter`:
```ruby
# frozen_string_literal: true

module Identity
  module Presenters
    class AuthPresenter
      def self.to_register_response(result)
        ::Identity::V1::RegisterResponse.new(
          access_token: result[:access_token],
          refresh_token: result[:refresh_token],
          account: AccountPresenter.to_proto(result[:account])
        )
      end

      def self.to_login_response(result)
        ::Identity::V1::LoginResponse.new(
          access_token: result[:access_token],
          refresh_token: result[:refresh_token],
          account: AccountPresenter.to_proto(result[:account])
        )
      end

      def self.to_refresh_response(result)
        ::Identity::V1::RefreshTokenResponse.new(
          access_token: result[:access_token],
          refresh_token: result[:refresh_token]
        )
      end
    end
  end
end
```

`slices/identity/grpc/handler.rb` の `AuthPresenter = Identity::Presenters::AuthPresenter` は不変。

- [ ] **Step 5: use_cases の返り値キーを `account` に**

`slices/identity/use_cases/auth/login.rb` 末尾の戻り値:
`{ access_token: token, refresh_token: refresh_token, user_profile: { id: user.id, phone_number: user.phone_number, role: user.role } }`
→ `user_profile:` を `account:` に変更。

`slices/identity/use_cases/auth/register.rb` 末尾も同様に `user_profile:`→`account:`。

（`token/refresh.rb` は account を返さないため変更なし。）

- [ ] **Step 6: monolith をビルド/起動確認してコミット**

Run: `cd services/monolith/workspace && bundle exec ruby -e "require './config/app'" 2>&1 | tail -5`（または既存の boot/spec コマンド）
Expected: ロードエラーなし（未定義定数 `UserProfile`/`UserPresenter` が無いこと）。

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git add proto/identity/v1/service.proto services/monolith/workspace/stubs/identity/v1 services/monolith/workspace/slices/identity
git commit -s -m "refactor(identity): rename UserProfile→Account, GetCurrentUser→GetCurrentAccount (monolith)"
```

---

## Task 2: monolith JWT を RS256 に集約（monolith green）

**Files:** Create `lib/auth/jwt_codec.rb`、Modify `slices/identity/use_cases/auth/{login,register}.rb`・`token/refresh.rb`・`lib/interceptors/authentication_interceptor.rb`。

- [ ] **Step 1: JwtCodec を作成（鍵管理・RS256 を集約）**

Create `services/monolith/workspace/lib/auth/jwt_codec.rb`:

```ruby
# frozen_string_literal: true

require "jwt"
require "openssl"

module Auth
  # 非対称(RS256) JWT の署名・検証を集約する。
  # 署名鍵は ENV で必須（未設定なら起動時 fail-fast）。検証は公開鍵で行い、
  # 将来 Gateway/多サービスが公開鍵だけで検証できるようにする。
  module JwtCodec
    ACCESS_TTL = 3600 # 1h

    module_function

    def private_key
      @private_key ||= OpenSSL::PKey::RSA.new(ENV.fetch("JWT_PRIVATE_KEY"))
    end

    def public_key
      @public_key ||= OpenSSL::PKey::RSA.new(ENV.fetch("JWT_PUBLIC_KEY"))
    end

    def encode(sub:, role:)
      now = Time.now.to_i
      payload = { sub: sub, role: role, iat: now, exp: now + ACCESS_TTL }
      JWT.encode(payload, private_key, "RS256")
    end

    # 検証して sub を返す。不正なら nil。
    def decode_sub(token)
      payload = JWT.decode(token, public_key, true, algorithm: "RS256").first
      payload["sub"]
    rescue JWT::DecodeError
      nil
    end
  end
end
```

- [ ] **Step 2: login/register/refresh を JwtCodec 経由に**

`slices/identity/use_cases/auth/login.rb`: 先頭 `require 'jwt'` を `require "auth/jwt_codec"` に置換。署名 3 行
```ruby
payload = { sub: user.id, role: user.role, exp: Time.now.to_i + 3600 * 24 * 30 }
# FALLBACK: ...
token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')
```
を
```ruby
token = Auth::JwtCodec.encode(sub: user.id, role: user.role)
```
に置換。さらに refresh の寿命を 60 日に:
`refresh_repo.create(token: refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)` の `30`→`60`。

`slices/identity/use_cases/auth/register.rb`: 同様に署名を `Auth::JwtCodec.encode(sub: user.id, role: user.role)` に、refresh expires_at の `30`→`60`、先頭 require を差し替え。

`slices/identity/use_cases/token/refresh.rb`: 同様に `new_access_token = Auth::JwtCodec.encode(sub: user.id, role: user.role)`、`expires_at: Time.now + 3600 * 24 * 60`、`require 'jwt'`→`require "auth/jwt_codec"`。

- [ ] **Step 3: interceptor を RS256 検証に**

`lib/interceptors/authentication_interceptor.rb` の `extract_user_id` の Case 2（JWT 検証）を JwtCodec に委譲:
```ruby
      # Case 2: Direct JWT (App / BFF)
      if (token = request.metadata['authorization']&.sub('Bearer ', ''))
        return Auth::JwtCodec.decode_sub(token)
      end
```
先頭に `require "auth/jwt_codec"` を追加し、`require 'jwt'` は不要なら削除。Case 1（`x-user-id` gateway offload）は維持。

- [ ] **Step 4: 鍵を用意して boot 確認、コミット**

RS256 鍵ペアを生成し env に設定（dev 用、リポジトリにコミットしない）:
```bash
openssl genpkey -algorithm RSA -pkcs8 -out /tmp/jwt_dev_private.pem 2>/dev/null
openssl rsa -in /tmp/jwt_dev_private.pem -pubout -out /tmp/jwt_dev_public.pem 2>/dev/null
export JWT_PRIVATE_KEY="$(cat /tmp/jwt_dev_private.pem)"
export JWT_PUBLIC_KEY="$(cat /tmp/jwt_dev_public.pem)"
```
Run: monolith を起動し register→login→getCurrentAccount が通ること（既存の起動/テスト手順）。鍵未設定だと `KeyError`（fail-fast）になることも確認。

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/services/monolith/workspace
git add lib/auth/jwt_codec.rb lib/interceptors/authentication_interceptor.rb slices/identity/use_cases
git commit -s -m "feat(identity): sign JWT with RS256 via shared JwtCodec, 1h access / 60d refresh"
```

> 注: `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` は deploy 環境の secret に設定する（README/インフラ別途）。fallback secret は廃止済み。

---

## Task 3: frontend stub 再生成 + 参照更新（frontend green、トークンは現状維持）

**Files:** frontend stub、`src/modules/identity/types.ts`、`useAuth.tsx`、BFF routes（命名のみ）。このタスクでは挙動を変えず、`Account`/`getCurrentAccount`/`account` への追随だけ行う。

- [ ] **Step 1: frontend stub を再生成**

Run: `cd services/frontend/workspace && pnpm proto:gen`
Expected: `src/stub/identity/v1/service_pb.ts` に `Account` / `getCurrentAccount` / `RegisterResponse.account` 反映。

- [ ] **Step 2: 参照を Account 系へ更新**

`src/modules/identity/types.ts` の `AuthResponse.userProfile` を `account` に rename（型 shape は同じ id/phoneNumber/role）。

`src/modules/identity/hooks/useAuth.tsx`:
- `register`/`login` 内の `data.userProfile.role` → `data.account.role`、`data.userProfile.id` → `data.account.id`、`mutate({ id: data.userProfile.id, phoneNumber: data.userProfile.phoneNumber, role: userRole })` の `userProfile`→`account`。

`src/app/api/identity/me/route.ts`: `identityClient.getCurrentUser(...)` → `identityClient.getCurrentAccount(...)`。

BFF の sign-in/register route は `identityClient.login/register` の戻り値をそのまま `NextResponse.json(response)` で返しているため、`user_profile`→`account` のフィールド名変化は client 側（上記 useAuth）の追随で吸収される。

- [ ] **Step 3: build 確認・コミット**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 型エラーなし（`getCurrentUser`/`userProfile` の未解決参照が無い）。

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git add services/frontend/workspace/src/stub/identity services/frontend/workspace/src/modules/identity services/frontend/workspace/src/app/api/identity/me
git commit -s -m "refactor(identity): follow Account/getCurrentAccount rename (frontend)"
```

---

## Task 4: frontend を httpOnly cookie 認証へ移行（frontend green）

**Files:** `src/app/api/identity/{sign-in,register,refresh-token,me,logout}/route.ts`、`src/lib/request.ts`、`src/lib/api-helpers.ts`、`src/stores/authStore.ts`、`src/modules/identity/hooks/useAuth.tsx`。

方針: BFF が `access`/`refresh` を httpOnly cookie で管理。client（useAuth/authStore）はトークンを持たず、`/api/identity/me` で account を得る。401 時は `/api/identity/refresh-token`（body 不要、BFF が refresh cookie を使用）→ 再取得。

- [ ] **Step 1: cookie ヘルパを用意**

`src/lib/request.ts` に追記（BFF 内で incoming cookie の access を gRPC Authorization に載せる）:
```ts
import { cookies } from "next/headers";

export const COOKIE_ACCESS = "id_access";
export const COOKIE_REFRESH = "id_refresh";

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setAuthCookies(
  res: import("next/server").NextResponse,
  accessToken: string,
  refreshToken: string
) {
  res.cookies.set(COOKIE_ACCESS, accessToken, { ...COOKIE_BASE, maxAge: 60 * 60 });
  res.cookies.set(COOKIE_REFRESH, refreshToken, { ...COOKIE_BASE, maxAge: 60 * 60 * 24 * 60 });
}

export async function clearAuthCookies(res: import("next/server").NextResponse) {
  res.cookies.set(COOKIE_ACCESS, "", { ...COOKIE_BASE, maxAge: 0 });
  res.cookies.set(COOKIE_REFRESH, "", { ...COOKIE_BASE, maxAge: 0 });
}

export async function buildGrpcHeadersFromCookies(): Promise<Record<string, string>> {
  const store = await cookies();
  const headers: Record<string, string> = { [HEADER_NAMES.REQUEST_ID]: generateRequestId() };
  const access = store.get(COOKIE_ACCESS)?.value;
  if (access) headers[HEADER_NAMES.AUTHORIZATION] = `Bearer ${access}`;
  return headers;
}
```

- [ ] **Step 2: sign-in / register を cookie set + account 返却に**

`src/app/api/identity/sign-in/route.ts`（register も同型）: gRPC 応答からトークンを cookie に積み、body には account のみ返す。
```ts
import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeadersFromCookies, setAuthCookies } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, password, role } = (await req.json()) as {
      phoneNumber: string; password: string; role: number;
    };
    const r = await identityClient.login(
      { phoneNumber, password, role },
      { headers: await buildGrpcHeadersFromCookies() }
    );
    const res = NextResponse.json({ account: r.account });
    await setAuthCookies(res, r.accessToken, r.refreshToken);
    return res;
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.UNAUTHENTICATED) {
      return NextResponse.json({ error: "電話番号または認証コードが正しくありません" }, { status: 401 });
    }
    return handleApiError(error, "Login");
  }
}
```
register route も同様に `identityClient.register(...)` → `setAuthCookies` → `NextResponse.json({ account: r.account })`。

- [ ] **Step 3: me / refresh-token / logout を cookie ベースに**

`me/route.ts`: cookie から access を載せて `getCurrentAccount`。`requireAuth` は cookie 判定へ（Step 5）。
```ts
const res = await identityClient.getCurrentAccount({}, { headers: await buildGrpcHeadersFromCookies() });
return NextResponse.json(res);
```

`refresh-token/route.ts`: body ではなく refresh cookie を使う。
```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { identityClient } from "@/lib/grpc";
import { COOKIE_REFRESH, setAuthCookies, clearAuthCookies, generateRequestId, HEADER_NAMES } from "@/lib/request";

export async function POST(_req: NextRequest) {
  const refreshToken = (await cookies()).get(COOKIE_REFRESH)?.value;
  if (!refreshToken) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  try {
    const r = await identityClient.refreshToken(
      { refreshToken },
      { headers: { [HEADER_NAMES.REQUEST_ID]: generateRequestId() } }
    );
    const res = NextResponse.json({ ok: true });
    await setAuthCookies(res, r.accessToken, r.refreshToken);
    return res;
  } catch {
    const res = NextResponse.json({ error: "セッションが切れました" }, { status: 401 });
    await clearAuthCookies(res);
    return res;
  }
}
```

`logout/route.ts`: refresh cookie で revoke し cookie を clear。
```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { identityClient } from "@/lib/grpc";
import { COOKIE_REFRESH, clearAuthCookies, generateRequestId, HEADER_NAMES } from "@/lib/request";

export async function POST(_req: NextRequest) {
  const refreshToken = (await cookies()).get(COOKIE_REFRESH)?.value;
  if (refreshToken) {
    try {
      await identityClient.logout({ refreshToken }, { headers: { [HEADER_NAMES.REQUEST_ID]: generateRequestId() } });
    } catch { /* SILENT: logout は失敗しても cookie を消す */ }
  }
  const res = NextResponse.json({ ok: true });
  await clearAuthCookies(res);
  return res;
}
```

- [ ] **Step 4: requireAuth を cookie 判定に**

`src/lib/api-helpers.ts` の `requireAuth`:
```ts
import { cookies } from "next/headers";
import { COOKIE_ACCESS } from "./request";

export async function requireAuth(): Promise<NextResponse | null> {
  const has = (await cookies()).get(COOKIE_ACCESS)?.value;
  if (!has) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  return null;
}
```
（呼び出し側は `await requireAuth()`。）

- [ ] **Step 5: authStore を account-only に**

`src/stores/authStore.ts` を全置換（トークンを持たず account のみ、localStorage 廃止）:
```ts
import { create } from "zustand";

export type Role = "guest" | "cast";

export interface Account {
  id: string;
  role: Role;
}

interface AuthState {
  account: Account | null;
  setAccount: (a: Account | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  account: null,
  setAccount: (account) => set({ account }),
}));

export const selectAccount = (s: AuthState) => s.account;
```

- [ ] **Step 6: useAuth を cookie ベースに刷新**

`src/modules/identity/hooks/useAuth.tsx` を cookie ベースへ:
- トークン関連（`selectAccessToken`/`setTokens`/`clearTokens`/`refreshTokenFromStore`/`Authorization` ヘッダ送信/localStorage hydration）を撤去。
- `/api/identity/me` を `fetch(url, { credentials: "same-origin" })` で取得（cookie 自動送信）。401 → `POST /api/identity/refresh-token`（body 不要）→ 成功なら再取得、失敗ならログアウト状態。
- `register`/`login` は cookie が BFF で set されるので、応答の `account` で SWR cache を満たし遷移するだけ（トークンを store に入れない）。
- `logout` は `POST /api/identity/logout` 後、SWR を null に。
- `toStoreRole` は維持（role enum→"guest"/"cast"）。

```tsx
"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

export type User = { id: string; name: string; isGuest: boolean; role: number | string; isNew?: boolean };

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  requestSMS: (phoneNumber: string) => Promise<boolean>;
  verifySMS: (phoneNumber: string, code: string) => Promise<string>;
  register: (phoneNumber: string, password: string, verificationToken: string, role?: number) => Promise<void>;
  login: (phoneNumber: string, password: string, role?: number) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authFetcher = async (url: string) => {
  let res = await fetch(url, { credentials: "same-origin" });
  if (res.status === 401) {
    const r = await fetch("/api/identity/refresh-token", { method: "POST", credentials: "same-origin" });
    if (!r.ok) return null;
    res = await fetch(url, { credentials: "same-origin" });
  }
  return res.ok ? res.json() : null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [newUserFlag, setNewUserFlag] = useState(false);
  const router = useRouter();
  const { data: account, isLoading: swrLoading, mutate } = useSWR("/api/identity/me", authFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  const user: User | null = account
    ? { id: account.id, name: account.phoneNumber, isGuest: account.role === 1 || account.role === "ROLE_GUEST", role: account.role, isNew: newUserFlag }
    : null;

  const requestSMS = useCallback(async (phoneNumber: string) => {
    const res = await fetch("/api/identity/send-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber }) });
    if (!res.ok) throw new Error("SMSの送信に失敗しました");
    return true;
  }, []);

  const verifySMS = useCallback(async (phoneNumber: string, code: string) => {
    const res = await fetch("/api/identity/verify-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, code }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "認証コードの検証に失敗しました");
    return data.verificationToken;
  }, []);

  const afterAuth = useCallback(async (account: { id: string; phoneNumber: string; role: number | string }, isNew: boolean) => {
    setNewUserFlag(isNew);
    await mutate(account, { revalidate: false });
    const isGuest = account.role === 1 || account.role === "ROLE_GUEST";
    if (isNew) router.push(isGuest ? "/onboarding" : "/cast/onboarding");
    else router.push(isGuest ? "/" : "/cast/home");
  }, [mutate, router]);

  const register = useCallback(async (phoneNumber: string, password: string, verificationToken: string, role = 1) => {
    const res = await fetch("/api/identity/register", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ phoneNumber, password, verificationToken, role }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");
    await afterAuth(data.account, true);
  }, [afterAuth]);

  const login = useCallback(async (phoneNumber: string, password: string, role?: number) => {
    const res = await fetch("/api/identity/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ phoneNumber, password, role }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ログインに失敗しました");
    await afterAuth(data.account, false);
  }, [afterAuth]);

  const logout = useCallback(async () => {
    const role = account?.role;
    try { await fetch("/api/identity/logout", { method: "POST", credentials: "same-origin" }); } catch { /* SILENT */ }
    await mutate(null, { revalidate: false });
    router.push(role === 2 || role === "ROLE_CAST" ? "/cast/login" : "/login");
  }, [account, mutate, router]);

  return (
    <AuthContext.Provider value={{ user, isLoading: swrLoading, requestSMS, verifySMS, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
```

> 注: BFF の sign-in/register は `account`（id/phoneNumber/role）を返すよう Step 2 で実装済み。`me` は `getCurrentAccount` の `Account`（id/phoneNumber/role）を返す。SWR の cache 形に合わせる。

- [ ] **Step 7: build 確認・コミット**

Run: `cd services/frontend/workspace && pnpm build`
Expected: 型エラーなし。`@/stores/authStore` の旧 selector（`selectAccessToken` 等）を参照する箇所が他に無いか `grep -rn "selectAccessToken\|setTokens\|clearTokens" src/` で確認し、残っていれば除去（presentation は Phase 1a で撤去済みのため基本は無いはず）。

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/services/frontend/workspace
git add src/lib/request.ts src/lib/api-helpers.ts src/stores/authStore.ts src/modules/identity/hooks/useAuth.tsx src/app/api/identity
git commit -s -m "feat(identity): move auth tokens to httpOnly cookies, drop localStorage"
```

---

## Deferred（本プラン外）

- **DB テーブル `users→accounts` リネーム**: relation `Accounts` / repository `AccountRepository` / `Identity::Deps` キー / `refresh_tokens.user_id`→`account_id` 列 / 変数名の大カスケード。内部命名で低価値のため別プラン。API/contract は本プランで Account に統一済み。
- **実 SMS provider**: provider 未選定。モック（`"0000"`）据え置き。選定後に `send_code` 実装を差し替え。
- **cast 年齢/本人確認**: 別 spec + 法務 hard gate。

## Self-Review（作成者チェック済）

- **Spec coverage**: 命名整理=Account(Task1/3) / RS256・短access・長refresh(Task2) / httpOnly cookie・authStore account化(Task4) を網羅。handle=profile・table rename・SMS は spec で deferred 明記済み。
- **build-green 順**: monolith（Task1-2）と frontend（Task3-4）は別ターゲット。proto 編集後 frontend stub 再生成を Task3 まで遅らせ、各 commit でビルド green。
- **型/命名整合**: proto `Account`/`account`/`GetCurrentAccount` ↔ monolith presenter/handler/use_cases ↔ frontend stub/useAuth/me で一貫。`AccountPresenter` rename は handler の 3 参照すべて更新。JwtCodec の `encode(sub:, role:)`/`decode_sub` を 3 use_cases + interceptor が一致して使用。cookie 名 `id_access`/`id_refresh` は set/read/clear/refresh で一致。
- **Placeholder**: なし。実 SMS/table rename は意図的 deferred。
