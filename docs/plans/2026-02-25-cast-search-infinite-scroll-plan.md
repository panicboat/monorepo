# Cast Search Infinite Scroll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** キャスト検索ページに無限スクロール機能を追加し、共通の InfiniteScroll コンポーネントで既存実装をリファクタリングする。

**Architecture:** 汎用 `InfiniteScroll` UIコンポーネントを作成し、IntersectionObserver によるトリガー・ローディング表示・終端メッセージを共通化。キャスト検索用に `useInfiniteCasts` フックを追加し、既存の4箇所の無限スクロール実装を共通コンポーネントに置き換える。

**Tech Stack:** React 19, Next.js (App Router), TypeScript, IntersectionObserver API

**Design Doc:** [2026-02-25-cast-search-infinite-scroll-design.md](2026-02-25-cast-search-infinite-scroll-design.md)

---

## Phase 1: 共通コンポーネント作成

### Task 1: InfiniteScroll UIコンポーネント作成

**Files:**
- Create: `web/nyx/workspace/src/components/ui/InfiniteScroll.tsx`

**Step 1: InfiniteScroll コンポーネントを作成**

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface InfiniteScrollProps {
  /** 追加データがあるか */
  hasMore: boolean;
  /** 追加読み込み中か */
  loading: boolean;
  /** 追加読み込み関数 */
  onLoadMore: () => void;
  /** IntersectionObserver の rootMargin (default: "100px") */
  rootMargin?: string;
  /** 終端メッセージ (optional) */
  endMessage?: string;
  /** children */
  children: React.ReactNode;
}

export function InfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  rootMargin = "100px",
  endMessage,
  children,
}: InfiniteScrollProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin,
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [handleObserver, rootMargin]);

  return (
    <>
      {children}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      )}

      {!hasMore && !loading && endMessage && (
        <div className="text-center py-4 text-sm text-text-muted">
          {endMessage}
        </div>
      )}
    </>
  );
}
```

**Step 2: コンポーネントをエクスポート**

`web/nyx/workspace/src/components/ui/index.ts` を確認し、必要であれば InfiniteScroll をエクスポートに追加。

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/components/ui/InfiniteScroll.tsx
git commit -m "feat(ui): add InfiniteScroll component"
```

---

## Phase 2: キャスト検索に無限スクロール実装

### Task 2: useInfiniteCasts フック作成

**Files:**
- Create: `web/nyx/workspace/src/modules/portfolio/hooks/useInfiniteCasts.ts`
- Modify: `web/nyx/workspace/src/modules/portfolio/hooks/index.ts`

**Step 1: useInfiniteCasts フックを作成**

```typescript
"use client";

import { useCallback, useState, useRef } from "react";

type StatusFilter = "all" | "online" | "new" | "ranking";

type CastProfile = {
  name: string;
  slug: string;
  tagline: string;
  bio: string;
  imageUrl: string;
  avatarUrl: string;
  age?: number;
  areas: { id: string; name: string; prefecture: string; code: string }[];
  genres: { id: string; name: string; slug: string; displayOrder: number }[];
  tags: { label: string; count: number }[];
  isOnline?: boolean;
  isPrivate?: boolean;
};

type CastItem = {
  profile: CastProfile | null;
  plans: { id: string; name: string; price: number; duration: number }[];
};

interface SearchResponse {
  items: CastItem[];
  nextCursor: string;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

interface UseInfiniteCastsOptions {
  genreId?: string;
  tag?: string;
  status?: StatusFilter;
  query?: string;
}

export function useInfiniteCasts(options: UseInfiniteCastsOptions) {
  const [casts, setCasts] = useState<CastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const cursorRef = useRef<string | null>(null);

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (options.status && options.status !== "all") {
        params.set("status", options.status);
      }
      if (options.genreId) {
        params.set("genreId", options.genreId);
      }
      if (options.query?.trim()) {
        params.set("query", options.query.trim());
      }
      if (options.tag) {
        params.set("tag", options.tag);
      }
      if (cursor) {
        params.set("cursor", cursor);
      }
      return `/api/guest/search?${params.toString()}`;
    },
    [options.genreId, options.tag, options.status, options.query]
  );

  const fetchInitial = useCallback(async () => {
    if (initialized || loading) {
      return;
    }

    setLoading(true);
    try {
      const url = buildUrl();
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch casts");
      }
      const data: SearchResponse = await res.json();
      setCasts(data.items);
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor || null;
      setInitialized(true);
      return data;
    } catch (e) {
      console.error("Fetch casts error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [buildUrl, initialized, loading]);

  const fetchMore = useCallback(async () => {
    if (!initialized || !hasMore || loadingMore || !cursorRef.current) {
      return;
    }

    setLoadingMore(true);
    try {
      const url = buildUrl(cursorRef.current);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to fetch more casts");
      }
      const data: SearchResponse = await res.json();
      setCasts((prev) => {
        const existingIds = new Set(prev.map((c) => c.profile?.slug));
        const newCasts = data.items.filter(
          (c) => !existingIds.has(c.profile?.slug)
        );
        return [...prev, ...newCasts];
      });
      setHasMore(data.hasMore);
      cursorRef.current = data.nextCursor || null;
      return data;
    } catch (e) {
      console.error("Fetch more casts error:", e);
      throw e;
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, initialized, hasMore, loadingMore]);

  const reset = useCallback(() => {
    setCasts([]);
    setHasMore(true);
    cursorRef.current = null;
    setInitialized(false);
  }, []);

  return {
    casts,
    loading,
    loadingMore,
    hasMore,
    fetchInitial,
    fetchMore,
    reset,
    initialized,
  };
}
```

**Step 2: hooks/index.ts にエクスポートを追加**

`web/nyx/workspace/src/modules/portfolio/hooks/index.ts` に以下を追加:

```typescript
export { useInfiniteCasts } from "./useInfiniteCasts";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/portfolio/hooks/useInfiniteCasts.ts
git add web/nyx/workspace/src/modules/portfolio/hooks/index.ts
git commit -m "feat(portfolio): add useInfiniteCasts hook"
```

---

### Task 3: search/page.tsx を無限スクロール対応に改修

**Files:**
- Modify: `web/nyx/workspace/src/app/(guest)/search/page.tsx`

**Step 1: インポートを追加**

```typescript
import { useInfiniteCasts } from "@/modules/portfolio/hooks";
import { InfiniteScroll } from "@/components/ui/InfiniteScroll";
```

**Step 2: フィルター変更時のリセットロジックを追加**

`fetchCasts` を `useInfiniteCasts` に置き換え、フィルター変更時に `reset()` → `fetchInitial()` を呼び出すように変更。

**Step 3: グリッド表示部分を InfiniteScroll でラップ**

```tsx
<InfiniteScroll
  hasMore={hasMore}
  loading={loadingMore}
  onLoadMore={fetchMore}
  endMessage="すべてのキャストを表示しました"
>
  <div className="grid grid-cols-2 gap-3">
    {casts.map((item, index) => {
      if (!item.profile) return null;
      return (
        <SearchCastCard
          key={item.profile.slug || index}
          cast={item.profile}
        />
      );
    })}
  </div>
</InfiniteScroll>
```

**Step 4: 動作確認**

1. ブラウザで `/search` にアクセス
2. 初期表示が20件であることを確認
3. スクロールで追加読み込みされることを確認
4. フィルター変更でリセットされることを確認

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/app/\(guest\)/search/page.tsx
git commit -m "feat(search): add infinite scroll to cast search"
```

---

## Phase 3: 既存コンポーネントのリファクタリング

### Task 4: ReviewListPage を InfiniteScroll 使用に変更

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/components/ReviewListPage.tsx`

**Step 1: InfiniteScroll をインポート**

```typescript
import { InfiniteScroll } from "@/components/ui/InfiniteScroll";
```

**Step 2: IntersectionObserver の独自実装を削除**

`observerRef`, `loadMoreRef`, `handleObserver` 関連のコードを削除。

**Step 3: レビューリストを InfiniteScroll でラップ**

```tsx
<InfiniteScroll
  hasMore={hasMore}
  loading={loadingMore}
  onLoadMore={fetchMore}
  endMessage="すべてのレビューを表示しました"
>
  <div className="space-y-3">
    {reviews.map((review) => (
      <ReviewCard
        key={review.id}
        review={review}
        showReviewerLink={targetType === "cast"}
      />
    ))}
  </div>
</InfiniteScroll>
```

**Step 4: 動作確認**

レビュー一覧ページで無限スクロールが正常に動作することを確認。

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/components/ReviewListPage.tsx
git commit -m "refactor(trust): use InfiniteScroll component in ReviewListPage"
```

---

### Task 5: TimelineFeed を InfiniteScroll 使用に変更

**Files:**
- Modify: `web/nyx/workspace/src/modules/feed/components/feed/TimelineFeed.tsx`

**Step 1: InfiniteScroll をインポート**

```typescript
import { InfiniteScroll } from "@/components/ui/InfiniteScroll";
```

**Step 2: IntersectionObserver の独自実装を削除**

`loadMoreRef` と Observer 関連の useEffect を削除。

**Step 3: フィードリストを InfiniteScroll でラップ**

```tsx
<InfiniteScroll
  hasMore={mode === "guest" && !items && hasMore}
  loading={loading && posts.length > 0}
  onLoadMore={() => {
    const filterParam =
      filter === "favorites"
        ? "favorites"
        : filter === "following"
          ? "following"
          : filter === "all" && isAuthenticated()
            ? "all"
            : undefined;
    loadMore(filterParam);
  }}
>
  {/* existing feed items */}
</InfiniteScroll>
```

**Step 4: 動作確認**

タイムラインで無限スクロールが正常に動作することを確認。

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/modules/feed/components/feed/TimelineFeed.tsx
git commit -m "refactor(feed): use InfiniteScroll component in TimelineFeed"
```

---

### Task 6: CastTimeline を InfiniteScroll 使用に変更

**Files:**
- Modify: `web/nyx/workspace/src/modules/feed/components/guest/CastTimeline.tsx`

**Step 1: InfiniteScroll をインポート**

```typescript
import { InfiniteScroll } from "@/components/ui/InfiniteScroll";
```

**Step 2: IntersectionObserver の独自実装を削除**

`loadMoreRef` と Observer 関連の useEffect を削除。

**Step 3: 投稿リストを InfiniteScroll でラップ（list/grid 両方）**

```tsx
{layout === "list" ? (
  <InfiniteScroll
    hasMore={hasMore}
    loading={loading && posts.length > 0}
    onLoadMore={loadMore}
  >
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  </InfiniteScroll>
) : (
  <InfiniteScroll
    hasMore={hasMore}
    loading={loading && posts.length > 0}
    onLoadMore={loadMore}
  >
    <GridView posts={posts} />
  </InfiniteScroll>
)}
```

**Step 4: 動作確認**

キャストプロフィールの投稿一覧で無限スクロールが正常に動作することを確認。

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/modules/feed/components/guest/CastTimeline.tsx
git commit -m "refactor(feed): use InfiniteScroll component in CastTimeline"
```

---

### Task 7: CommentSection を InfiniteScroll 使用に変更

**Files:**
- Modify: `web/nyx/workspace/src/modules/post/components/comments/CommentSection.tsx`

**Step 1: InfiniteScroll をインポート**

```typescript
import { InfiniteScroll } from "@/components/ui/InfiniteScroll";
```

**Step 2: IntersectionObserver の独自実装を削除**

`loadMoreRef` と Observer 関連の useEffect を削除。

**Step 3: コメントリストを InfiniteScroll でラップ**

```tsx
<InfiniteScroll
  hasMore={hasMore}
  loading={loading && comments.length > 0}
  onLoadMore={fetchMoreComments}
>
  <div className="divide-y divide-border">
    {comments.map((comment) => (
      // existing comment rendering
    ))}
  </div>
</InfiniteScroll>
```

**Step 4: 動作確認**

投稿詳細ページのコメントセクションで無限スクロールが正常に動作することを確認。

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/modules/post/components/comments/CommentSection.tsx
git commit -m "refactor(post): use InfiniteScroll component in CommentSection"
```

---

## Final: 全体テストと完了

### Task 8: 全体動作確認

**Step 1: 以下のページで無限スクロールが正常に動作することを確認**

1. `/search` - キャスト検索
2. `/timeline` - ゲストタイムライン
3. `/casts/[slug]` - キャストプロフィール（投稿一覧）
4. `/casts/[slug]/reviews` - レビュー一覧
5. `/timeline/[id]` - 投稿詳細（コメント）

**Step 2: リグレッションがないことを確認**

- 初期ロードが正常
- スクロールで追加読み込み
- 終端到達時の表示
- フィルター変更時のリセット

**Step 3: 最終コミット（必要であれば）**

```bash
git status
# 残りの変更があればコミット
```
