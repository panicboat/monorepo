# A1: Drop legacy post hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Q4 / Q5 で全 production consumer が無くなった 4 legacy frontend hooks を drop し、barrel export を整理する。後続 PR で BFF / 旧 type / monolith 側を drop する基盤を作る。

**Architecture:** **Surgical removal**。production component (page.tsx / dev/ui/page.tsx etc.) は既に `usePosts` / `usePost` / `usePostLike` / `useFeed` 等の symmetric hook に乗り換え済 (Q4a/Q4b/F4a/F4b)、4 hook は dead code。barrel export を整理して未参照を確証してから drop。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / pnpm。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-hooks`
- branch: `chore/drop-legacy-post-hooks` (origin/main = `bc3ed635` base)
- 検証: `pnpm exec tsc --noEmit` 緑 + `pnpm build` 緑 + `pnpm lint` baseline 同等以下
- 削除対象 (4 files):
  - `services/frontend/workspace/src/modules/post/hooks/useCastPosts.ts`
  - `services/frontend/workspace/src/modules/post/hooks/useLike.ts`
  - `services/frontend/workspace/src/modules/post/hooks/useComments.ts`
  - `services/frontend/workspace/src/modules/post/hooks/useTimeline.ts` (`useGuestPost` re-export 含む)
- 更新対象 (1 file): `services/frontend/workspace/src/modules/post/hooks/index.ts` の export 整理

### 削除前提の確証 (実装前必須)

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-hooks
/usr/bin/grep -rln "useCastPosts\|useTimeline\b\|useGuestPost\|useLike\b\|useComments\b" services/frontend/workspace/src --include="*.ts" --include="*.tsx" | /usr/bin/grep -v "^services/frontend/workspace/src/modules/post/hooks/\(useCastPosts\|useTimeline\|useLike\|useComments\)\.ts$\|^services/frontend/workspace/src/modules/post/hooks/index\.ts$"
```

期待: **出力なし** (hook 実装ファイル + barrel index 以外に caller が存在しないこと)。**caller が見つかった場合は BLOCKED で escalate**、本 PR の前提が崩れる。

### 触らない

- 新 symmetric hooks (`usePost`, `usePosts`, `usePostLike`, `useFeed`)
- BFFs (`/api/cast/*`, `/api/guest/*`, `/api/feed/{cast,guest}`)、A2 で drop 予定
- 旧 `post/types.ts` の `CastPost` 型、A3 で drop 予定
- monolith backend、A4-A5 で drop 予定

## File Structure

- Delete: `src/modules/post/hooks/useCastPosts.ts`
- Delete: `src/modules/post/hooks/useLike.ts`
- Delete: `src/modules/post/hooks/useComments.ts`
- Delete: `src/modules/post/hooks/useTimeline.ts`
- Modify: `src/modules/post/hooks/index.ts` (legacy export 削除、新 hook export 保持)

---

## Task 1: caller ゼロ確認 + 4 file 削除

**Files:** Delete 4 files。

- [ ] **Step 1: 削除前 grep で caller ゼロ確認** (Context §「削除前提の確証」コマンドを実行)

期待: 出力なし。出力があれば **BLOCKED** で escalate。

- [ ] **Step 2: 4 file 削除**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-hooks
/usr/bin/git rm services/frontend/workspace/src/modules/post/hooks/useCastPosts.ts
/usr/bin/git rm services/frontend/workspace/src/modules/post/hooks/useLike.ts
/usr/bin/git rm services/frontend/workspace/src/modules/post/hooks/useComments.ts
/usr/bin/git rm services/frontend/workspace/src/modules/post/hooks/useTimeline.ts
```

---

## Task 2: `hooks/index.ts` から legacy export 削除

**Files:** Modify `src/modules/post/hooks/index.ts`。

- [ ] **Step 1: 現状確認 + 編集**

```bash
/usr/bin/cat services/frontend/workspace/src/modules/post/hooks/index.ts
```

現状 (推定):

```ts
export { useCastPosts } from "./useCastPosts";
export { useLike } from "./useLike";
export { useComments } from "./useComments";
export { useTimeline, useGuestPost } from "./useTimeline";
export { usePosts } from "./usePosts";
export { usePost } from "./usePost";
export { usePostLike } from "./usePostLike";
```

を以下に書き換え (legacy 行を削除):

```ts
export { usePosts } from "./usePosts";
export { usePost } from "./usePost";
export { usePostLike } from "./usePostLike";
```

- [ ] **Step 2: タイプチェック**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-hooks/services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
```

緑必須。

---

## Task 3: build / lint で検証 + commit

- [ ] **Step 1: build**

```bash
pnpm build 2>&1 | /usr/bin/tail -25
```

緑必須。

- [ ] **Step 2: lint**

```bash
pnpm lint 2>&1 | /usr/bin/tail -10
```

baseline (12 problems = 5 errors + 7 warnings、#668 マージ後) 同等以下。本 PR で新 violation を出さないこと。**注**: legacy 5 errors のうち、当該 hook を参照していたものがあれば消えるはず。

- [ ] **Step 3: diff stat 確認**

```bash
/usr/bin/git diff --stat origin/main HEAD
```

期待: 4 file 削除 + 1 file 修正 + plan = 6 files。**他に変更ゼロ**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-hooks
/usr/bin/git add services/frontend/workspace/src/modules/post/hooks docs/superpowers/plans/2026-06-14-drop-legacy-post-hooks.md
/usr/bin/git commit -s -m "chore(posts): drop legacy frontend hooks (useCastPosts/useLike/useComments/useTimeline)"
```

push しない。

---

## Self-Review

- **caller ゼロ確証**: 削除前 grep で実装ファイル + barrel 以外の参照なしを実証
- **動作変更ゼロ**: 4 hook は dead code、production code から参照されていないため delete 動作影響なし
- **Additive 性 (A1 範囲)**: 新 hook (`usePosts` / `usePost` / `usePostLike`) と barrel の symmetric 部分は無改変
- **後続 PR の準備**: A2 = legacy BFFs drop (hooks が呼んでいた `/api/cast/timeline`, `/api/feed/{cast,guest}`, `/api/guest/{likes,comments,timeline}` 等)
