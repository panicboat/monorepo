# Bookmarks B2: frontend full vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** B1 (#701) で動いた `bookmarks.v1.BookmarkService` を frontend から消費する。types + 3 hooks (`useBookmark` / `useBookmarkStatusBatch` / `useBookmarkList`) + 4 BFFs + `src/lib/grpc.ts` に `bookmarkClient` + `PostCardBinding` に bookmark icon 追加 + `/bookmarks/page.tsx` 実装 (#699 の stub 置換)。これで bookmarks slice の縦切り完成。

**Architecture:** social S4 + notifications N4 と同形。`useBookmark` は `useBlock` 同 pattern (initial fetch + toggle action)、`useBookmarkList` は `useFollowList` 同 pattern (useSWRInfinite cursor + flat post list)。BFFs は `requireAuth` + `buildGrpcHeaders` + `handleApiError`。`/bookmarks` stub の `<main>` 内容を実装に置換、`PostCardBinding.map` で render。

**Tech Stack:** Next.js 16 / React / TypeScript / SWR / connect-es。

**Spec:** `docs/superpowers/specs/2026-06-17-bookmarks-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-bookmarks-b2-frontend`、branch `feat/bookmarks-b2-frontend` (origin/main = `f5eb6265`、B1 #701 マージ後)。**push しない**。
- 触らない: 他 module / hook / BFF、monolith、proto、`PostCard` (UI primitive)、`/dev/ui` (本 PR では追記なし、必要なら別 polish PR で)。

### 既存パターン (踏襲)

- BFF: `src/app/api/social/follow/route.ts` (POST/DELETE)、`src/app/api/notifications/[id]/read/route.ts` (POST path param)、`src/app/api/social/counts/route.ts` (GET) など
- hook (single + toggle): `src/modules/social/hooks/useBlock.ts` (initial fetch + block/unblock action) を踏襲
- hook (batch status): `src/modules/social/hooks/useFollowStatusBatch.ts` を踏襲
- hook (cursor list): `src/modules/social/hooks/useFollowList.ts` (useSWRInfinite + flat profiles) を踏襲、`posts` 配列を返す形に
- `PostCardBinding`: 既存 `reactions` JSX 配列に bookmark button を追加するだけ、`PostCard` の API は据置 (1 prop `reactions` 内で複数 button を render)

### 既存 `usePostLike` との関係

`usePostLike` は Zustand store 経由で feed 全体の like state を持つ singleton。bookmarks も似た特性 (1 post に対し 1 status、feed の複数 instance で同期したい) なので、初期実装は **single hook + SWR fetch per post id** ではなく、**feed level の useBookmarkStatusBatch で予め一括 fetch → PostCard が `bookmarked` prop を受け取る** 形にする。シンプル実装としては:

- `PostCardBinding` 内で `useBookmark(post.id)` をローカル fetch、各 PostCard インスタンスが独立 SWR cache を持つ (notifications/social と同形)
- 同一 post の複数 PostCard が出る場合、SWR の cache key 共有で重複 fetch は回避される
- Zustand store 経由は **defer** (bookmarks は like と異なり同一 post を頻繁に表示しない想定 = feed 1 post + bookmarks 1 post 程度、SWR cache で十分)

→ `useBookmark(postId)` を採用、`usePostLike` の Zustand 化は本 PR では追わない (社会 hook 同 pattern が最小スコープ)。

## File Structure

**New (11 file):**
- `src/modules/bookmarks/index.ts`
- `src/modules/bookmarks/types.ts`
- `src/modules/bookmarks/hooks/index.ts`
- `src/modules/bookmarks/hooks/useBookmark.ts`
- `src/modules/bookmarks/hooks/useBookmarkStatusBatch.ts`
- `src/modules/bookmarks/hooks/useBookmarkList.ts`
- `src/app/api/bookmarks/route.ts` (GET list)
- `src/app/api/bookmarks/[postId]/route.ts` (POST + DELETE per post)
- `src/app/api/bookmarks/status/route.ts` (POST batch)

**Modify (3 file):**
- `src/lib/grpc.ts` (BookmarkService import + bookmarkClient export)
- `src/modules/post/components/PostCardBinding.tsx` (bookmark icon を reactions JSX に追加)
- `src/app/bookmarks/page.tsx` (stub `<main>` を実装に置換)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-17-bookmarks-b2-frontend.md`

合計 15 file。

---

## Task 1: `src/modules/bookmarks/types.ts`

- [ ] **Step 1: 実装**

```typescript
// View shapes for bookmarks module.
// Post body uses the existing PostView from @/modules/post.

import type { PostView } from "@/modules/post/lib/post-view";

export type BookmarkStatusMap = Record<string, boolean>;

export interface PaginatedBookmarksResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
```

---

## Task 2: `src/modules/bookmarks/index.ts` + hooks/index.ts

`src/modules/bookmarks/index.ts`:

```typescript
export * from "./types";
export * from "./hooks";
```

`src/modules/bookmarks/hooks/index.ts`:

```typescript
export * from "./useBookmark";
export * from "./useBookmarkStatusBatch";
export * from "./useBookmarkList";
```

---

## Task 3: `src/lib/grpc.ts` に bookmarkClient 追加

**Files:** Modify `src/lib/grpc.ts`。

- [ ] **Step 1: import 追加 (既存 imports の隣)**

```typescript
import { BookmarkService } from "@/stub/bookmarks/v1/bookmark_service_pb";
```

- [ ] **Step 2: export 追加 (notificationClient の隣)**

```typescript
// Bookmarks domain client (bookmarks.v1)
export const bookmarkClient = createClient(BookmarkService, transport);
```

---

## Task 4: BFF `POST/DELETE /api/bookmarks/[postId]`

**Files:** Create `src/app/api/bookmarks/[postId]/route.ts`。

- [ ] **Step 1: 実装**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { bookmarkClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { postId } = await params;
    const headers = buildGrpcHeaders(req.headers);
    await bookmarkClient.bookmark({ postId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Bookmark");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { postId } = await params;
    const headers = buildGrpcHeaders(req.headers);
    await bookmarkClient.unbookmark({ postId }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, "Unbookmark");
  }
}
```

---

## Task 5: BFF `GET /api/bookmarks` (list)

**Files:** Create `src/app/api/bookmarks/route.ts`。

post hydration は backend 側 (`ListBookmarks` use_case 内) で完了済、BFF はそのまま PostView に変換せず post protos を返す。frontend hook 側で既存 `@/modules/post/lib/mappers` (or post slice の mapper) を流用する。

`@/modules/post/lib/post-view` に既存 mapper があるか確認、無ければ proto を view にしている既存 hook を参照して同 mapper を再利用する。

仕様確認: `@/modules/post/hooks/usePosts` または `usePost` の中で post proto → PostView 変換が行われている。BFF はその変換を呼び出すパスを採用する。

**Files (verify):** `src/modules/post/lib/post-view.ts` をチェックして mapper export 名を確認 (例: `postProtoToView`、`mapPostToView` 等)。確認できなければ feed BFF (`src/app/api/feed/route.ts` 等) の同 pattern を参照、同形 import で `Post::V1::Post` proto を `PostView` に変換。

- [ ] **Step 1: 実装 (mapper 名は実装時確認)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { bookmarkClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { postProtoToView } from "@/modules/post/lib/post-view";  // 名前は実装時に既存 hook の import から確定

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await bookmarkClient.listBookmarks({ limit, cursor }, { headers });
    return NextResponse.json({
      posts: (res.posts || []).map(postProtoToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListBookmarks");
  }
}
```

> **Implementation note:** `postProtoToView` 関数名は推定。実装時に `src/modules/post/lib/post-view.ts` / `src/app/api/feed/route.ts` 等を grep して既存 mapper を確認、同じものを再利用すること。見つからない場合は feed BFF 内のインライン変換ロジックを bookmarks BFF にも複製。

---

## Task 6: BFF `POST /api/bookmarks/status` (batch)

**Files:** Create `src/app/api/bookmarks/status/route.ts`。

- [ ] **Step 1: 実装**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { bookmarkClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const postIds: string[] = Array.isArray(body?.postIds) ? body.postIds : [];
    if (postIds.length === 0) {
      return NextResponse.json({ bookmarked: {} });
    }
    const res = await bookmarkClient.getBookmarkStatus({ postIds }, { headers });
    return NextResponse.json({ bookmarked: res.bookmarked || {} });
  } catch (error: unknown) {
    return handleApiError(error, "GetBookmarkStatus");
  }
}
```

---

## Task 7: hook `useBookmark` (single + toggle)

**Files:** Create `src/modules/bookmarks/hooks/useBookmark.ts`。

social `useBlock` 同形: initial fetch + bookmark/unbookmark action。

- [ ] **Step 1: 実装**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";

interface StatusResponse { bookmarked: Record<string, boolean> }

export function useBookmark(postId: string | null | undefined) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId || !getAuthToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<StatusResponse>(
          "/api/bookmarks/status",
          { method: "POST", body: { postIds: [postId] } }
        );
        if (cancelled) return;
        setIsBookmarked(!!res.bookmarked?.[postId]);
      } catch (e) {
        console.error("useBookmark fetch error", e);
      }
    })();
    return () => { cancelled = true };
  }, [postId]);

  const bookmark = useCallback(async () => {
    if (!postId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch(`/api/bookmarks/${encodeURIComponent(postId)}`, { method: "POST" });
      setIsBookmarked(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const unbookmark = useCallback(async () => {
    if (!postId || !getAuthToken()) return;
    setLoading(true);
    try {
      await authFetch(`/api/bookmarks/${encodeURIComponent(postId)}`, { method: "DELETE" });
      setIsBookmarked(false);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const toggle = useCallback(async () => {
    if (isBookmarked) return unbookmark();
    return bookmark();
  }, [isBookmarked, bookmark, unbookmark]);

  return { isBookmarked, bookmark, unbookmark, toggle, loading };
}
```

---

## Task 8: hook `useBookmarkStatusBatch`

**Files:** Create `src/modules/bookmarks/hooks/useBookmarkStatusBatch.ts`。

social `useBlockStatusBatch` 同形 (batch fetch + lookup helper)。

- [ ] **Step 1: 実装**

```typescript
"use client";

import { useEffect, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { BookmarkStatusMap } from "../types";

interface Response { bookmarked: BookmarkStatusMap }

export function useBookmarkStatusBatch(postIds: string[]) {
  const [bookmarked, setBookmarked] = useState<BookmarkStatusMap>({});
  const [loading, setLoading] = useState(false);

  const key = postIds.join(",");

  useEffect(() => {
    if (!getAuthToken() || postIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await authFetch<Response>(
          "/api/bookmarks/status",
          { method: "POST", body: { postIds } }
        );
        if (cancelled) return;
        setBookmarked(res.bookmarked || {});
      } catch (e) {
        console.error("useBookmarkStatusBatch error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isBookmarked = (id: string): boolean => bookmarked[id] ?? false;

  return { bookmarked, isBookmarked, loading };
}
```

---

## Task 9: hook `useBookmarkList`

**Files:** Create `src/modules/bookmarks/hooks/useBookmarkList.ts`。

social `useFollowList` 同形 (useSWRInfinite + flat array + loadMore)。

- [ ] **Step 1: 実装**

```typescript
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedBookmarksResponse } from "../types";

export function useBookmarkList() {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedBookmarksResponse | null): string | null => {
    if (!token) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/bookmarks${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedBookmarksResponse>(getKey, fetcher, { revalidateOnFocus: false });

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

## Task 10: `PostCardBinding` に bookmark icon 追加

**Files:** Modify `src/modules/post/components/PostCardBinding.tsx`。

reactions JSX 末尾に bookmark button を追加、`useBookmark(post.id)` で wire up。

- [ ] **Step 1: import 追加**

```typescript
import { useBookmark } from "@/modules/bookmarks";
```

- [ ] **Step 2: hook 呼出 + button 追加**

旧 (line 17):
```typescript
const { isLiked, getLikesCount, toggleLike, loading } = usePostLike();
```

新 (隣に hook 追加):
```typescript
const { isLiked, getLikesCount, toggleLike, loading } = usePostLike();
const { isBookmarked, toggle: toggleBookmark, loading: bookmarkLoading } = useBookmark(post.id);
```

reactions JSX の末尾 (visibility === "private" の span の直前 or 後ろ) に bookmark button:

旧:
```tsx
const reactions = (
  <>
    <button type="button" onClick={handleLikeClick} ...>...</button>
    <Link href={detailHref || ...} ...>...</Link>
    {post.visibility === "private" && (
      <span className="text-text-muted" aria-label="非公開">🔒</span>
    )}
  </>
);
```

新:
```tsx
const handleBookmarkClick = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  toggleBookmark().catch(() => {});
};

const reactions = (
  <>
    <button type="button" onClick={handleLikeClick} ...>...</button>
    <Link href={detailHref || ...} ...>...</Link>
    <button
      type="button"
      onClick={handleBookmarkClick}
      disabled={bookmarkLoading}
      className="flex items-center gap-1 hover:text-text-primary disabled:opacity-50"
      aria-pressed={isBookmarked}
      aria-label={isBookmarked ? "ブックマークを解除" : "ブックマーク"}
    >
      <span aria-hidden="true">{isBookmarked ? "🔖" : "🏷"}</span>
    </button>
    {post.visibility === "private" && (
      <span className="text-text-muted" aria-label="非公開">🔒</span>
    )}
  </>
);
```

> **Note:** icon は `🔖` (bookmarked) / `🏷` (un-bookmarked) を採用。spec の rx-sns capture は bookmark icon (リボン形) を使うが、emoji セットには適切な outline/filled bookmark icon が無いため近似で代替。後続 polish で lucide-react svg に置換余地。

---

## Task 11: `/bookmarks/page.tsx` を実装に置換

**Files:** Modify `src/app/bookmarks/page.tsx`。

stub の「ブックマーク機能は準備中です。」表示を、`useBookmarkList` 経由の post 一覧に置き換え。

- [ ] **Step 1: 全置換**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useBookmarkList } from "@/modules/bookmarks";

export default function BookmarksPage() {
  const { posts, hasMore, loading, error, loadMore } = useBookmarkList();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">ブックマーク</h1>
      </div>

      {loading && posts.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="text-3xl" aria-hidden="true">🔖</span>
          <p className="pt-3 text-text-primary">ブックマークはまだありません</p>
          <p className="pt-1 text-sm text-text-secondary">
            投稿をブックマークすると、ここに表示されます
          </p>
        </div>
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

empty state は rx-sns 準拠の icon + 2 段テキスト (`docs/superpowers/specs/2026-06-17-bookmarks-slice-design.md` Grounding 節 + 実 capture 参照)。

---

## Task 12: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -30
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑
- build 緑、新 `/api/bookmarks*` route 3 件登場、`/bookmarks` route が stub → 実装 (route 出力は変わらず Static or Dynamic)
- lint baseline 同等 (5 errors / 7 warnings、本 PR 増減なし)

- [ ] **Step 2: route 出力 smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/api/bookmarks|/bookmarks" | /usr/bin/head -10
```

期待: `/api/bookmarks`、`/api/bookmarks/[postId]`、`/api/bookmarks/status`、`/bookmarks` 全部出る。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 9 new (8 file + plan) + 3 modify = **12 files**。

> Note: stub regen は B1 で完了済、本 PR では stub 触らない。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-bookmarks-b2-frontend
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-17-bookmarks-b2-frontend.md
/usr/bin/git commit -s -m "feat(bookmarks): frontend full vertical (types + hooks + BFFs + PostCard + /bookmarks page, B2)"
```

push しない。

---

## Deferred

- **/dev/ui mock section 追加**: bookmarks の visual sandbox、別 PR で polish
- **post detail page (/posts/[id]) の bookmark icon visual confirm**: PostCardBinding が consume されている path 全てで自動的に bookmark icon が表示されるため、追加実装不要だが visual smoke 推奨
- **Zustand store 化**: 同一 post の複数 PostCard が出るシナリオ (例: 同 post を feed + post detail で同時表示) の state 同期、本 PR では SWR cache 共有で十分、必要時に別 PR で
- **lucide-react bookmark svg icon 置換**: emoji の `🔖` / `🏷` を kept、後続 polish

## Self-Review

- **Spec coverage (B2 範囲)**: types + 3 hook + 4 BFFs (1 file が POST/DELETE 両方、batch + list が別 file) + grpc.ts client + PostCardBinding + /bookmarks page = 全項目
- **Placeholder 無し**: 全 file 完全 code、Task 5 (list BFF) のみ `postProtoToView` の名前確認の implementation note 残し
- **既存パターン踏襲**: social S4 + notifications N4 と同 layout、`useSWRInfinite` の getKey pattern、polling 系 hook なし (bookmarks は polling 不要)
- **PostCardBinding 修正**: react-hooks rules を守るため hook 呼出は早期 return より上、event handler は inline で定義
- **検証**: tsc / build / lint baseline 維持、新 3 route 登場、`/bookmarks` page が stub から実装に置換
