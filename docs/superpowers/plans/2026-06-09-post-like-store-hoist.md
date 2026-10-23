# Post like state hoist (Zustand store) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `usePostLike` の internal state を **Zustand store backing** に切り替え、複数 `PostCardBinding` instance 間で like 状態を共有する。Q4b code review で挙がった Important #1 (hook-per-instance state 競合) + #2 (`useEffect` の hydrate race) を一括解消し、Q5 feed timeline (同じ post を複数箇所に表示する場面) に備える。

**Architecture:** **Additive、build-green**。既存 `usePostLike` の **return shape を変えない** ことで `PostCardBinding.tsx` / `/posts/[id]/page.tsx` / `dev/ui` は無改変。中身を新規 Zustand store (`stores/postLikeStore.ts`) 経由に書き換えるだけ。`setInitialState` の semantics は「entry が無いときのみ seed (idempotent)」に変える → 同一 post が再描画されても直前の like 操作を上書きしない。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Zustand 5 (既存 `^5.0.13`、authStore / socialStore / uiStore で利用済) / pnpm。

**前提:** posts Q4 (PR #653) main マージ済。`usePostLike` は `src/modules/post/hooks/usePostLike.ts` に存在、`PostCardBinding.tsx` から呼び出されている。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-post-like-hoist`。frontend app root: `services/frontend/workspace`。branch `feat/post-like-hoist` (origin/main base、tracking 済)。**push しない・PR は親が判断**。
- 検索は **`/usr/bin/grep`** / `/usr/bin/find`。import alias `@/` → `src/`。
- **テストランナーは無い**。検証は `pnpm exec tsc --noEmit` (緑必須) + `pnpm build` (緑必須)。`pnpm lint` は環境問題でスキップ。
- ブラウザ実機確認は controller が判断 (前回と同じ `/dev/ui` puppeteer 手順)。
- **build-green / additive**: 以下は無改変:
  - `src/modules/post/components/PostCardBinding.tsx` (consumer、API 不変なので触らない)
  - `src/modules/post/components/PostComposer.tsx`
  - `src/app/posts/[id]/page.tsx`
  - `src/app/dev/ui/page.tsx`
  - `src/modules/post/lib/post-view.ts` / `post-mappers.ts`
  - 旧 `src/modules/post/hooks/{useLike,useCastPosts,useTimeline,useComments}.ts` (cleanup フェーズで撤去)
  - `src/lib/auth/fetch.ts` / `src/lib/swr.ts` 等 core lib

### 既存パターン（踏襲する）

- **Zustand store**: `src/stores/authStore.ts` を template に。`create<State>()((set, get) => ({...}))` パターン。`persist` middleware は使わない (like state はメモリ常駐で OK、ログアウト時にクリアされる挙動と整合)。
- **既存 `usePostLike`** (`src/modules/post/hooks/usePostLike.ts:1-116`) の **export shape**:
  ```ts
  function usePostLike(): {
    like: (postId: string) => Promise<number | null>;
    unlike: (postId: string) => Promise<number | null>;
    toggleLike: (postId: string, currentlyLiked: boolean) => Promise<number | null>;
    fetchLikeStatus: (postIds: string[]) => Promise<Record<string, boolean>>;
    setInitialState: (postId: string, liked: boolean, likesCount: number) => void;
    isLiked: (postId: string, fallback?: boolean) => boolean;
    getLikesCount: (postId: string, fallback?: number) => number;
    state: Record<string, { liked: boolean; likesCount: number }>;
    loading: boolean;
  }
  ```
  **本 PR でこの戻り型は変更しない** (PostCardBinding が依存)。`loading` は global state として残す。
- **API パス**: `/api/posts/${postId}/like` POST/DELETE、`/api/posts/likes/status?post_ids=...` GET (Q4a で確定済、変えない)。

### Design 決定

- store の state は `Record<string, LikeEntry>` (既存と同形)、map に変えない (シリアル可能性 + 既存 export 互換のため)。
- `setInitialState(id, liked, count)` を「entry 既存なら no-op、無いときのみ seed」セマンティクスに変更 → SWR revalidate が古い snapshot を投げ込んでも user の最新 toggle を巻き戻さない。これにより Q4b の `useEffect deps を [post.id] のみ` の防御も意味的に冗長になるが、surgical の原則で `PostCardBinding.tsx` は触らない。
- `loading` は global シングルトン。複数 like 操作が同時走行することは UX 上ほぼないため簡素化のまま。
- like / unlike が backend エラー時、現状の `console.error + throw` を維持 (observability)。

## File Structure

- Create: `src/stores/postLikeStore.ts` (Zustand store)
- Modify: `src/modules/post/hooks/usePostLike.ts` (実装を store backing に書き換え、export shape は不変)

> `PostCardBinding.tsx` / 他 consumer は **touch しない**。

---

## Task 1: Zustand store `postLikeStore` 作成

**Files:** Create `src/stores/postLikeStore.ts`。

- [ ] **Step 1: 既存 store パターンを Read で確認**

Run: `cd services/frontend/workspace && /usr/bin/sed -n '1,40p' src/stores/uiStore.ts`
理由: persist 無し + シンプルな state/action のレイアウト確認 (authStore は persist 有りで参考にならない部分がある)。

- [ ] **Step 2: store 実装を作成**

```ts
import { create } from "zustand";

import { authFetch } from "@/lib/auth/fetch";
import { getAuthToken } from "@/lib/swr";

export interface LikeEntry {
  liked: boolean;
  likesCount: number;
}

interface LikeApiResponse {
  likesCount: number;
}

interface LikeStatusResponse {
  liked: Record<string, boolean>;
}

interface PostLikeState {
  entries: Record<string, LikeEntry>;
  loading: boolean;

  /** Seed an entry only if not already present. Idempotent across re-mounts and SWR revalidates. */
  seed: (postId: string, liked: boolean, likesCount: number) => void;
  /** Force-overwrite an entry (use sparingly; for cases where server is authoritative). */
  set: (postId: string, entry: LikeEntry) => void;
  /** Toggle on. Returns the new likesCount, or null when unauthenticated. */
  like: (postId: string) => Promise<number | null>;
  /** Toggle off. Returns the new likesCount, or null when unauthenticated. */
  unlike: (postId: string) => Promise<number | null>;
  /** Convenience: pick like/unlike based on the current liked flag. */
  toggleLike: (postId: string, currentlyLiked: boolean) => Promise<number | null>;
  /** Batch-fetch initial like flags from the server. Does not mutate store state. */
  fetchLikeStatus: (postIds: string[]) => Promise<Record<string, boolean>>;
  /** Selectors */
  isLiked: (postId: string, fallback?: boolean) => boolean;
  getLikesCount: (postId: string, fallback?: number) => number;
}

export const usePostLikeStore = create<PostLikeState>()((set, get) => ({
  entries: {},
  loading: false,

  seed: (postId, liked, likesCount) => {
    if (get().entries[postId]) return;
    set((s) => ({ entries: { ...s.entries, [postId]: { liked, likesCount } } }));
  },

  set: (postId, entry) => {
    set((s) => ({ entries: { ...s.entries, [postId]: entry } }));
  },

  like: async (postId) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot like: not authenticated");
      return null;
    }
    set({ loading: true });
    try {
      const data = await authFetch<LikeApiResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "POST" }
      );
      set((s) => ({
        entries: { ...s.entries, [postId]: { liked: true, likesCount: data.likesCount } },
      }));
      return data.likesCount;
    } catch (e) {
      console.error("Like error:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  unlike: async (postId) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot unlike: not authenticated");
      return null;
    }
    set({ loading: true });
    try {
      const data = await authFetch<LikeApiResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "DELETE" }
      );
      set((s) => ({
        entries: { ...s.entries, [postId]: { liked: false, likesCount: data.likesCount } },
      }));
      return data.likesCount;
    } catch (e) {
      console.error("Unlike error:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  toggleLike: async (postId, currentlyLiked) => {
    return currentlyLiked ? get().unlike(postId) : get().like(postId);
  },

  fetchLikeStatus: async (postIds) => {
    if (postIds.length === 0) return {};
    const data = await authFetch<LikeStatusResponse>(
      `/api/posts/likes/status?post_ids=${encodeURIComponent(postIds.join(","))}`,
      { method: "GET" }
    );
    return data.liked || {};
  },

  isLiked: (postId, fallback = false) => get().entries[postId]?.liked ?? fallback,
  getLikesCount: (postId, fallback = 0) => get().entries[postId]?.likesCount ?? fallback,
}));
```

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -15`
Expected: 緑 (store 単体で完結、consumer はまだ usePostLike 経由なのでこの段階では未参照)。

---

## Task 2: `usePostLike` を store backing に書き換え

**Files:** Modify `src/modules/post/hooks/usePostLike.ts`。

- [ ] **Step 1: 全置換**

```ts
"use client";

import { useShallow } from "zustand/react/shallow";

import { usePostLikeStore } from "@/stores/postLikeStore";

/**
 * Subscribes to the shared post-like store.
 * Returns the same shape as before the Zustand hoist (Q4b follow-up):
 * state is now singleton across instances, so multiple PostCardBinding rendering
 * the same post stay in sync after a like toggle.
 *
 * `setInitialState` has idempotent seed semantics: it only writes when the entry
 * is absent. Re-mounts and SWR revalidates that re-inject the original snapshot
 * therefore cannot clobber the user's latest toggle.
 */
export function usePostLike() {
  // Reactive selectors — re-render only when shallow-equal slice changes.
  const { entries, loading } = usePostLikeStore(
    useShallow((s) => ({ entries: s.entries, loading: s.loading }))
  );

  // Stable action handles (zustand store functions are referentially stable).
  const like = usePostLikeStore((s) => s.like);
  const unlike = usePostLikeStore((s) => s.unlike);
  const toggleLike = usePostLikeStore((s) => s.toggleLike);
  const fetchLikeStatus = usePostLikeStore((s) => s.fetchLikeStatus);
  const seed = usePostLikeStore((s) => s.seed);

  return {
    like,
    unlike,
    toggleLike,
    fetchLikeStatus,
    /** Alias preserved for callers that expect setInitialState. Behavior is idempotent seed. */
    setInitialState: seed,
    isLiked: (postId: string, fallback = false) => entries[postId]?.liked ?? fallback,
    getLikesCount: (postId: string, fallback = 0) =>
      entries[postId]?.likesCount ?? fallback,
    state: entries,
    loading,
  };
}
```

選択肢: `useShallow` が `zustand/react/shallow` で利用可能 (zustand v5)。利用不可なら `usePostLikeStore((s) => s.entries)` + `usePostLikeStore((s) => s.loading)` の 2 サブスクライブに分割 (どちらでも動作同等)。**実装前に `/usr/bin/grep -rn "useShallow" services/frontend/workspace/src` で既存使用例を確認**、無ければ別パターンに切替えても OK。zustand バージョン確認 `/usr/bin/grep zustand services/frontend/workspace/package.json`。

- [ ] **Step 2: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -15`
Expected: 緑。`PostCardBinding.tsx` での `usePostLike()` 戻り型 destructure (`isLiked`, `getLikesCount`, `toggleLike`, `setInitialState`, `loading`) が型整合。

---

## Task 3: build / commit

**Files:** なし (検証 + commit)。

- [ ] **Step 1: 本番ビルド**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | /usr/bin/tail -30`
Expected: 成功。`/posts/[id]` / `/dev/ui` 等の page 出力継続。

- [ ] **Step 2: diff stat 確認**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-post-like-hoist && /usr/bin/git diff --stat origin/main HEAD --`
Expected: `src/stores/postLikeStore.ts` (新規) + `src/modules/post/hooks/usePostLike.ts` (modify) + plan 1 件。**他に変更なし**。`PostCardBinding.tsx` / page / dev/ui に diff があれば NG (それは scope 外、`git checkout -- <file>` で巻き戻す)。

- [ ] **Step 3: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-post-like-hoist
/usr/bin/git add services/frontend/workspace/src/stores/postLikeStore.ts services/frontend/workspace/src/modules/post/hooks/usePostLike.ts docs/superpowers/plans/2026-06-09-post-like-store-hoist.md
/usr/bin/git commit -s -m "refactor(posts): hoist post-like state to Zustand store"
```
（push しない。）

---

## Deferred（本 plan では実施しない）

- **`PostCardBinding.tsx` の `useEffect` deps の単純化** (Q4b で `[post.id]` 限定にした防御。store の seed が idempotent になれば論理的に冗長だが、コードを触らないことで PostCardBinding を Q4 と同じ状態で残す)。
- **like state の persist 化** (リロード時に保持) → 現状要件にない、ログアウト時に消える挙動が望ましい。
- **like 操作の楽観更新** (今は server 戻り値で確定) → UX 改善の余地はあるが scope 外。
- **複数 like 操作の per-post `loading` 化** → global loading のまま、UI 側で問題があれば別 PR。

## Self-Review（作成者チェック済）

- **Goal coverage**: store backing で hoist 完了、`PostCardBinding` 複数 instance の state 共有が成立。`setInitialState` の idempotent seed semantics で Q4b Important #2 race も意味的に解消。
- **Additive / build-green**: consumer ファイル (`PostCardBinding`, page, dev/ui) 0 行変更。export shape 不変なので呼び出し側型エラー無し。
- **Placeholder 無し**: store + hook 共に完全コード。
- **型 / 命名整合**: `LikeEntry` / `Record<string, LikeEntry>` / `loading: boolean` を export shape と完全一致させた。`setInitialState` は alias として残し、内部 action 名は `seed` で意図 (idempotent) を表明。
- **テスト方針**: frontend runner 無し → `pnpm build` 緑 + ブラウザ実機 `/dev/ui` で視覚確認 (controller 担当)。store 単体テストは YAGNI、Zustand 自体は信頼。
- **WHY コメント**: `usePostLike` の docstring に「複数 instance state 共有」「seed idempotent で巻き戻し防止」の WHY を明記、Q4b review との文脈をつなぐ。
