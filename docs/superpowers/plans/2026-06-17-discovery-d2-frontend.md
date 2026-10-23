# Discovery D2: frontend full vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** D1 (#708) で動いた `discovery.v1.DiscoveryService` を frontend から消費する。types + 3 hooks + 3 BFFs + `src/lib/grpc.ts` に `discoveryClient` + `/search` & `/ranking` page 実装 (Phase 1b-A の stub から置換)。これで discovery slice の縦切り完成。

**Architecture:** bookmarks B2 + notifications N4 + social S4 と同形。`useSearchUsers` / `useSearchPosts` は debounce 300ms 付き、`useRankPosts` は period 切替で reset。BFFs は既存 `mapPostToView` / `profileToSocialAccount` を流用。

**Tech Stack:** Next.js 16 / React / TypeScript / SWR / connect-es。

**Spec:** `docs/superpowers/specs/2026-06-17-discovery-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-discovery-d2-frontend`、branch `feat/discovery-d2-frontend` (origin/main = `d7c43d45`、D1 #708 マージ後)。**push しない**。
- 触らない: 他 module / hook / BFF、monolith、proto、`PostCardBinding`、`/dev/ui`。

### 既存パターン (踏襲)

- BFF: `src/app/api/bookmarks/route.ts` (GET list)、`src/app/api/social/counts/route.ts` (GET) など
- hook: `src/modules/bookmarks/hooks/useBookmarkList.ts` (useSWRInfinite + flat array) を踏襲、debounce は新規追加
- post hydration: 既存 `mapPostToView` from `@/modules/post/lib/post-mappers`、bookmarks B2 でも同名で利用済
- user hydration: 既存 `profileToSocialAccount` from `@/modules/social`、social `useFollowList` と同形

### debounce 実装

300ms の SWR debounce は単純に `useState` + `useEffect` で実装 (新規 hook も dependency も追加しない):

```typescript
const [debouncedQuery, setDebouncedQuery] = useState(query);
useEffect(() => {
  const t = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(t);
}, [query]);
```

## File Structure

**New (11 file):**
- `src/modules/discovery/index.ts`
- `src/modules/discovery/types.ts`
- `src/modules/discovery/hooks/index.ts`
- `src/modules/discovery/hooks/useSearchUsers.ts`
- `src/modules/discovery/hooks/useSearchPosts.ts`
- `src/modules/discovery/hooks/useRankPosts.ts`
- `src/app/api/discovery/users/route.ts`
- `src/app/api/discovery/posts/route.ts`
- `src/app/api/discovery/ranking/route.ts`

**Modify (3 file):**
- `src/lib/grpc.ts` (DiscoveryService import + discoveryClient export)
- `src/app/search/page.tsx` (stub から実装に置換)
- `src/app/ranking/page.tsx` (stub から実装に置換)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-17-discovery-d2-frontend.md`

合計 15 file。

---

## Task 1: types

**Files:** Create `src/modules/discovery/types.ts`。

```typescript
import type { PostView } from "@/modules/post/lib/post-view";
import type { SocialAccountView } from "@/modules/social";

export type RankPeriodLiteral = "day" | "week" | "all";

export interface PaginatedUsersResponse {
  profiles: SocialAccountView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedPostsResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
```

---

## Task 2: index files

`src/modules/discovery/index.ts`:
```typescript
export * from "./types";
export * from "./hooks";
```

`src/modules/discovery/hooks/index.ts`:
```typescript
export * from "./useSearchUsers";
export * from "./useSearchPosts";
export * from "./useRankPosts";
```

---

## Task 3: `src/lib/grpc.ts` に discoveryClient 追加

**Files:** Modify `src/lib/grpc.ts`。

- [ ] **Step 1: import 追加 (既存 imports の隣)**

```typescript
import { DiscoveryService } from "@/stub/discovery/v1/discovery_service_pb";
```

- [ ] **Step 2: export 追加 (bookmarkClient の隣)**

```typescript
// Discovery domain client (discovery.v1)
export const discoveryClient = createClient(DiscoveryService, transport);
```

---

## Task 4: BFF `GET /api/discovery/users`

**Files:** Create `src/app/api/discovery/users/route.ts`。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { discoveryClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const query = req.nextUrl.searchParams.get("q") || "";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await discoveryClient.searchUsers({ query, limit, cursor }, { headers });
    return NextResponse.json({
      profiles: (res.profiles || []).map(profileToSocialAccount),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "SearchUsers");
  }
}
```

---

## Task 5: BFF `GET /api/discovery/posts`

**Files:** Create `src/app/api/discovery/posts/route.ts`。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { discoveryClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapPostToView } from "@/modules/post/lib/post-mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const query = req.nextUrl.searchParams.get("q") || "";
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await discoveryClient.searchPosts({ query, limit, cursor }, { headers });
    return NextResponse.json({
      posts: (res.posts || []).map(mapPostToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "SearchPosts");
  }
}
```

---

## Task 6: BFF `GET /api/discovery/ranking`

**Files:** Create `src/app/api/discovery/ranking/route.ts`。

Period の string → proto enum 変換が必要。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { discoveryClient } from "@/lib/grpc";
import { RankPeriod } from "@/stub/discovery/v1/discovery_service_pb";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapPostToView } from "@/modules/post/lib/post-mappers";

function periodFromString(s: string): RankPeriod {
  switch (s) {
    case "day": return RankPeriod.DAY;
    case "week": return RankPeriod.WEEK;
    case "all": return RankPeriod.ALL;
    default: return RankPeriod.WEEK;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const period = periodFromString(req.nextUrl.searchParams.get("period") || "week");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await discoveryClient.rankPosts({ period, limit, cursor }, { headers });
    return NextResponse.json({
      posts: (res.posts || []).map(mapPostToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "RankPosts");
  }
}
```

---

## Task 7: hook `useSearchUsers` (with debounce)

**Files:** Create `src/modules/discovery/hooks/useSearchUsers.ts`。

```typescript
"use client";

import { useEffect, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedUsersResponse } from "../types";

const DEBOUNCE_MS = 300;

export function useSearchUsers(query: string) {
  const token = getAuthToken();
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const getKey = (pageIndex: number, prev: PaginatedUsersResponse | null): string | null => {
    if (!token) return null;
    const trimmed = debounced.trim();
    if (trimmed.length === 0) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/discovery/users?q=${encodeURIComponent(trimmed)}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedUsersResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const profiles = pages.flatMap((p) => p.profiles || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    profiles,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
    // expose debounced query so the UI can show "Searching for X" if needed
    debouncedQuery: debounced,
  };
}
```

---

## Task 8: hook `useSearchPosts` (same shape, posts payload)

**Files:** Create `src/modules/discovery/hooks/useSearchPosts.ts`。

useSearchUsers と同形、path = `/api/discovery/posts`、payload = `PaginatedPostsResponse`、flatten field = `posts`。

```typescript
"use client";

import { useEffect, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedPostsResponse } from "../types";

const DEBOUNCE_MS = 300;

export function useSearchPosts(query: string) {
  const token = getAuthToken();
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const getKey = (pageIndex: number, prev: PaginatedPostsResponse | null): string | null => {
    if (!token) return null;
    const trimmed = debounced.trim();
    if (trimmed.length === 0) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/discovery/posts?q=${encodeURIComponent(trimmed)}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedPostsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const posts = pages.flatMap((p) => p.posts || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    posts,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
    debouncedQuery: debounced,
  };
}
```

---

## Task 9: hook `useRankPosts`

**Files:** Create `src/modules/discovery/hooks/useRankPosts.ts`。

period 切替で reset (useSWRInfinite の getKey が period を URL に含むため自動 reset)。

```typescript
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedPostsResponse, RankPeriodLiteral } from "../types";

export function useRankPosts(period: RankPeriodLiteral) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedPostsResponse | null): string | null => {
    if (!token) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/discovery/ranking?period=${encodeURIComponent(period)}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedPostsResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const posts = pages.flatMap((p) => p.posts || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    posts,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

---

## Task 10: `/search/page.tsx` 実装

**Files:** Modify `src/app/search/page.tsx`。

stub の "検索機能は準備中です。" を実装に置換。input + tabs + 結果 list。

```tsx
"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { FollowButton } from "@/modules/social";
import { useSearchUsers, useSearchPosts } from "@/modules/discovery";

const TABS: TabItem[] = [
  { id: "users", label: "ユーザー" },
  { id: "posts", label: "投稿" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("users");

  const users = useSearchUsers(tab === "users" ? query : "");
  const posts = useSearchPosts(tab === "posts" ? query : "");

  const trimmed = query.trim();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="sticky top-0 z-10 bg-bg/95 px-4 py-3 backdrop-blur">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ユーザーや投稿を検索"
          aria-label="検索"
        />
      </div>
      <Tabs items={TABS} value={tab} onValueChange={setTab} />

      {trimmed.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="text-4xl" aria-hidden="true">🔍</span>
          <p className="pt-3 text-text-primary">ユーザーや投稿を検索</p>
          <p className="pt-1 text-sm text-text-secondary">
            ユーザー名や投稿内容で検索できます
          </p>
        </div>
      )}

      {tab === "users" && trimmed.length > 0 && (
        <>
          {users.loading && users.profiles.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">検索中…</p>
          )}
          {!users.loading && users.profiles.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">該当するユーザーがいません</p>
          )}
          {users.profiles.map((p) => (
            <div
              key={p.accountId}
              className="flex items-center gap-3 border-b border-border px-4 py-3"
            >
              <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text-primary">{p.displayName}</p>
                <p className="truncate text-sm text-text-secondary">@{p.username}</p>
              </div>
              <FollowButton targetAccountId={p.accountId} />
            </div>
          ))}
          {users.hasMore && (
            <div className="flex justify-center px-4 py-6">
              <Button variant="secondary" size="md" onClick={() => users.loadMore()} disabled={users.loading}>
                もっと見る
              </Button>
            </div>
          )}
        </>
      )}

      {tab === "posts" && trimmed.length > 0 && (
        <>
          {posts.loading && posts.posts.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">検索中…</p>
          )}
          {!posts.loading && posts.posts.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">該当する投稿がありません</p>
          )}
          {posts.posts.map((post) => (
            <PostCardBinding key={post.id} post={post} />
          ))}
          {posts.hasMore && (
            <div className="flex justify-center px-4 py-6">
              <Button variant="secondary" size="md" onClick={() => posts.loadMore()} disabled={posts.loading}>
                もっと見る
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
```

> **Note**: `Input` component の signature は `src/components/ui/input.tsx` を実装時に確認、`type="search"` を受けるかチェック。`onValueChange` の prop 名は既存 `Tabs` 同形 (oshi page 等で確認済)。

---

## Task 11: `/ranking/page.tsx` 実装

**Files:** Modify `src/app/ranking/page.tsx`。

period tabs (24h / 1週間 / 全期間) + PostCard list。

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useRankPosts } from "@/modules/discovery";
import type { RankPeriodLiteral } from "@/modules/discovery/types";

const TABS: TabItem[] = [
  { id: "day", label: "24h" },
  { id: "week", label: "1週間" },
  { id: "all", label: "全期間" },
];

export default function RankingPage() {
  const [period, setPeriod] = useState<RankPeriodLiteral>("week");
  const { posts, hasMore, loading, loadMore } = useRankPosts(period);

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">🏆 ランキング</h1>
      </div>
      <Tabs items={TABS} value={period} onValueChange={(v) => setPeriod(v as RankPeriodLiteral)} />

      {loading && posts.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {!loading && posts.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">ランキング対象の投稿がありません</p>
      )}

      {posts.map((post) => (
        <PostCardBinding key={post.id} post={post} />
      ))}

      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loading}>
            もっと見る
          </Button>
        </div>
      )}
    </main>
  );
}
```

---

## Task 12: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑
- build 緑、新 3 BFF route (`/api/discovery/users`、`/api/discovery/posts`、`/api/discovery/ranking`) + 既存 `/search` & `/ranking` 全部出力
- lint baseline 同等 (5 errors / 7 warnings、本 PR 増減なし)

- [ ] **Step 2: route 出力 smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/api/discovery|/search|/ranking" | /usr/bin/head -10
```

期待: 3 BFF + 2 page 全部出る。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 11 new (10 file + plan) + 3 modify = **14 file 前後**。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-discovery-d2-frontend
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-17-discovery-d2-frontend.md
/usr/bin/git commit -s -m "feat(discovery): frontend full vertical (types + hooks + BFFs + /search + /ranking, D2)"
```

push しない。

---

## Deferred

- **/dev/ui mock section**: discovery の visual sandbox、別 PR で polish
- **search history / recent queries**: 別 PR
- **input clear button (×)**: polish
- **infinite scroll (IntersectionObserver 自動 trigger)**: 別 PR、現状の手動 "もっと見る" で MVP 十分

## Self-Review

- **Spec coverage (D2 範囲)**: types + 3 hook + 3 BFF + grpc.ts client + 2 page 実装 = 全項目
- **Placeholder 無し**: 全 file 完全 code
- **既存パターン踏襲**: bookmarks B2 + social S4 + notifications N4 と同 layout、useSWRInfinite + getKey + page 配列 flatMap
- **Debounce 実装**: 300ms、useState + useEffect の simple 実装、新規 dependency 追加なし
- **空 query 抑制**: useSearchUsers / useSearchPosts は `trimmed.length === 0` で getKey が null を返し fetch しない
- **Period 切替 reset**: useRankPosts は getKey に period を含むため useSWRInfinite が cache key 変更で自動 reset
- **検証**: tsc / build / lint baseline 維持、新 3 BFF route + 既存 2 page route 全部 build 出力
