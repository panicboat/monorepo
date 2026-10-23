# Profile P5a: frontend data layer (BFF + client + hooks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** frontend に profile の**データ層**を追加する: `profileClient`（connect-es）+ BFF route handlers（own / by-username / save / media / username-check / areas）+ `ProfileView` 型 + mappers + SWR hooks。UI（ページ/フォーム）は含まない。

**Architecture:** **Additive、build-green**。新 ProfileService（profile/v1）を消費する純粋な配線。旧 `portfolio` モジュール・cast/guest BFF route は触らない。connect-node client は server 専用（route handler）、hooks は `"use client"` で BFF route を `authFetch`/SWR で叩く（既存パターン踏襲）。UI は P5b/P5c（フォーム部品・編集ページ・公開ページ）。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / connect-es（`@connectrpc/connect` + `@connectrpc/connect-node`）/ SWR / pnpm。

**Spec:** `docs/superpowers/specs/2026-06-02-profile-slice-design.md`（§API contract / §Frontend）。前提: P1（profile/v1 TS stub 生成済）・P4（backend ProfileService 実装済）。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。frontend app root: `services/frontend/workspace`。branch `feat/profile-slice`。**push しない・PR 作らない**。
- 検索は **`/usr/bin/grep`** / `/usr/bin/find`。import alias `@/` → `src/`。
- **テストランナーは無い**（`package.json` に test script 無し、vitest/jest 無し、test ファイル 0）。検証は **`pnpm build`（= next build の型チェック）+ `pnpm lint`**、各タスクの途中確認は **`pnpm exec tsc --noEmit`**。ユニットテストランナーは**追加しない**（未依頼の依存追加を避ける。mapper は純関数で型チェックが主担保）。
- `pnpm build` は backend/DB を必要としない（型チェック + バンドルのみ。route は実行されない）。
- **build-green / additive**: 旧 `src/modules/portfolio/*`・`src/app/api/cast/*`・`src/app/api/guest/*`・`src/lib/grpc.ts` の既存 export は触らない（`grpc.ts` は 1 client を**追記**するのみ）。

### 既存パターン（探索で確定、踏襲する）

- **gRPC client**（`src/lib/grpc.ts`）: connect-es。`createGrpcTransport({ baseUrl: process.env.MONOLITH_URL || "http://localhost:9001" })` を共有し `createClient(Service, transport)`。
- **BFF route**: `requireAuth(req)`（`Authorization` ヘッダ無しで 401）→ `buildGrpcHeaders(req.headers)`（Bearer + X-Request-ID を透過、**cookie ではない**）→ `client.method(init, { headers })` → proto を view にマップして `NextResponse.json` → `catch` で `isConnectError`/`GrpcCode.NOT_FOUND` 個別処理 + `handleApiError(error, "Ctx")`。
- **dynamic route param は async**: `{ params }: { params: Promise<{ username: string }> }` → `const { username } = await params;`（Next 16）。
- **SWR hook**: `"use client"`、`getAuthToken()` でトークン有無を判定し SWR key を条件付き（無ければ `null`）、`fetcher`（`@/lib/swr`）で GET。mutation は `authFetch`（`@/lib/auth/fetch`、`{ method, body }`）→ `mutate`。
- **stub フィールド（camelCase、確定）**: `Profile{accountId,username,displayName,bio,avatarMediaId,avatarUrl,coverMediaId,coverUrl,website,snsLinks?,prefecture,isPrivate,registeredAt,age,heightCm,cupSize,industry,areas[],shopId}`、`SnsLinks{x,instagram,tiktok,bluesky,line}`、`Area{id,region,prefecture,name,code}`、`SaveProfileRequest{username,displayName,bio,website,snsLinks,prefecture,isPrivate,age,heightCm,cupSize,industry,areaIds[],shopId}`、`CheckUsernameAvailabilityResponse{available,message}`、`SaveProfileMediaRequest{avatarMediaId,coverMediaId}`、`ListAreasRequest{prefecture}` / `ListAreasResponse{areas[]}`。RPC は camelCase（`getProfile` / `getProfileByUsername` / `saveProfile` / `checkUsernameAvailability` / `saveProfileMedia` / `listAreas`）。

## File Structure

- Modify: `src/lib/grpc.ts`（`profileClient` 追記）
- Create: `src/modules/profile/types.ts`
- Create: `src/modules/profile/lib/mappers.ts`
- Create: `src/app/api/profile/route.ts`（GET own + PUT save）
- Create: `src/app/api/profile/by-username/[username]/route.ts`（GET public）
- Create: `src/app/api/profile/media/route.ts`（POST）
- Create: `src/app/api/profile/username-check/route.ts`（GET）
- Create: `src/app/api/areas/route.ts`（GET）
- Create: `src/modules/profile/hooks/{useProfile,usePublicProfile,useAreas,useUsernameCheck,index}.ts`

> route 衝突回避: 公開プロフィールは `/api/profile/by-username/[username]` に置く（`/api/profile/media`・`/api/profile/username-check` と同階層の dynamic segment を作らない）。

---

## Task 1: client 追加 + 型 + mappers

**Files:** Modify `src/lib/grpc.ts`; Create `src/modules/profile/types.ts`, `src/modules/profile/lib/mappers.ts`。

- [ ] **Step 1: `src/lib/grpc.ts` に profileClient を追記**

import 群の末尾（`TrustService` import の下）に追加:

```ts
import { ProfileService } from "@/stub/profile/v1/service_pb";
```

client export 群の末尾に追加:

```ts
// Profile domain client
export const profileClient = createClient(ProfileService, transport);
```

- [ ] **Step 2: `src/modules/profile/types.ts` を作成**

```ts
export interface SnsLinksView {
  x: string;
  instagram: string;
  tiktok: string;
  bluesky: string;
  line: string;
}

export interface AreaView {
  id: string;
  region: string;
  prefecture: string;
  name: string;
  code: string;
}

export interface ProfileView {
  accountId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarMediaId: string;
  avatarUrl: string;
  coverMediaId: string;
  coverUrl: string;
  website: string;
  snsLinks: SnsLinksView;
  prefecture: string;
  isPrivate: boolean;
  registeredAt: string;
  age: number;
  heightCm: number;
  cupSize: string;
  industry: string;
  areas: AreaView[];
  shopId: string;
}

export interface SaveProfilePayload {
  username?: string;
  displayName: string;
  bio?: string;
  website?: string;
  snsLinks?: Partial<SnsLinksView>;
  prefecture?: string;
  isPrivate?: boolean;
  age?: number;
  heightCm?: number;
  cupSize?: string;
  industry?: string;
  areaIds?: string[];
  shopId?: string;
}

export interface SaveProfileMediaPayload {
  avatarMediaId?: string;
  coverMediaId?: string;
}

export interface UsernameAvailability {
  available: boolean;
  message: string;
}
```

- [ ] **Step 3: `src/modules/profile/lib/mappers.ts` を作成**

```ts
import type { Profile, Area, SnsLinks } from "@/stub/profile/v1/service_pb";
import type {
  AreaView,
  ProfileView,
  SaveProfilePayload,
  SnsLinksView,
} from "@/modules/profile/types";

const EMPTY_SNS: SnsLinksView = { x: "", instagram: "", tiktok: "", bluesky: "", line: "" };

function mapSnsLinks(s: SnsLinks | undefined): SnsLinksView {
  if (!s) return { ...EMPTY_SNS };
  return {
    x: s.x || "",
    instagram: s.instagram || "",
    tiktok: s.tiktok || "",
    bluesky: s.bluesky || "",
    line: s.line || "",
  };
}

export function mapAreaToView(a: Area): AreaView {
  return {
    id: a.id,
    region: a.region || "",
    prefecture: a.prefecture || "",
    name: a.name || "",
    code: a.code || "",
  };
}

export function mapProfileToView(p: Profile): ProfileView {
  return {
    accountId: p.accountId,
    username: p.username || "",
    displayName: p.displayName || "",
    bio: p.bio || "",
    avatarMediaId: p.avatarMediaId || "",
    avatarUrl: p.avatarUrl || "",
    coverMediaId: p.coverMediaId || "",
    coverUrl: p.coverUrl || "",
    website: p.website || "",
    snsLinks: mapSnsLinks(p.snsLinks),
    prefecture: p.prefecture || "",
    isPrivate: p.isPrivate,
    registeredAt: p.registeredAt || "",
    age: p.age || 0,
    heightCm: p.heightCm || 0,
    cupSize: p.cupSize || "",
    industry: p.industry || "",
    areas: (p.areas || []).map(mapAreaToView),
    shopId: p.shopId || "",
  };
}

export function buildSaveProfileRequest(payload: SaveProfilePayload) {
  const sns = payload.snsLinks;
  return {
    username: payload.username || "",
    displayName: payload.displayName,
    bio: payload.bio || "",
    website: payload.website || "",
    snsLinks: {
      x: sns?.x || "",
      instagram: sns?.instagram || "",
      tiktok: sns?.tiktok || "",
      bluesky: sns?.bluesky || "",
      line: sns?.line || "",
    },
    prefecture: payload.prefecture || "",
    isPrivate: payload.isPrivate ?? false,
    age: payload.age ?? 0,
    heightCm: payload.heightCm ?? 0,
    cupSize: payload.cupSize || "",
    industry: payload.industry || "",
    areaIds: payload.areaIds || [],
    shopId: payload.shopId || "",
  };
}
```

- [ ] **Step 4: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: profile 関連の新規型エラーなし（`buildSaveProfileRequest` の戻りが `SaveProfileRequest` の init 形と一致。`profileClient` は次タスクで使う）。既存の無関係エラーがある場合は無視（増やさないこと）。

---

## Task 2: BFF route handlers

**Files:** Create 5 route ファイル。

- [ ] **Step 1: `src/app/api/profile/route.ts`（GET own + PUT save）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapProfileToView, buildSaveProfileRequest } from "@/modules/profile/lib/mappers";
import type { SaveProfilePayload } from "@/modules/profile/types";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const res = await profileClient.getProfile({ accountId: "" }, { headers });
    if (!res.profile) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "GetProfile");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = (await req.json()) as SaveProfilePayload;
    const headers = buildGrpcHeaders(req.headers);
    const res = await profileClient.saveProfile(buildSaveProfileRequest(body), { headers });
    if (!res.profile) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    return handleApiError(error, "SaveProfile");
  }
}
```

- [ ] **Step 2: `src/app/api/profile/by-username/[username]/route.ts`（GET public）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapProfileToView } from "@/modules/profile/lib/mappers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { username } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const res = await profileClient.getProfileByUsername({ username }, { headers });
    if (!res.profile) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "プロフィールが見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "GetProfileByUsername");
  }
}
```

- [ ] **Step 3: `src/app/api/profile/media/route.ts`（POST）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapProfileToView } from "@/modules/profile/lib/mappers";
import type { SaveProfileMediaPayload } from "@/modules/profile/types";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = (await req.json()) as SaveProfileMediaPayload;
    const headers = buildGrpcHeaders(req.headers);
    const res = await profileClient.saveProfileMedia(
      { avatarMediaId: body.avatarMediaId || "", coverMediaId: body.coverMediaId || "" },
      { headers }
    );
    if (!res.profile) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    return handleApiError(error, "SaveProfileMedia");
  }
}
```

- [ ] **Step 4: `src/app/api/profile/username-check/route.ts`（GET）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const username = req.nextUrl.searchParams.get("username") || "";
    const headers = buildGrpcHeaders(req.headers);
    const res = await profileClient.checkUsernameAvailability({ username }, { headers });
    return NextResponse.json({ available: res.available, message: res.message });
  } catch (error: unknown) {
    return handleApiError(error, "CheckUsernameAvailability");
  }
}
```

- [ ] **Step 5: `src/app/api/areas/route.ts`（GET）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapAreaToView } from "@/modules/profile/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const prefecture = req.nextUrl.searchParams.get("prefecture") || "";
    const headers = buildGrpcHeaders(req.headers);
    const res = await profileClient.listAreas({ prefecture }, { headers });
    return NextResponse.json({ areas: (res.areas || []).map(mapAreaToView) });
  } catch (error: unknown) {
    return handleApiError(error, "ListAreas");
  }
}
```

- [ ] **Step 6: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: 新規 route の型エラーなし（client メソッド呼び出しの init 形・`params` async が型に合う）。

---

## Task 3: SWR hooks

**Files:** Create `src/modules/profile/hooks/{useProfile,usePublicProfile,useAreas,useUsernameCheck,index}.ts`。

- [ ] **Step 1: `src/modules/profile/hooks/useProfile.ts`**

```ts
"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { fetcher, getAuthToken } from "@/lib/swr";
import { authFetch } from "@/lib/auth/fetch";
import type {
  ProfileView,
  SaveProfilePayload,
  SaveProfileMediaPayload,
} from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

export function useProfile() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
    token ? "/api/profile" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const saveProfile = useCallback(
    async (payload: SaveProfilePayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile", {
        method: "PUT",
        body: payload,
      });
      await mutate(res, { revalidate: false });
      return res.profile;
    },
    [mutate]
  );

  const saveMedia = useCallback(
    async (payload: SaveProfileMediaPayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile/media", {
        method: "POST",
        body: payload,
      });
      await mutate(res, { revalidate: false });
      return res.profile;
    },
    [mutate]
  );

  return {
    profile: data?.profile ?? null,
    loading: isLoading,
    error,
    saveProfile,
    saveMedia,
    mutate,
  };
}
```

- [ ] **Step 2: `src/modules/profile/hooks/usePublicProfile.ts`**

```ts
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { ProfileView } from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

export function usePublicProfile(username: string | null) {
  const token = getAuthToken();
  const { data, error, isLoading } = useSWR<ProfileResponse>(
    token && username ? `/api/profile/by-username/${encodeURIComponent(username)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    profile: data?.profile ?? null,
    loading: isLoading,
    error,
  };
}
```

- [ ] **Step 3: `src/modules/profile/hooks/useAreas.ts`**

```ts
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { AreaView } from "@/modules/profile/types";

interface AreasResponse {
  areas: AreaView[];
}

export function useAreas(prefecture?: string) {
  const key = prefecture
    ? `/api/areas?prefecture=${encodeURIComponent(prefecture)}`
    : "/api/areas";
  const { data, error, isLoading } = useSWR<AreasResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  return {
    areas: data?.areas ?? [],
    loading: isLoading,
    error,
  };
}
```

- [ ] **Step 4: `src/modules/profile/hooks/useUsernameCheck.ts`**

```ts
"use client";

import { authFetch } from "@/lib/auth/fetch";
import type { UsernameAvailability } from "@/modules/profile/types";

export async function checkUsernameAvailability(
  username: string
): Promise<UsernameAvailability> {
  return authFetch<UsernameAvailability>(
    `/api/profile/username-check?username=${encodeURIComponent(username)}`,
    { method: "GET" }
  );
}
```

- [ ] **Step 5: `src/modules/profile/hooks/index.ts`**

```ts
export { useProfile } from "./useProfile";
export { usePublicProfile } from "./usePublicProfile";
export { useAreas } from "./useAreas";
export { checkUsernameAvailability } from "./useUsernameCheck";
```

- [ ] **Step 6: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: 新規 hooks の型エラーなし。

---

## Task 4: build/lint で検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 本番ビルド（型 + バンドル）**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -25`
Expected: 成功。新 route（`/api/profile`, `/api/profile/by-username/[username]`, `/api/profile/media`, `/api/profile/username-check`, `/api/areas`）がビルド出力に現れ、型エラーなし。

- [ ] **Step 2: lint**

Run: `cd services/frontend/workspace && pnpm lint 2>&1 | tail -20`
Expected: 新規ファイルに lint エラーなし。

- [ ] **Step 3: （任意）ルートのスモーク**

backend(monolith gRPC) と有効な JWT があれば: dev サーバ（`pnpm dev`）を起動し `curl -H "Authorization: Bearer <token>" localhost:3000/api/areas` で `{areas:[...]}` が返ることを確認。backend/JWT が無ければ本ステップはスキップ（型チェックが主担保）。

- [ ] **Step 4: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/frontend/workspace
git add src/lib/grpc.ts src/modules/profile src/app/api/profile src/app/api/areas
git commit -s -m "feat(profile): add frontend profile data layer (BFF + client + hooks)"
```
（push しない。）

---

## Deferred（P5a では実施しない）

- **フォーム部品**（Textarea / Select / FormField・Label / 画像アップロード）→ デザインシステムに不足。**P5b**。
- **編集ページ `/profile/edit`**（rx-sns 準拠フォーム: 表示名/username/自己紹介160/場所/website/年齢/身長/カップ/業種/SNS[X,IG,TikTok,Bluesky,LINE]/avatar・cover/鍵アカウント、エリア最大2）→ **P5c**（design + ブラウザ検証）。
- **公開プロフィール `/u/[username]` ページ**・自分のプロフィール表示ページ → **P5d**。
- username availability の debounce / area の階層 UI（地方→都道府県→エリア）等は消費する UI 側（P5c）で。

## Self-Review（作成者チェック済）

- **Spec coverage（P5a 範囲）**: §API の 6 RPC を BFF route + client で配線（own/by-username/save/media/username-check/areas）。§Frontend の「統合 Profile 型 / proto stub 消費 / SWR」をデータ層として実装。UI は明示的に P5b–d へ分離。
- **Additive で build-green**: 旧 portfolio モジュール・cast/guest route は無改変。`grpc.ts` は 1 client 追記のみ。
- **Placeholder 無し**: client/型/mappers/5 route/4 hooks すべて完全コード。
- **型/命名整合**: BFF が返す `{ profile: ProfileView }` / `{ areas: AreaView[] }` / `{ available, message }` を hooks の response interface と一致。`buildSaveProfileRequest` の戻り（camelCase）は `SaveProfileRequest` init と一致。dynamic param は `Promise<{username}>`（Next 16）。route 衝突回避のため公開は `by-username/[username]`。
- **テスト方針**: frontend にランナー無し → `pnpm build`（tsc 型チェック）+ `pnpm lint` を検証本体に。ユニットテストランナーは未依頼のため追加せず（mapper は純関数で型が主担保）。
