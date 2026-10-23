# Social S4: frontend data layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S1-S3 で動いた monolith の `social.v1.FollowService` / `BlockService` (計 14 RPC) に対して、frontend の **types + mappers + 8 hooks + 13 BFF routes** を新規実装する。旧 `relationship` module / BFFs は無改変、cleanup フェーズで一括 drop。これで S5 (UI) が組み立てられる状態にする。

**Architecture:** 新規 `src/modules/social/` (types / lib / hooks) + `src/app/api/social/` (Next.js route handlers)。hooks は SWR で status fetch、mutation は `fetch` + optimistic update。BFFs は既存 `likeClient`/`/api/posts/likes/status` pattern を踏襲 (`requireAuth` + `buildGrpcHeaders` + `handleApiError`)。`followClient` / `blockClient` は S1 で `src/lib/grpc.ts` に追記済。

**Tech Stack:** Next.js 16 App Router / React / TypeScript / SWR / connect-es generated stubs。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` (Frontend 節)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s4-frontend-data`、branch `feat/social-s4-frontend-data` (origin/main = `55676687`、S3 #679 マージ後)。**push しない**。
- 触らない: 旧 `src/modules/relationship/*`、旧 `/api/cast/{blocks,following,followers}`、旧 `/api/guest/following*`、proto、monolith。

### 既存パターン (踏襲)

- BFF route: `src/app/api/posts/[id]/like/route.ts` (POST/DELETE)、`src/app/api/posts/likes/status/route.ts` (GET batch via query)
  - `import { NextRequest, NextResponse } from "next/server"`、`import { likeClient } from "@/lib/grpc"`、`buildGrpcHeaders`、`requireAuth`、`handleApiError`
  - Next 16 path param: `{ params }: { params: Promise<{ id: string }> }`、`const { id } = await params`
- hook (mutation + SWR): `src/modules/relationship/hooks/useFollowRequests.ts`
  - SWR で list + count、`mutate` で optimistic update
- hook (Zustand store + selectors): `src/modules/post/hooks/usePostLike.ts` — 今回は採用しない (社会的 status は per-target / list が主、Zustand 不要)。
- generated stubs: `@/stub/social/v1/{follow_service_pb,block_service_pb}` (S1)
- clients: `import { followClient, blockClient } from "@/lib/grpc"` (S1 で追記済)
- helpers: `@/lib/api-helpers` (`requireAuth`, `handleApiError`)、`@/lib/request` (`buildGrpcHeaders`)、`@/lib/swr` (`fetcher`, `getAuthToken`)、`@/lib/auth` (`authFetch`, `getAuthToken`)

### BFF route 表 (13 routes、14 RPC を Cancel+Unfollow 統合)

| path | method | RPC |
|---|---|---|
| `/api/social/follow` | POST | `Follow` |
| `/api/social/follow` | DELETE | `Unfollow` (`?cancel=1` で `CancelFollowRequest`) |
| `/api/social/follow/status` | POST | `GetFollowStatus` (batch) |
| `/api/social/following` | GET | `ListFollowing` |
| `/api/social/followers` | GET | `ListFollowers` |
| `/api/social/follow/requests` | GET | `ListPendingFollowRequests` |
| `/api/social/follow/requests/count` | GET | `GetPendingFollowCount` |
| `/api/social/follow/requests/[requesterAccountId]/approve` | POST | `ApproveFollowRequest` |
| `/api/social/follow/requests/[requesterAccountId]/reject` | POST | `RejectFollowRequest` |
| `/api/social/blocks` | POST | `Block` |
| `/api/social/blocks` | DELETE | `Unblock` |
| `/api/social/blocks` | GET | `ListBlocked` |
| `/api/social/blocks/status` | POST | `GetBlockStatus` (batch) |

### Hooks 表 (8 hook)

| hook | 用途 |
|---|---|
| `useFollow(targetAccountId)` | 単一 target の status + follow / unfollow / cancelRequest |
| `useBlock(targetAccountId)` | 単一 target の isBlocked + block / unblock |
| `useFollowRequests()` | pending list + count、approve / reject |
| `useFollowList(accountId?)` | cursor pagination (フォロー中) |
| `useFollowerList(accountId?)` | cursor pagination (フォロワー) |
| `useFollowStatusBatch(targetAccountIds)` | 一括 status fetch |
| `useBlockStatusBatch(targetAccountIds)` | 一括 isBlocked fetch |
| `useBlockedList()` | ブロックリスト cursor pagination |

## File Structure

**Module (11 file):**
- Create: `src/modules/social/index.ts` (re-export)
- Create: `src/modules/social/types.ts` (FollowStatusValue / view types)
- Create: `src/modules/social/lib/index.ts` (re-export)
- Create: `src/modules/social/lib/mappers.ts` (proto → view)
- Create: `src/modules/social/hooks/index.ts` (re-export)
- Create: `src/modules/social/hooks/useFollow.ts`
- Create: `src/modules/social/hooks/useBlock.ts`
- Create: `src/modules/social/hooks/useFollowRequests.ts`
- Create: `src/modules/social/hooks/useFollowList.ts`
- Create: `src/modules/social/hooks/useFollowerList.ts`
- Create: `src/modules/social/hooks/useFollowStatusBatch.ts`
- Create: `src/modules/social/hooks/useBlockStatusBatch.ts`
- Create: `src/modules/social/hooks/useBlockedList.ts`

**BFF (13 file):**
- Create: `src/app/api/social/follow/route.ts` (POST + DELETE)
- Create: `src/app/api/social/follow/status/route.ts` (POST batch)
- Create: `src/app/api/social/following/route.ts` (GET)
- Create: `src/app/api/social/followers/route.ts` (GET)
- Create: `src/app/api/social/follow/requests/route.ts` (GET)
- Create: `src/app/api/social/follow/requests/count/route.ts` (GET)
- Create: `src/app/api/social/follow/requests/[requesterAccountId]/approve/route.ts` (POST)
- Create: `src/app/api/social/follow/requests/[requesterAccountId]/reject/route.ts` (POST)
- Create: `src/app/api/social/blocks/route.ts` (POST + DELETE + GET)
- Create: `src/app/api/social/blocks/status/route.ts` (POST batch)

---

## Task 1: types.ts (`src/modules/social/types.ts`)

- [ ] **Step 1: 実装**

```typescript
// Social module types — symmetric account-based follow/block.

import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

export { FollowStatus };

// View shapes returned from BFFs (mapper-translated from profile.v1.Profile proto)
export interface SocialAccountView {
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPrivate: boolean;
}

export type FollowStatusMap = Record<string, FollowStatus>;
export type BlockStatusMap = Record<string, boolean>;

// Cursor-paginated list response (BFF -> hook)
export interface PaginatedProfilesResponse {
  profiles: SocialAccountView[];
  nextCursor: string;
  hasMore: boolean;
}

// pending request item (kept symmetric to ListPendingFollowRequests)
export interface FollowRequestItem {
  requesterAccountId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}
```

---

## Task 2: lib/mappers.ts (`src/modules/social/lib/mappers.ts`)

- [ ] **Step 1: 実装**

```typescript
import type { Profile } from "@/stub/profile/v1/service_pb";
import type {
  SocialAccountView,
  FollowRequestItem,
} from "../types";

export function profileToSocialAccount(p: Profile): SocialAccountView {
  return {
    accountId: p.accountId,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isPrivate: !!p.isPrivate,
  };
}

export function profileToFollowRequestItem(p: Profile): FollowRequestItem {
  return {
    requesterAccountId: p.accountId,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
  };
}
```

---

## Task 3: lib/index.ts + module index.ts (re-exports)

`src/modules/social/lib/index.ts`:

```typescript
export * from "./mappers";
```

`src/modules/social/index.ts`:

```typescript
export * from "./types";
export * from "./lib";
export * from "./hooks";
```

---

## Task 4: BFF — `src/app/api/social/follow/route.ts` (POST + DELETE)

POST: Follow / DELETE: Unfollow か CancelFollowRequest (?cancel=1)。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const targetAccountId = body?.targetAccountId ?? "";
    if (!targetAccountId) {
      return NextResponse.json({ error: "targetAccountId required" }, { status: 400 });
    }
    const res = await followClient.follow({ targetAccountId }, { headers });
    return NextResponse.json({ status: res.status });
  } catch (error: unknown) {
    return handleApiError(error, "Follow");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const targetAccountId = req.nextUrl.searchParams.get("target_account_id") || "";
    const cancel = req.nextUrl.searchParams.get("cancel") === "1";
    if (!targetAccountId) {
      return NextResponse.json({ error: "target_account_id required" }, { status: 400 });
    }
    if (cancel) {
      await followClient.cancelFollowRequest({ targetAccountId }, { headers });
    } else {
      await followClient.unfollow({ targetAccountId }, { headers });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Unfollow");
  }
}
```

---

## Task 5: BFF — `src/app/api/social/follow/status/route.ts` (POST batch)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const targetAccountIds: string[] = Array.isArray(body?.targetAccountIds) ? body.targetAccountIds : [];
    if (targetAccountIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }
    const res = await followClient.getFollowStatus({ targetAccountIds }, { headers });
    return NextResponse.json({ statuses: res.statuses || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetFollowStatus");
  }
}
```

---

## Task 6: BFF — `src/app/api/social/following/route.ts` (GET)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const accountId = req.nextUrl.searchParams.get("account_id") || "";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await followClient.listFollowing({ accountId, limit, cursor }, { headers });
    return NextResponse.json({
      profiles: (res.profiles || []).map(profileToSocialAccount),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListFollowing");
  }
}
```

---

## Task 7: BFF — `src/app/api/social/followers/route.ts` (GET)

Task 6 と同パターン、`followClient.listFollowers` 呼び出し。同じ params、同じ response 整形。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const accountId = req.nextUrl.searchParams.get("account_id") || "";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await followClient.listFollowers({ accountId, limit, cursor }, { headers });
    return NextResponse.json({
      profiles: (res.profiles || []).map(profileToSocialAccount),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListFollowers");
  }
}
```

---

## Task 8: BFF — `src/app/api/social/follow/requests/route.ts` (GET)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToFollowRequestItem } from "@/modules/social";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await followClient.listPendingFollowRequests({ limit, cursor }, { headers });
    return NextResponse.json({
      requests: (res.profiles || []).map(profileToFollowRequestItem),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListPendingFollowRequests");
  }
}
```

---

## Task 9: BFF — `src/app/api/social/follow/requests/count/route.ts` (GET)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const res = await followClient.getPendingFollowCount({}, { headers });
    return NextResponse.json({ count: res.count || 0 });
  } catch (error: unknown) {
    return handleApiError(error, "GetPendingFollowCount");
  }
}
```

---

## Task 10: BFF — approve / reject (`src/app/api/social/follow/requests/[requesterAccountId]/{approve,reject}/route.ts`)

approve:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { followClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requesterAccountId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { requesterAccountId } = await params;
    const headers = buildGrpcHeaders(req.headers);
    await followClient.approveFollowRequest({ requesterAccountId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "ApproveFollowRequest");
  }
}
```

reject: 同形 (`followClient.rejectFollowRequest`、`"RejectFollowRequest"` log tag)。

---

## Task 11: BFF — `src/app/api/social/blocks/route.ts` (POST + DELETE + GET)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const targetAccountId = body?.targetAccountId ?? "";
    if (!targetAccountId) {
      return NextResponse.json({ error: "targetAccountId required" }, { status: 400 });
    }
    await blockClient.block({ targetAccountId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Block");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const targetAccountId = req.nextUrl.searchParams.get("target_account_id") || "";
    if (!targetAccountId) {
      return NextResponse.json({ error: "target_account_id required" }, { status: 400 });
    }
    await blockClient.unblock({ targetAccountId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Unblock");
  }
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await blockClient.listBlocked({ limit, cursor }, { headers });
    return NextResponse.json({
      profiles: (res.profiles || []).map(profileToSocialAccount),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListBlocked");
  }
}
```

---

## Task 12: BFF — `src/app/api/social/blocks/status/route.ts` (POST batch)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { blockClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const targetAccountIds: string[] = Array.isArray(body?.targetAccountIds) ? body.targetAccountIds : [];
    if (targetAccountIds.length === 0) {
      return NextResponse.json({ blocked: {} });
    }
    const res = await blockClient.getBlockStatus({ targetAccountIds }, { headers });
    return NextResponse.json({ blocked: res.blocked || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetBlockStatus");
  }
}
```

---

## Task 13: hook — `useFollow.ts`

`src/modules/social/hooks/useFollow.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

interface FollowResponse { status: FollowStatus }
interface StatusResponse { statuses: Record<string, FollowStatus> }

export function useFollow(targetAccountId: string | null | undefined) {
  const [status, setStatus] = useState<FollowStatus>(FollowStatus.NONE);
  const [loading, setLoading] = useState(false);

  // Initial fetch
  useEffect(() => {
    if (!targetAccountId || !getAuthToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<StatusResponse>(
          "/api/social/follow/status",
          { method: "POST", body: { targetAccountIds: [targetAccountId] } }
        );
        if (cancelled) return;
        setStatus(res.statuses?.[targetAccountId] ?? FollowStatus.NONE);
      } catch (e) {
        console.error("useFollow fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [targetAccountId]);

  const follow = useCallback(async () => {
    if (!targetAccountId || !getAuthToken()) return;
    setLoading(true);
    try {
      const res = await authFetch<FollowResponse>(
        "/api/social/follow",
        { method: "POST", body: { targetAccountId } }
      );
      setStatus(res.status ?? FollowStatus.NONE);
      return res.status;
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  const unfollow = useCallback(async () => {
    if (!targetAccountId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_account_id=${encodeURIComponent(targetAccountId)}`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  const cancelRequest = useCallback(async () => {
    if (!targetAccountId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/follow?target_account_id=${encodeURIComponent(targetAccountId)}&cancel=1`, { method: "DELETE" });
      setStatus(FollowStatus.NONE);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  return {
    status,
    isFollowing: status === FollowStatus.APPROVED,
    isPending: status === FollowStatus.PENDING,
    follow,
    unfollow,
    cancelRequest,
    loading,
  };
}
```

---

## Task 14: hook — `useBlock.ts`

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";

interface StatusResponse { blocked: Record<string, boolean> }

export function useBlock(targetAccountId: string | null | undefined) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetAccountId || !getAuthToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<StatusResponse>(
          "/api/social/blocks/status",
          { method: "POST", body: { targetAccountIds: [targetAccountId] } }
        );
        if (cancelled) return;
        setIsBlocked(!!res.blocked?.[targetAccountId]);
      } catch (e) {
        console.error("useBlock fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [targetAccountId]);

  const block = useCallback(async () => {
    if (!targetAccountId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch("/api/social/blocks", { method: "POST", body: { targetAccountId } });
      setIsBlocked(true);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  const unblock = useCallback(async () => {
    if (!targetAccountId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch(`/api/social/blocks?target_account_id=${encodeURIComponent(targetAccountId)}`, { method: "DELETE" });
      setIsBlocked(false);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  return { isBlocked, block, unblock, loading };
}
```

---

## Task 15: hook — `useFollowRequests.ts`

```typescript
"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { FollowRequestItem } from "../types";

interface ListResponse {
  requests: FollowRequestItem[];
  nextCursor: string;
  hasMore: boolean;
}

interface CountResponse { count: number }

export function useFollowRequests() {
  const token = getAuthToken();

  const { data: list, error: listError, isLoading, mutate: mutateList } = useSWR<ListResponse>(
    token ? "/api/social/follow/requests" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const { data: countData, mutate: mutateCount } = useSWR<CountResponse>(
    token ? "/api/social/follow/requests/count" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const approve = useCallback(async (requesterAccountId: string) => {
    const t = getAuthToken();
    if (!t) throw new Error("No token");
    const res = await fetch(`/api/social/follow/requests/${requesterAccountId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to approve");
    }
    mutateList((cur) => (cur ? { ...cur, requests: cur.requests.filter((r) => r.requesterAccountId !== requesterAccountId) } : cur), { revalidate: false });
    mutateCount((cur) => (cur ? { count: Math.max(0, cur.count - 1) } : cur), { revalidate: false });
  }, [mutateList, mutateCount]);

  const reject = useCallback(async (requesterAccountId: string) => {
    const t = getAuthToken();
    if (!t) throw new Error("No token");
    const res = await fetch(`/api/social/follow/requests/${requesterAccountId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to reject");
    }
    mutateList((cur) => (cur ? { ...cur, requests: cur.requests.filter((r) => r.requesterAccountId !== requesterAccountId) } : cur), { revalidate: false });
    mutateCount((cur) => (cur ? { count: Math.max(0, cur.count - 1) } : cur), { revalidate: false });
  }, [mutateList, mutateCount]);

  return {
    requests: list?.requests || [],
    hasMore: list?.hasMore || false,
    nextCursor: list?.nextCursor || "",
    pendingCount: countData?.count || 0,
    loading: isLoading,
    error: listError,
    approve,
    reject,
    refresh: () => { mutateList(); mutateCount(); },
  };
}
```

---

## Task 16: hooks — `useFollowList.ts` / `useFollowerList.ts`

両方とも cursor pagination。SWR で同 path。

`useFollowList.ts`:

```typescript
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedProfilesResponse } from "../types";

export function useFollowList(accountId?: string) {
  const token = getAuthToken();
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  const { data, error, isLoading, mutate } = useSWR<PaginatedProfilesResponse>(
    token ? `/api/social/following${qs}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return {
    profiles: data?.profiles || [],
    nextCursor: data?.nextCursor || "",
    hasMore: data?.hasMore || false,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

`useFollowerList.ts`: 同形、path `/api/social/followers${qs}`。

---

## Task 17: hooks — `useFollowStatusBatch.ts` / `useBlockStatusBatch.ts`

`useFollowStatusBatch.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";
import type { FollowStatusMap } from "../types";

interface Response { statuses: FollowStatusMap }

export function useFollowStatusBatch(targetAccountIds: string[]) {
  const [statuses, setStatuses] = useState<FollowStatusMap>({});
  const [loading, setLoading] = useState(false);

  const key = targetAccountIds.join(",");

  useEffect(() => {
    if (!getAuthToken() || targetAccountIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await authFetch<Response>(
          "/api/social/follow/status",
          { method: "POST", body: { targetAccountIds } }
        );
        if (cancelled) return;
        setStatuses(res.statuses || {});
      } catch (e) {
        console.error("useFollowStatusBatch error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true };
  }, [key]);

  const getStatus = (id: string): FollowStatus => statuses[id] ?? FollowStatus.NONE;

  return { statuses, getStatus, loading };
}
```

`useBlockStatusBatch.ts`: 同形、`/api/social/blocks/status`、`{ blocked: Record<string, boolean> }` を expose。

---

## Task 18: hook — `useBlockedList.ts`

```typescript
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedProfilesResponse } from "../types";

export function useBlockedList() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PaginatedProfilesResponse>(
    token ? "/api/social/blocks" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return {
    profiles: data?.profiles || [],
    nextCursor: data?.nextCursor || "",
    hasMore: data?.hasMore || false,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

---

## Task 19: hooks/index.ts (re-export)

```typescript
export * from "./useFollow";
export * from "./useBlock";
export * from "./useFollowRequests";
export * from "./useFollowList";
export * from "./useFollowerList";
export * from "./useFollowStatusBatch";
export * from "./useBlockStatusBatch";
export * from "./useBlockedList";
```

---

## Task 20: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- `tsc --noEmit`: error 無し
- `pnpm build`: 緑、新 `/api/social/*` route が build 出力に登場
- `pnpm lint`: baseline 同等 (warning は増えても error 増は無し)

- [ ] **Step 2: route 一覧 smoke**

```bash
/usr/bin/grep -r "src/app/api/social" --include="*.ts" -l 2>&1 | /usr/bin/sort
```

期待 13 file:
- `src/app/api/social/follow/route.ts`
- `src/app/api/social/follow/status/route.ts`
- `src/app/api/social/follow/requests/route.ts`
- `src/app/api/social/follow/requests/count/route.ts`
- `src/app/api/social/follow/requests/[requesterAccountId]/approve/route.ts`
- `src/app/api/social/follow/requests/[requesterAccountId]/reject/route.ts`
- `src/app/api/social/following/route.ts`
- `src/app/api/social/followers/route.ts`
- `src/app/api/social/blocks/route.ts`
- `src/app/api/social/blocks/status/route.ts`

(10 route file。`follow` 配下が 6 / `blocks` 配下が 2 / トップ階層が 2)

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 23 new file + plan = **24 files** (module 13 file + BFF 10 file + plan)。

> Module 内訳 (13 file): index / types / lib/index / lib/mappers / hooks/index + 8 hooks
> BFF 内訳 (10 file): follow / follow/status / follow/requests / follow/requests/count / approve / reject / following / followers / blocks / blocks/status

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s4-frontend-data
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-15-social-s4-frontend-data.md
/usr/bin/git commit -s -m "feat(social): frontend data layer (types + hooks + BFFs)"
```

push しない。

---

## Deferred

- **UI components / pages** (FollowButton、/oshi、/u/[username] 拡張、pending request UI、/dev/ui mock) → S5
- **旧 `src/modules/relationship/*` の drop / 旧 `/api/cast/*`・`/api/guest/*` BFF drop** → cleanup フェーズ
- **/dev/ui mock 追記** → S5 (UI 同時に)
- **integration test** → 別 PR (test infra defer)

## Self-Review

- **Spec coverage (S4 範囲)**:
  - types ✓ / mappers ✓ / 8 hook ✓ (spec の `useFollow`/`useBlock`/`useFollowRequests`/`useFollowList`/`useFollowerList`/`useFollowStatusBatch`/`useBlockStatusBatch` + 補強 `useBlockedList`)
  - BFF: spec の 9 path に対し 10 file で 13 RPC mapping (`/api/social/follow` が POST/DELETE、`/api/social/blocks` が POST/DELETE/GET 統合)
  - `followClient` / `blockClient` は S1 で `src/lib/grpc.ts` に追記済を前提 (実装前に確認済)
- **Placeholder 無し**: 全 BFF + 全 hook 完全 code。`useFollowerList`、`useBlockStatusBatch`、`reject` は同形と明記 (analog template)。
- **型 / 命名整合**:
  - `FollowStatus` は proto stub から re-export (旧 relationship と別パッケージ)
  - `targetAccountId` BFF body / `target_account_id` URL query 統一
  - hook の `loading` 一貫提供
  - cursor pagination response shape は spec の `PaginatedProfilesResponse` 統一 (profiles / nextCursor / hasMore)
- **既存パターン踏襲**: `requireAuth` / `buildGrpcHeaders` / `handleApiError` / `authFetch` / `useSWR` + `fetcher` + `getAuthToken` 既存 import path
- **旧 relationship 完全無改変**: 旧 module / BFF は触らず並存、cleanup PR で一括 drop
- **検証**: tsc/build/lint 既存 baseline 維持、route 13 件 build 出力に登場で smoke
