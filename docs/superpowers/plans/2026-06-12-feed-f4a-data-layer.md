# Feed F4a: frontend data layer (BFF + types + mappers + hook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** symmetric `ListFeed` (F3、#663) を消費する frontend **データ層**を `src/modules/feed` と `src/app/api/feed/route.ts` に additive 追加: `FeedFilterValue` (`"all" | "area" | "following"`) + Q4a の `PostView` 再利用の `FeedListView` 型 + mappers + BFF route (`/api/feed` GET) + SWR / pagination hook (`useFeed`)。UI (3 タブ + `PostCardBinding` リスト + `/` ルート) は F4b。

**Architecture:** **Additive、build-green**。Q4a で配線した `postClient` 用の `PostView` / `mapPostToView` / `mapPostsListResponse` を最大限再利用、feed 固有の追加は `FeedFilterValue` enum string ⇔ proto `FeedFilter` enum 変換のみ。`feedClient` (`src/lib/grpc.ts:44`) は既存 bound、`feed.v1.ListFeed` RPC は F1 で stub 生成済。**旧 `useTimeline` / `useGuestPost` hook、`/api/feed/cast` / `/api/feed/guest` BFF は無改変**、cleanup フェーズで drop。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / connect-es (`@connectrpc/connect-node`) / SWR / pnpm。

**Spec:** `docs/superpowers/specs/2026-06-12-feed-slice-design.md` (§Frontend / §Decomposition の F4)。前提: F1 (#660) + F2 (#661) + F3a (#662) + F3 (#663) main マージ済、main HEAD = `3fdef236`。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f4a-data-layer`。frontend app root: `services/frontend/workspace`。branch `feat/feed-f4a-data-layer` (origin/main = `3fdef236` base、tracking 済)。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。import alias `@/` → `src/`。
- **テストランナーは無い** (vitest/jest 不在)。検証は `pnpm exec tsc --noEmit` (緑必須) + `pnpm build` (緑必須) + `pnpm lint` (#659 で復活、新 violation 出さない)。
- **build-green / additive**: 以下は無改変:
  - 旧 `src/modules/post/hooks/{useTimeline,useGuestPost,useCastPosts,useLike,useComments}.ts`
  - 旧 `src/app/api/feed/{cast,guest}/route.ts`、`/api/cast/timeline`、`/api/guest/likes` 等
  - Q4a の `src/modules/post/lib/post-view.ts` / `post-mappers.ts` (再利用するだけ、touch しない)
  - Q4b の `src/modules/post/components/PostCardBinding.tsx` (F4b で再利用)
  - `src/lib/grpc.ts` (`feedClient` 既存)
- 変更は 5 ファイル (型 + mappers + BFF route + hook + index 追記) + plan。

### 既存パターン (踏襲する)

- **Q4a posts data layer** (`src/modules/post/lib/post-view.ts` + `post-mappers.ts`、PR #653/#654):
  - `PostView` (`{ id, authorId, content, media, createdAt, author, likesCount, commentsCount, visibility, hashtags, liked }`)
  - `mapPostToView(p: Post): PostView` (proto Post → view)
  - `mapPostsListResponse(res): PostsListView` (Q4a 戻り = `{posts: PostView[], nextCursor: string | null, hasMore: boolean}`)
- **Q4a posts hook** (`src/modules/post/hooks/usePosts.ts`、reference for cursor pagination + filter query 経由):
  ```ts
  usePaginatedFetch<PostView, PostsListView>({
    apiUrl: "/api/posts",
    mapResponse, getItemId, fetchFn, buildParams
  })
  ```
- **BFF パターン**: `requireAuth(req)` → `buildGrpcHeaders(req.headers)` → `client.method(init, { headers })` → `mapResponse` → `NextResponse.json` → `catch` で `handleApiError(error, "Ctx")` (Q4a の `/api/posts/route.ts` 完全踏襲)
- **stub フィールド**: `feedClient.listFeed({filter, limit, cursor, prefecture}, { headers })` → `ListFeedResponse{ posts: post.v1.Post[], nextCursor: string, hasMore: boolean }`。proto `Post` は Q4a の `mapPostToView` で `PostView` 化済。
- **proto FeedFilter enum** (`src/stub/feed/v1/feed_service_pb.ts`): `FEED_FILTER_UNSPECIFIED=0 / ALL=1 / FOLLOWING=2 / AREA=3` (F1 で AREA=3 追加済)

## File Structure

- Create: `src/modules/feed/types.ts` (`FeedFilterValue`, `FeedListView`, `UseFeedOptions`)
- Create: `src/modules/feed/lib/mappers.ts` (`feedFilterFromString`, `mapFeedListResponse`)
- Create: `src/modules/feed/lib/index.ts` (`export * from "./mappers"`)
- Create: `src/modules/feed/hooks/useFeed.ts`
- Create: `src/modules/feed/hooks/index.ts` (`export { useFeed }`)
- Create: `src/modules/feed/index.ts` (`export * from "./types"; export * from "./hooks"; export * from "./lib";`)
- Create: `src/app/api/feed/route.ts` (GET handler)

> 旧 `/api/feed/{cast,guest}/route.ts` は無改変、新 `/api/feed/route.ts` を兄弟として追加。Next.js routing 上 `/api/feed` (root) と `/api/feed/cast` / `/api/feed/guest` (子) は別エンドポイントで衝突なし。

---

## Task 1: types + mappers

**Files:** Create `src/modules/feed/types.ts`, `src/modules/feed/lib/mappers.ts`, `src/modules/feed/lib/index.ts`。

- [ ] **Step 1: `src/modules/feed/types.ts` を作成**

```ts
import type { PostView } from "@/modules/post/lib/post-view";

export type FeedFilterValue = "all" | "area" | "following";

export interface FeedListView {
  posts: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UseFeedOptions {
  filter?: FeedFilterValue;
  prefecture?: string;
}
```

- [ ] **Step 2: `src/modules/feed/lib/mappers.ts` を作成**

```ts
import { FeedFilter } from "@/stub/feed/v1/feed_service_pb";
import type { ListFeedResponse } from "@/stub/feed/v1/feed_service_pb";
import { mapPostToView } from "@/modules/post/lib/post-mappers";
import type { FeedFilterValue, FeedListView } from "@/modules/feed/types";

export function feedFilterFromString(value: FeedFilterValue | undefined): FeedFilter {
  switch (value) {
    case "area":
      return FeedFilter.AREA;
    case "following":
      return FeedFilter.FOLLOWING;
    case "all":
    default:
      return FeedFilter.ALL;
  }
}

export function mapFeedListResponse(res: ListFeedResponse): FeedListView {
  return {
    posts: (res.posts || []).map(mapPostToView),
    nextCursor: res.nextCursor || null,
    hasMore: res.hasMore || false,
  };
}
```

- [ ] **Step 3: `src/modules/feed/lib/index.ts` を作成**

```ts
export * from "./mappers";
```

- [ ] **Step 4: 型チェック**

```bash
cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -15
```

緑必須。`mapPostToView` の戻り型 `PostView` が `FeedListView.posts` と一致。

---

## Task 2: BFF route (`/api/feed` GET)

**Files:** Create `src/app/api/feed/route.ts`。

- [ ] **Step 1: 実装**

```ts
import { NextRequest, NextResponse } from "next/server";
import { feedClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, extractPaginationParams, handleApiError } from "@/lib/api-helpers";
import { feedFilterFromString, mapFeedListResponse } from "@/modules/feed/lib/mappers";
import type { FeedFilterValue } from "@/modules/feed/types";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const { limit, cursor } = extractPaginationParams(req.nextUrl.searchParams);
    const filterRaw = (req.nextUrl.searchParams.get("filter") || "all") as FeedFilterValue;
    const prefecture = req.nextUrl.searchParams.get("prefecture") || "";

    const filter = feedFilterFromString(filterRaw);

    const res = await feedClient.listFeed(
      { filter, limit, cursor, prefecture },
      { headers }
    );
    return NextResponse.json(mapFeedListResponse(res));
  } catch (error: unknown) {
    return handleApiError(error, "ListFeed");
  }
}
```

**実装上の注意**:
- `requireAuth` で 401 早期 return (旧 `/api/feed/guest` は `requireAuth` 無しだが、新 RPC は backend 側で `authenticate_user!` 必須なので BFF でも auth gate)
- `extractPaginationParams` で limit / cursor 取得 (Q4a posts と同じヘルパ)
- `filter` は string → proto enum 変換、未指定なら ALL
- `prefecture` は string、空文字でも OK (backend が AREA 時のみ validate)
- 戻りは `mapFeedListResponse(res)` で `{posts: PostView[], nextCursor, hasMore}` の json

- [ ] **Step 2: 型チェック**

```bash
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -15
```

緑必須。`feedClient.listFeed` の init 型と response 型が整合。

---

## Task 3: `useFeed` hook

**Files:** Create `src/modules/feed/hooks/useFeed.ts`, `src/modules/feed/hooks/index.ts`, `src/modules/feed/index.ts`。

- [ ] **Step 1: `src/modules/feed/hooks/useFeed.ts`**

```ts
"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { usePaginatedFetch, type PaginatedResult } from "@/lib/hooks/usePaginatedFetch";
import type { PostView } from "@/modules/post/lib/post-view";
import type { FeedFilterValue, FeedListView, UseFeedOptions } from "@/modules/feed/types";

export function useFeed(options: UseFeedOptions = {}) {
  const { filter = "all", prefecture } = options;

  const mapResponse = useCallback(
    (data: FeedListView): PaginatedResult<PostView> => ({
      items: data.posts,
      hasMore: data.hasMore,
      nextCursor: data.nextCursor,
    }),
    []
  );

  const getItemId = useCallback((p: PostView) => p.id, []);

  const fetchFn = useCallback(
    async (url: string): Promise<FeedListView> =>
      authFetch<FeedListView>(url, { cache: "no-store" }),
    []
  );

  const buildParams = useCallback(
    (params: URLSearchParams) => {
      params.set("filter", filter);
      if (prefecture) params.set("prefecture", prefecture);
    },
    [filter, prefecture]
  );

  const {
    items: posts,
    setItems: setPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  } = usePaginatedFetch<PostView, FeedListView>({
    apiUrl: "/api/feed",
    mapResponse,
    getItemId,
    fetchFn,
    buildParams,
  });

  return {
    posts,
    setPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
    filter,
    prefecture,
  };
}

export type { FeedFilterValue, UseFeedOptions };
```

- [ ] **Step 2: `src/modules/feed/hooks/index.ts`**

```ts
export { useFeed } from "./useFeed";
```

- [ ] **Step 3: `src/modules/feed/index.ts`**

```ts
export * from "./types";
export * from "./hooks";
export * from "./lib";
```

- [ ] **Step 4: 型チェック**

```bash
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -15
```

緑必須。`usePaginatedFetch<PostView, FeedListView>` generics が `mapResponse` / `getItemId` / `fetchFn` / `buildParams` と整合。

---

## Task 4: build / lint で検証 + commit

- [ ] **Step 1: 本番ビルド (型 + バンドル)**

```bash
cd services/frontend/workspace && pnpm build 2>&1 | /usr/bin/tail -30
```

成功必須。新 route `/api/feed` がビルド出力に dynamic として現れること、旧 `/api/feed/cast` / `/api/feed/guest` も継続出力されること。

- [ ] **Step 2: lint**

```bash
pnpm lint 2>&1 | /usr/bin/tail -20
```

新 violation を出さないこと (#659 で復活後の baseline = 27 problems と同等)。

- [ ] **Step 3: diff stat 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f4a-data-layer
/usr/bin/git diff --stat origin/main HEAD
```

期待: 7 ファイル変更 (5 modules + 1 BFF route + 1 plan)。**他のファイル変更ゼロ** (旧 hooks / 旧 BFFs / Q4a posts / Q4b PostCardBinding / `src/lib/grpc.ts` に diff 無いこと)。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f4a-data-layer
/usr/bin/git add services/frontend/workspace/src/modules/feed services/frontend/workspace/src/app/api/feed/route.ts docs/superpowers/plans/2026-06-12-feed-f4a-data-layer.md
/usr/bin/git commit -s -m "feat(feed): add symmetric feed frontend data layer (BFF + hook)"
```

push しない。

---

## Deferred (本 F4a では実施しない)

- **UI (3 タブ + `PostCardBinding` リスト + `/` ルート + `/dev/ui` mock)** → F4b
- **旧 `useTimeline` / `useGuestPost` hook、`/api/feed/cast` / `/api/feed/guest` BFF の drop** → cleanup PR (F4b 完了後、frontend が新 path に切り替わってから一括)
- **`isLikedFn` / `setInitialState` 経由の like 状態 hydration** → `PostCardBinding` (Q4b) が `usePostLike` 内蔵で seed する pattern が既存、F4b で UI 結線時に確認
- **AREA タブの prefecture UI 変更** → F4b では viewer.profile.prefecture 固定、後で UI 追加
- **mute / hide post / NSFW gate** → 別スライス・別 PR

## Self-Review (作成者チェック済)

- **Spec coverage (F4a 範囲)**: spec §Frontend の「data 層: BFF route `/api/feed` + `useFeed` hook + `FeedView` 型 + mapper」を完全実装。UI は明示的に F4b へ分離。
- **Additive / build-green**: Q4a / Q4b の posts data/UI / 旧 hooks / 旧 BFFs / 他 slice の core lib / proto に diff 無し。新規 7 ファイル (5 modules + 1 BFF + 1 plan)。
- **Placeholder 無し**: 全 task に完全コード提示。
- **型 / 命名整合**:
  - `FeedFilterValue` = `"all" | "area" | "following"` literal union → mapper で proto enum 変換
  - `FeedListView.posts: PostView[]` で Q4a 型再利用 (新規 PostView 別定義しない)
  - `mapFeedListResponse(res: ListFeedResponse)` → 戻り = `{posts: PostView[], nextCursor: string | null, hasMore: boolean}` (Q4a `mapPostsListResponse` と同形)
  - hook 戻り型は `usePosts` (Q4a) と概ね同形 (`filter` / `prefecture` の追加のみ)、UI 側で feed と posts を統一的に扱える
- **テスト方針**: frontend ランナー無し → `pnpm build` (tsc 型) + `pnpm lint` (#659 復活、新 violation 出さず baseline 維持)。unit test は YAGNI、F4b で `/dev/ui` mock + 実 backend 疎通で動作確認。
