# PostCardBinding useEffect redundancy removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `src/modules/post/components/PostCardBinding.tsx` の `useEffect(() => { setInitialState(...) }, [post.id])` を撤去する。Q4b で導入した eslint-disable コメントごと不要。

**Architecture:** PR #654 (PostLike Zustand hoist) で `seed` (= `setInitialState` alias) は idempotent に、`isLiked(postId, fallback)` / `getLikesCount(postId, fallback)` は fallback 付き selector になった。**結果として PostCardBinding の useEffect は完全に redundant** — 初回 render で store entry が無い時は fallback が `post.liked` / `post.likesCount` を返し、user の like 操作後は store エントリが selector に反映される。useEffect を撤去しても挙動は同じ。

**Tech Stack:** Next.js 16 / React 19 / TypeScript。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-post-card-binding-deps`
- branch: `refactor/post-card-binding-deps` (origin/main = `bc3ed635` base)
- 検証: `pnpm exec tsc --noEmit` 緑 + `pnpm build` 緑 + `pnpm lint` (baseline 27 problems と同等以下に維持)
- 触らない: `usePostLike` hook 本体 (`setInitialState` export は forward-compat で残す)、`postLikeStore` 内部の `seed` action、他 PostCard 関連、他 module

## File Structure

- Modify: `services/frontend/workspace/src/modules/post/components/PostCardBinding.tsx`

---

## Task 1: useEffect 撤去 + 不要 import を削除

**Files:** Modify `src/modules/post/components/PostCardBinding.tsx`。

- [ ] **Step 1: 該当 file を Read で確認 (現状 80 行程度)**

- [ ] **Step 2: 編集**

以下の変更を適用:

1. ファイル冒頭の `import { useEffect } from "react";` を削除 (useEffect 不要になる)
2. `const { isLiked, getLikesCount, toggleLike, setInitialState, loading } = usePostLike();` から `setInitialState` を削除:
   ```tsx
   const { isLiked, getLikesCount, toggleLike, loading } = usePostLike();
   ```
3. 直後の useEffect ブロック全体を削除 (`useEffect(() => { setInitialState(...); }, [post.id]);` 周辺のコメント含む):
   ```tsx
   // 削除対象 (推定 L19-23):
   useEffect(() => {
     setInitialState(post.id, post.liked, post.likesCount);
     // Intentionally only depend on post.id: re-running on liked/likesCount changes
     // would clobber the user's most recent like toggle when SWR re-injects a stale snapshot.
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [post.id]);
   ```

`isLiked(post.id, post.liked)` と `getLikesCount(post.id, post.likesCount)` の **fallback 引数**が store エントリ不在時に `post.liked` / `post.likesCount` を返すため、seed は不要 (PR #654 で確立した idempotent 動作)。

- [ ] **Step 3: 型チェック**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-post-card-binding-deps/services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
```

緑必須。

---

## Task 2: build / lint で検証 + commit

- [ ] **Step 1: `pnpm build` 緑確認**

```bash
pnpm build 2>&1 | /usr/bin/tail -15
```

- [ ] **Step 2: `pnpm lint`**

```bash
pnpm lint 2>&1 | /usr/bin/tail -10
```

baseline = 27 problems (7 errors, 20 warnings)。**期待**: eslint-disable 行を削った分、disable directive 警告が 1 件減るか、もしくは exhaustive-deps 警告が出ない (deps が正しく自動推論される)。総数で baseline 以下、新 violation ゼロ必須。

- [ ] **Step 3: ブラウザ動作確認 (任意、controller が puppeteer で /dev/ui キャプチャ)**

`useEffect` 撤去で挙動が変わっていないか視覚確認。implementer は skip 可、controller 判断。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-post-card-binding-deps
/usr/bin/git add services/frontend/workspace/src/modules/post/components/PostCardBinding.tsx docs/superpowers/plans/2026-06-14-post-card-binding-deps.md
/usr/bin/git commit -s -m "refactor(posts): drop redundant useEffect seed in PostCardBinding"
```

push しない。

---

## Self-Review

- **Spec coverage**: Q4b の defer 項目 (`PostCardBinding.useEffect` deps 単純化) を解消。
- **Additive / build-green**: usePostLike / postLikeStore / 他 component 無改変、`setInitialState` export は残す (forward-compat)。
- **動作変更ゼロ**: 撤去前後で fallback semantics により初期表示と toggle 後表示が同じ。
- **lint 改善**: eslint-disable comment 1 行削減で baseline 以下。
