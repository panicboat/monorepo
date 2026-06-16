# Notifications N4: frontend data layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** N3 (#694) で動いた `notifications.v1.NotificationService` を frontend から消費する。types + mappers + 2 hooks (useNotifications / useUnreadCount) + 3 BFFs + `src/lib/grpc.ts` に `notificationClient` を追加し、N5 (UI) が乗れる状態にする。

**Architecture:** social S4 と同形。`src/modules/notifications/` 配下に types/lib/hooks、`src/app/api/notifications/` 配下に 3 BFFs、`src/lib/grpc.ts` に 1 client 追加。useNotifications は `useSWRInfinite` (cursor)、useUnreadCount は `useSWR` + `refreshInterval: 30000` で polling 実現。

**Tech Stack:** Next.js 16 / React / TypeScript / SWR / connect-es。

**Spec:** `docs/superpowers/specs/2026-06-16-notifications-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n4-frontend-data`、branch `feat/notifications-n4-frontend-data` (origin/main = `200f6e6a`、N3 #694 マージ後)。**push しない**。
- 触らない: 他 hook / module / BFF、monolith、proto。

### 既存パターン (踏襲)

- BFF: `src/app/api/social/follow/route.ts` (POST/DELETE) や `src/app/api/social/counts/route.ts` (GET) と同形
- hook: `useFollowRequests` (useSWR + mutation) / `useFollowList` (useSWRInfinite) / `useSocialCounts` (useSWR) を参考
- mapper: `src/modules/social/lib/mappers.ts` (profileToSocialAccount) と同形で `Profile` proto → view 変換
- generated stub: `@/stub/notifications/v1/notification_service_pb` (N1 で生成済)
- `src/lib/grpc.ts` に新 client export 追加 (`notificationClient`)

## File Structure

**New (10 file):**
- `src/modules/notifications/index.ts`
- `src/modules/notifications/types.ts`
- `src/modules/notifications/lib/index.ts`
- `src/modules/notifications/lib/mappers.ts`
- `src/modules/notifications/hooks/index.ts`
- `src/modules/notifications/hooks/useNotifications.ts`
- `src/modules/notifications/hooks/useUnreadCount.ts`
- `src/app/api/notifications/route.ts` (GET list)
- `src/app/api/notifications/unread-count/route.ts` (GET count)
- `src/app/api/notifications/[id]/read/route.ts` (POST mark)

**Modify (1 file):**
- `src/lib/grpc.ts` (NotificationService import + notificationClient export)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-16-notifications-n4-frontend-data.md`

合計 12 file。

---

## Task 1: `src/modules/notifications/types.ts`

- [ ] **Step 1: 実装**

```typescript
import { NotificationType } from "@/stub/notifications/v1/notification_service_pb";
import type { SocialAccountView } from "@/modules/social/types";

export { NotificationType };

// View shape returned from BFF (mapper-translated from proto Notification)
export interface NotificationView {
  id: string;
  type: NotificationType;
  targetResourceId: string;
  actorCount: number;
  latestActor: SocialAccountView | null;
  latestEventAt: string;  // ISO8601
  readAt: string | null;  // ISO8601 | null = unread
}

export interface PaginatedNotificationsResponse {
  notifications: NotificationView[];
  nextCursor: string;
  hasMore: boolean;
  unreadCount: number;
}
```

---

## Task 2: `src/modules/notifications/lib/mappers.ts`

- [ ] **Step 1: 実装**

```typescript
import type { Notification } from "@/stub/notifications/v1/notification_service_pb";
import { profileToSocialAccount } from "@/modules/social";
import type { NotificationView } from "../types";

function timestampToIso(ts: { seconds?: bigint | number; nanos?: number } | undefined): string {
  if (!ts) return "";
  const seconds = typeof ts.seconds === "bigint" ? Number(ts.seconds) : (ts.seconds || 0);
  const millis = seconds * 1000 + Math.floor((ts.nanos || 0) / 1_000_000);
  return new Date(millis).toISOString();
}

export function notificationToView(n: Notification): NotificationView {
  return {
    id: n.id,
    type: n.type,
    targetResourceId: n.targetResourceId,
    actorCount: n.actorCount,
    latestActor: n.latestActor ? profileToSocialAccount(n.latestActor) : null,
    latestEventAt: timestampToIso(n.latestEventAt),
    readAt: n.readAt ? timestampToIso(n.readAt) : null,
  };
}
```

---

## Task 3: index files

`src/modules/notifications/lib/index.ts`:

```typescript
export * from "./mappers";
```

`src/modules/notifications/index.ts`:

```typescript
export * from "./types";
export * from "./lib";
export * from "./hooks";
```

---

## Task 4: `src/lib/grpc.ts` に notificationClient 追加

**Files:** Modify `src/lib/grpc.ts`。

- [ ] **Step 1: import 追加 (existing imports の隣)**

```typescript
import { NotificationService } from "@/stub/notifications/v1/notification_service_pb";
```

- [ ] **Step 2: 末尾 (`profileClient` の下) に export 追加**

```typescript
// Notifications domain client (notifications.v1)
export const notificationClient = createClient(NotificationService, transport);
```

---

## Task 5: BFF `/api/notifications` (GET list)

**Files:** Create `src/app/api/notifications/route.ts`。

- [ ] **Step 1: 実装**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { notificationToView } from "@/modules/notifications";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await notificationClient.listNotifications({ limit, cursor }, { headers });
    return NextResponse.json({
      notifications: (res.notifications || []).map(notificationToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      unreadCount: res.unreadCount || 0,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListNotifications");
  }
}
```

---

## Task 6: BFF `/api/notifications/unread-count` (GET)

**Files:** Create `src/app/api/notifications/unread-count/route.ts`。

- [ ] **Step 1: 実装**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const res = await notificationClient.getUnreadCount({}, { headers });
    return NextResponse.json({ count: res.count || 0 });
  } catch (error: unknown) {
    return handleApiError(error, "GetUnreadCount");
  }
}
```

---

## Task 7: BFF `/api/notifications/[id]/read` (POST)

**Files:** Create `src/app/api/notifications/[id]/read/route.ts`。

- [ ] **Step 1: 実装**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { notificationClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    await notificationClient.markRead({ id }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "MarkRead");
  }
}
```

---

## Task 8: hook `useNotifications`

**Files:** Create `src/modules/notifications/hooks/useNotifications.ts`。

`useSWRInfinite` で cursor 連結 + mark read action。social `useFollowList` と同形。

- [ ] **Step 1: 実装**

```typescript
"use client";

import useSWRInfinite from "swr/infinite";
import { useCallback } from "react";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedNotificationsResponse } from "../types";

export function useNotifications() {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedNotificationsResponse | null): string | null => {
    if (!token) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/notifications${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedNotificationsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const notifications = pages.flatMap((p) => p.notifications || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;
  const unreadCount = pages.length > 0 ? pages[0].unreadCount : 0;

  const markRead = useCallback(async (id: string) => {
    const t = getAuthToken();
    if (!t) throw new Error("No token");
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to mark read");
    }
    // optimistic: bump readAt of the affected notification in cache
    const now = new Date().toISOString();
    mutate(
      (cur) =>
        cur?.map((page) => ({
          ...page,
          notifications: page.notifications.map((n) => (n.id === id ? { ...n, readAt: n.readAt || now } : n)),
          unreadCount: Math.max(0, page.unreadCount - (page.notifications.find((n) => n.id === id && !n.readAt) ? 1 : 0)),
        })),
      { revalidate: false }
    );
  }, [mutate]);

  return {
    notifications,
    hasMore,
    unreadCount,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    markRead,
    refresh: () => mutate(),
  };
}
```

---

## Task 9: hook `useUnreadCount`

**Files:** Create `src/modules/notifications/hooks/useUnreadCount.ts`。

polling 専用、`refreshInterval: 30000`。

- [ ] **Step 1: 実装**

```typescript
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";

interface UnreadCountResponse {
  count: number;
}

export function useUnreadCount() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(
    token ? "/api/notifications/unread-count" : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );
  return {
    count: data?.count ?? 0,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

---

## Task 10: hooks/index.ts

```typescript
export * from "./useNotifications";
export * from "./useUnreadCount";
```

---

## Task 11: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑
- build 緑、新 `/api/notifications*` route 3 件登場
- lint baseline 同等

- [ ] **Step 2: 新 route smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/api/notifications" | /usr/bin/head -5
```

期待: 3 route 出現 (`/api/notifications`、`/api/notifications/unread-count`、`/api/notifications/[id]/read`)。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 10 new + 1 modify + plan = **12 files**。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n4-frontend-data
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-16-notifications-n4-frontend-data.md
/usr/bin/git commit -s -m "feat(notifications): frontend data layer (types + hooks + BFFs, N4)"
```

push しない。

---

## Deferred

- **N5** (frontend UI): `NotificationBell` + `/notifications` page + `/dev/ui` mock
- **Infinite scroll** (IntersectionObserver 自動 trigger): 別 PR
- **target_resource preview** (post 本文 / comment 本文): 別 PR

## Self-Review

- **Spec coverage (N4 範囲)**: types + mappers + 2 hook + 3 BFF + grpc.ts client = 全項目
- **Placeholder 無し**: 全 file 完全 code
- **既存パターン踏襲**: social S4 と同 layout、`useSWRInfinite` の getKey + page 配列 flatMap、polling は refreshInterval: 30000 (spec 通り)
- **型 / 命名整合**:
  - proto camelCase (connect-es 自動変換) → BFF response camelCase → hook return camelCase で統一
  - `NotificationType` enum は stub から直接 re-export、`SocialAccountView` を `latestActor` の型に流用
- **検証**: tsc / build / lint baseline 維持、新 route 3 件登場で smoke
