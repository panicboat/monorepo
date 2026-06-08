# Posts Q4b: frontend UI (PostCardBinding + PostComposer + 投稿詳細 + /dev/ui demo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** symmetric Post の **UI 層**を構築する: `PostView` ↔ 既存 `ui/post-card.tsx` の adapter (`PostCardBinding`)、投稿作成フォーム (`PostComposer`)、投稿詳細ページ (`/posts/[id]`)、`/dev/ui` への mock デモセクション追加。Q4a で配線した data 層 (hooks / BFF) を消費し、ブラウザ実機で視覚確認できる状態にする。

**Architecture:** **Additive、build-green**。Q4a の `usePosts` / `usePost` / `usePostLike` と `PostView` 型を消費。コメントは現状 `useComments` (旧 `/api/guest/comments` ベース、内部的に user_id 対称) を継続使用するが、**Q4b では comment 一覧描画はせず comment 件数表示のみ** (comments の UI rework は cleanup フェーズで ProfileService 化と同時に行う)。media 実アップロードは object storage 未配備なので **未対応**。投稿詳細はテキスト・media (サムネ表示)・like・コメント件数のみ。`PostCardBinding` は `usePostLike` を内部で持ち like toggle 完結。`PostComposer` は `onSubmit` prop を取り fetch は親 (= `usePosts.createPost`) に任せる純フォーム。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind / pnpm。既存 ui primitive (`ui/post-card`, `ui/button`, `ui/textarea`, `ui/avatar`) を再利用。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（§Frontend）。前提: Q4a 完了 (PR #653、`src/modules/post/lib/{post-view,post-mappers}.ts` + 4 BFF route + 3 hook が main base に存在)。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-frontend`。frontend app root: `services/frontend/workspace`。branch `feat/posts-frontend`（Q4a が既に 2 commit 乗っており、Q4b は **同じ branch に additive 追加**）。**push しない・PR は同じ #653 が更新されるだけなので handle 不要**。
- 検索は **`/usr/bin/grep`** / `/usr/bin/find`。import alias `@/` → `src/`。
- **テストランナーは無い**。検証は `pnpm exec tsc --noEmit` (緑必須) + `pnpm build` (緑必須)。`pnpm lint` は環境問題でスキップ。
- ブラウザ実機検証 (= `pnpm dev` + headless chrome / 手動目視) は plan の最終 task でガイダンスのみ提供、実行は controller (親) が判断。
- **build-green / additive**: 以下は**触らない**:
  - Q4a で作成した `src/modules/post/lib/post-view.ts` / `post-mappers.ts` / `app/api/posts/**` / `hooks/{usePosts,usePost,usePostLike}.ts`（修正したい点があれば controller に escalate）
  - `src/modules/post/types.ts` / `lib/mappers.ts` / `lib/api-mappers.ts` / `hooks/{useCastPosts,useLike,useComments,useTimeline}.ts`（旧、cleanup フェーズで撤去）
  - `src/components/ui/post-card.tsx` / `ui/button.tsx` / `ui/textarea.tsx` / `ui/avatar.tsx` 等の primitive (presentational なので拡張は次のスライス)
  - `src/lib/grpc.ts` 等の core lib
- `hooks/index.ts` と `lib/index.ts` は Q4a で更新済。Q4b では components が新規 namespace `src/modules/post/components/` に来るので、ルート `index.ts` (`export * from "./types"; export * from "./hooks"; export * from "./lib";`) には触らない（components は直接 import）。

### 既存パターン（profile P5c で確立、踏襲する）

- **module components 配置**: `src/modules/profile/components/{ProfileHeader,EditProfileModal,...}.tsx` と同じく `src/modules/post/components/` を新設。
- **dynamic page**: `src/app/u/[username]/page.tsx` がリファレンス。`"use client"` + `useParams<{...}>` + hook + loading/error early return。
- **PostCard primitive のシグネチャ** (`src/components/ui/post-card.tsx`):
  ```ts
  interface PostCardProps {
    author: { name: string; handle: string; avatarSrc?: string };
    time: string;
    body: string;
    images?: string[];
    reactions?: React.ReactNode;
    className?: string;
  }
  ```
  reactions は ReactNode slot で、PostCardBinding 側で like / コメント件数 / 詳細リンクを差し込む。

- **date helper**: `import { formatTimeAgo } from "@/lib/utils/date";` で `"2024-01-01T12:00:00Z" → "2d ago"`。

- **PostView の型** (Q4a):
  ```ts
  interface PostView {
    id, authorId, content, media: PostMediaView[], createdAt,
    author: PostAuthorView | null,  // { accountId, displayName, username, avatarUrl }
    likesCount, commentsCount, visibility: "public"|"private", hashtags[], liked
  }
  interface PostMediaView { id, mediaType: "image"|"video", url, thumbnailUrl, mediaId }
  interface SavePostPayload { id?, content, media?: {mediaType, mediaId}[], visibility?, hashtags? }
  ```

## File Structure

- Create: `src/modules/post/components/PostCardBinding.tsx`（`PostView` → `PostCard` adapter + like toggle）
- Create: `src/modules/post/components/PostComposer.tsx`（投稿作成フォーム、`SavePostPayload` を `onSubmit` に渡す純コンポーネント）
- Create: `src/app/posts/[id]/page.tsx`（投稿詳細ページ）
- Modify: `src/app/dev/ui/page.tsx`（mock データで `PostCardBinding` / `PostComposer` のセクションを末尾 additive 追加）

> 投稿一覧ページ (`/posts` のような index) は **作らない** — 一覧 = feed スライスの責務 (`feed timeline`)。Q4b は単体投稿 + コンポーズ + デモ視覚確認まで。

---

## Task 1: PostCardBinding（PostView → PostCard adapter + like toggle）

**Files:** Create `src/modules/post/components/PostCardBinding.tsx`。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PostCard } from "@/components/ui/post-card";
import { formatTimeAgo } from "@/lib/utils/date";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostLike } from "@/modules/post/hooks/usePostLike";

export interface PostCardBindingProps {
  post: PostView;
  /** Whether to wrap the body / time area with a link to the post detail page. */
  detailHref?: string;
  className?: string;
}

export function PostCardBinding({ post, detailHref, className }: PostCardBindingProps) {
  const { isLiked, getLikesCount, toggleLike, setInitialState, loading } = usePostLike();

  useEffect(() => {
    setInitialState(post.id, post.liked, post.likesCount);
  }, [post.id, post.liked, post.likesCount, setInitialState]);

  const liked = isLiked(post.id, post.liked);
  const likesCount = getLikesCount(post.id, post.likesCount);

  const authorName = post.author?.displayName || "名無し";
  const authorHandle = post.author?.username || post.authorId.slice(0, 8);
  const avatarSrc = post.author?.avatarUrl || undefined;

  const images = post.media
    .filter((m) => m.mediaType === "image")
    .map((m) => m.thumbnailUrl || m.url)
    .filter((u) => u.length > 0);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLike(post.id, liked).catch(() => {});
  };

  const reactions = (
    <>
      <button
        type="button"
        onClick={handleLikeClick}
        disabled={loading}
        className="flex items-center gap-1 hover:text-text-primary disabled:opacity-50"
        aria-pressed={liked}
        aria-label={liked ? "いいねを解除" : "いいね"}
      >
        <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
        <span>{likesCount}</span>
      </button>
      <Link
        href={detailHref || `/posts/${encodeURIComponent(post.id)}`}
        className="flex items-center gap-1 hover:text-text-primary"
        aria-label="コメント"
      >
        <span aria-hidden="true">💬</span>
        <span>{post.commentsCount}</span>
      </Link>
      {post.visibility === "private" && (
        <span className="text-text-muted" aria-label="非公開">🔒</span>
      )}
    </>
  );

  return (
    <PostCard
      author={{ name: authorName, handle: authorHandle, avatarSrc }}
      time={post.createdAt ? formatTimeAgo(post.createdAt) : ""}
      body={post.content}
      images={images.length > 0 ? images : undefined}
      reactions={reactions}
      className={className}
    />
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -20`
Expected: 緑（`PostCardProps` の `reactions: React.ReactNode` に Fragment を渡せる、`usePostLike` の戻り型と整合）。

---

## Task 2: PostComposer（投稿作成フォーム）

**Files:** Create `src/modules/post/components/PostComposer.tsx`。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import type { SavePostPayload } from "@/modules/post/lib/post-view";

export interface PostComposerProps {
  /** Called on submit with the form payload. Throws to surface an error to the user. */
  onSubmit: (payload: SavePostPayload) => Promise<unknown>;
  /** Optional initial content (for edit reuse later). */
  initialContent?: string;
  /** Optional initial visibility. Defaults to "public". */
  initialVisibility?: "public" | "private";
  className?: string;
}

const MAX_LENGTH = 1000;

export function PostComposer({
  onSubmit,
  initialContent = "",
  initialVisibility = "public",
  className,
}: PostComposerProps) {
  const [content, setContent] = useState(initialContent);
  const [isPrivate, setIsPrivate] = useState(initialVisibility === "private");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LENGTH;
  const canSubmit = !submitting && trimmed.length > 0 && !overLimit;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      try {
        await onSubmit({
          content: trimmed,
          visibility: isPrivate ? "private" : "public",
        });
        setContent("");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "投稿に失敗しました";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, trimmed, isPrivate, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className={className}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={4}
        aria-label="投稿内容"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <Toggle checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="非公開投稿" />
          <span>{isPrivate ? "非公開" : "公開"}</span>
        </label>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs ${overLimit ? "text-error" : "text-text-muted"}`}
            aria-live="polite"
          >
            {content.length}/{MAX_LENGTH}
          </span>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {submitting ? "投稿中…" : "投稿する"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Toggle の API 確認**

`src/components/ui/toggle.tsx` を Read で開いて `pressed` / `onPressedChange` のシグネチャを確認。違っていれば PostComposer の props 名を実装側に合わせる（`checked` / `onCheckedChange` 等）。**実装に合わせて plan の方を直す**（既存 primitive は無改変）。

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -20`
Expected: 緑。

---

## Task 3: 投稿詳細ページ `/posts/[id]`

**Files:** Create `src/app/posts/[id]/page.tsx`。

- [ ] **Step 1: 実装**

```tsx
"use client";

import { useParams } from "next/navigation";
import { usePost } from "@/modules/post/hooks/usePost";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { post, loading, error } = usePost(id || null);

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !post) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">投稿が見つかりませんでした。</main>;
  }

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <PostCardBinding post={post} />
      <p className="px-4 py-6 text-sm text-text-muted">
        コメント（{post.commentsCount} 件）の表示はコメントスライス UI 更新後に対応。
      </p>
    </main>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -20`
Expected: 緑。`/posts/[id]` route が Next の dynamic page として認識される。

---

## Task 4: `/dev/ui` mock セクション additive 追加

**Files:** Modify `src/app/dev/ui/page.tsx`。

- [ ] **Step 1: 既存内容を Read**

Run: `cd services/frontend/workspace && /usr/bin/cat src/app/dev/ui/page.tsx | /usr/bin/wc -l`
内容を Read で確認（`return ( <main>...</main> )` で終わる構造、`PostCard` import 済み）。

- [ ] **Step 2: imports と mock データを additive 追加**

ファイル冒頭の import 群末尾（`import type { ProfileView, AreaView } from "@/modules/profile/types";` の下）に追加:

```tsx
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { PostComposer } from "@/modules/post/components/PostComposer";
import type { PostView } from "@/modules/post/lib/post-view";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
```

`mockProfile` 定義の下に追加:

```tsx
  const mockPosts: PostView[] = [
    {
      id: "mock-1",
      authorId: "demo",
      content: "新作のお洋服届きました！今日はこれで出勤します🌷",
      media: [],
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      author: {
        accountId: "demo",
        displayName: "ゆな",
        username: "yuna",
        avatarUrl: "",
      },
      likesCount: 12,
      commentsCount: 3,
      visibility: "public",
      hashtags: ["新作", "渋谷"],
      liked: false,
    },
    {
      id: "mock-2",
      authorId: "guest-1",
      content: "今度の週末空いてる方いますか？",
      media: [],
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      author: {
        accountId: "guest-1",
        displayName: "ぱにっく",
        username: "panicboat",
        avatarUrl: "",
      },
      likesCount: 1,
      commentsCount: 0,
      visibility: "private",
      hashtags: [],
      liked: true,
    },
  ];

  const handleMockSubmit = async (payload: SavePostPayload) => {
    console.log("[dev/ui] mock submit:", payload);
  };
```

`new Date(Date.now() - ...)` は dev/ui 内ローカル変数で hydration mismatch 注意。SSR で確定値が欲しければ ISO 固定文字列に置き換えても OK（mock なのでどちらでも視覚確認可）。**確実に問題を避けるなら hardcode** に直す:

```tsx
      createdAt: "2026-06-08T11:55:00Z",
      ...
      createdAt: "2026-06-08T11:00:00Z",
```

実装ではこの hardcode 版を採用すること（`Date.now()` を component render に入れない方が dev 視覚確認が安定）。

- [ ] **Step 3: section を `<main>` 末尾の `</main>` の直前に additive 追加**

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-secondary">PostComposer</h2>
        <PostComposer onSubmit={handleMockSubmit} />
      </section>

      <section className="flex flex-col">
        <h2 className="px-4 pb-3 text-sm font-bold text-text-secondary">PostCardBinding</h2>
        {mockPosts.map((p) => (
          <PostCardBinding key={p.id} post={p} />
        ))}
      </section>
```

- [ ] **Step 4: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -20`
Expected: 緑。

---

## Task 5: build / dev サーバ案内 / commit

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 本番ビルド**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | /usr/bin/tail -30`
Expected: 成功。新 page `/posts/[id]` がビルド出力に dynamic page として登場。`/dev/ui` も継続出力。

- [ ] **Step 2: dev サーバ起動方法（controller 用ガイダンス、subagent は実行しない）**

```bash
# (controller が判断して起動)
cd services/frontend/workspace && pnpm dev
# ブラウザで http://localhost:3000/dev/ui を開き、PostComposer と PostCardBinding mock を視覚確認
# 投稿詳細の e2e は monolith gRPC + JWT 注入が必要。手順は memory [[local-e2e-run]]
```

subagent は本ステップ実行不要（コマンドガイダンスのみ）。

- [ ] **Step 3: コミット（signoff、Co-Authored-By 無し）**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-frontend
/usr/bin/git add services/frontend/workspace/src/modules/post/components services/frontend/workspace/src/app/posts services/frontend/workspace/src/app/dev/ui/page.tsx docs/superpowers/plans/2026-06-08-posts-q4b-frontend-ui.md
/usr/bin/git commit -s -m "feat(posts): add symmetric posts frontend UI (PostCardBinding + Composer + detail page)"
```
（push は親が判断、ここでは push しない。）

---

## Deferred（Q4b では実施しない）

- **コメント一覧描画**（`useComments` 連携、threaded reply）→ comments の symmetric 化と同時に cleanup フェーズで実施。Q4b は comment 件数表示のみ。
- **media 実アップロード**（`PostComposer` の画像添付ボタン）→ object storage 配備後。
- **投稿編集 UI**（既存投稿の `usePosts.updatePost` 利用）→ profile 編集と同じく EditPostModal を将来追加。
- **投稿削除確認 UI**（`usePosts.deletePost` への confirm dialog）→ 同上。
- **/posts index page**（全投稿一覧）→ feed スライスの timeline 責務。
- **author 名 link**（PostCardBinding の `@username` を `/u/[username]` 公開プロフィールへ）→ 軽い改善だが author に username が空のケースの fallback 戦略を要詰め、別 PR で。
- **Edge case 視覚確認**（media 4 枚以上 / video / hashtag 描画）→ Q4b スコープでは hardcode mock 2 件のみ。

## Self-Review（作成者チェック済）

- **Spec coverage（Q4b 範囲）**: §Frontend の「投稿コンポーズ / 投稿詳細 `/posts/[id]` / `PostCard` 活用 / like」を全て実装。**comments は件数表示のみ**で明示的に出して deferred セクションに記録（spec の「コメント機能は表示できる程度」要件と整合、UI rework は cleanup と並走）。
- **Additive で build-green**: Q4a が触ったファイル群と既存 primitive・旧 hooks に変更無し。新規 component と新規 page のみ追加。`/dev/ui` だけ additive 追記（既存 mock セクションは保持）。
- **Placeholder 無し**: 全 component / page / mock の完全コード提示。
- **型 / 命名整合**:
  - `PostCardBinding` の `usePostLike` 利用は Q4a の hook 戻り値型 (`isLiked(id, fallback)` / `getLikesCount(id, fallback)` / `toggleLike(id, currentlyLiked)` / `setInitialState(id, liked, count)`) と完全一致。
  - `PostComposer.onSubmit` は `SavePostPayload` を受け、`usePosts.createPost(payload)` シグネチャと型整合。
  - `PostCard` の `reactions: React.ReactNode` slot に Fragment を渡せる前提（型上 OK）。
  - dynamic params は `useParams<{id: string}>` で取得（client component で `params: Promise<{...}>` async 規約は server component 用、`useParams` は同期 hook）。`/u/[username]/page.tsx` のリファレンスパターンと一致。
  - `Toggle` の props 名は実装ファイル確認後、必要なら plan を書き換えて合わせる（既存 primitive 改変禁止）。
- **テスト方針**: frontend ランナー無し → `pnpm build` で型担保。視覚確認は `/dev/ui` の mock セクションで monolith 起動不要に確認可能。完全 e2e はメモリ [[local-e2e-run]] 手順で controller が実施判断。
- **dev/ui hydration 対策**: `Date.now()` を render 中に呼ばず、固定 ISO 文字列を使うよう Step 2 で明示。
