# A3: Drop legacy post types + mappers + api-mappers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A1 (#669) + A2 (#670) で全 frontend caller が drop された 3 legacy module ファイルを delete し、barrel exports を整理する。

**Architecture:** **Surgical removal**。caller ゼロ確証済 (controller pre-survey)。`/api/cast/blocks` 等の surviving BFFs は `@/modules/relationship/lib/api-mappers` や `@/modules/trust/lib/api-mappers` を import しており、post slice の api-mappers/mappers/types は完全に dead code。

**Tech Stack:** Next.js 16 / TypeScript / pnpm。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-types-mappers`
- branch: `chore/drop-legacy-post-types-mappers` (origin/main = `653043fa` base、#670 マージ後)
- 検証: `pnpm exec tsc --noEmit` 緑 + `pnpm build` 緑 + `pnpm lint` baseline (12 problems) 同等以下
- 削除対象 3 file:
  - `src/modules/post/types.ts` (CastPost / Comment / LikeState 等の legacy types)
  - `src/modules/post/lib/mappers.ts` (client-side mappers、`mapApiToPost` 等)
  - `src/modules/post/lib/api-mappers.ts` (server-side mappers、`mapProtoPostToJson` 等)
- 更新対象 2 file:
  - `src/modules/post/lib/index.ts` (`export * from "./mappers";` 削除、`./post-view` `./post-mappers` 保持)
  - `src/modules/post/index.ts` (`export * from "./types";` 削除、`./hooks` `./lib` 保持)
- 触らない: 新 Q4a 産物 (`./post-view`, `./post-mappers`、`PostView` ベース)、新 hooks (`usePosts`, `usePost`, `usePostLike`)、`components/PostCardBinding.tsx`、他 module (`@/modules/relationship/lib/api-mappers` 等)

### 削除前提の確証 (実装前必須)

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-types-mappers

# 1. types.ts consumers (lib/mappers.ts 内部参照のみ期待)
/usr/bin/grep -rln "@/modules/post/types\b" services/frontend/workspace/src --include="*.ts" --include="*.tsx" 2>/dev/null

# 2. lib/mappers.ts consumers (0 件期待)
/usr/bin/grep -rln "@/modules/post/lib/mappers\b\|from \"./mappers\"" services/frontend/workspace/src --include="*.ts" --include="*.tsx" 2>/dev/null | /usr/bin/grep -v "src/modules/post/lib/index\.ts$\|src/modules/post/lib/mappers\.ts$"

# 3. lib/api-mappers.ts consumers (0 件期待)
/usr/bin/grep -rln "@/modules/post/lib/api-mappers\b\|mapProtoPostToJson\|mapProtoPostsListToJson" services/frontend/workspace/src --include="*.ts" --include="*.tsx" 2>/dev/null | /usr/bin/grep -v "src/modules/post/lib/api-mappers\.ts$"
```

期待:
- (1) は `services/frontend/workspace/src/modules/post/lib/mappers.ts` 1 件 (mappers.ts が types.ts を import)。drop すると 0 件。
- (2) は **空** (index.ts と mappers.ts 自身を除く)
- (3) は **空** (api-mappers.ts 自身を除く)

異なれば **BLOCKED で escalate**。

## File Structure

- Delete: `src/modules/post/types.ts`
- Delete: `src/modules/post/lib/mappers.ts`
- Delete: `src/modules/post/lib/api-mappers.ts`
- Modify: `src/modules/post/lib/index.ts`
- Modify: `src/modules/post/index.ts`

---

## Task 1: caller ゼロ再確証 + 3 file 削除

- [ ] **Step 1: 削除前 grep 3 回実行** (Context §「削除前提の確証」)

期待結果と異なれば **BLOCKED** で escalate。

- [ ] **Step 2: 3 file を git rm**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-types-mappers
/usr/bin/git rm services/frontend/workspace/src/modules/post/types.ts
/usr/bin/git rm services/frontend/workspace/src/modules/post/lib/mappers.ts
/usr/bin/git rm services/frontend/workspace/src/modules/post/lib/api-mappers.ts
```

---

## Task 2: barrel exports 整理

- [ ] **Step 1: `src/modules/post/lib/index.ts` 更新**

現状:
```ts
export * from "./mappers";
export * from "./post-view";
export * from "./post-mappers";
```

を以下に変更 (`./mappers` 削除):
```ts
export * from "./post-view";
export * from "./post-mappers";
```

- [ ] **Step 2: `src/modules/post/index.ts` 更新**

現状:
```ts
export * from "./types";
export * from "./hooks";
export * from "./lib";
```

を以下に変更 (`./types` 削除):
```ts
export * from "./hooks";
export * from "./lib";
```

---

## Task 3: build / lint で検証 + commit

- [ ] **Step 1: build**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-types-mappers/services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -25
```

両方緑必須。tsc が `Cannot find module '@/modules/post/types'` 等を出したら BLOCKED (まだ caller が残っている)。

- [ ] **Step 2: lint**

```bash
pnpm lint 2>&1 | /usr/bin/tail -10
```

baseline (12 problems) 同等以下。

- [ ] **Step 3: diff stat 確認**

```bash
/usr/bin/git diff --stat origin/main HEAD
```

期待: 3 delete + 2 modify + plan = 6 files。**他に変更ゼロ**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-post-types-mappers
/usr/bin/git add services/frontend/workspace/src/modules/post docs/superpowers/plans/2026-06-14-drop-legacy-post-types-mappers.md
/usr/bin/git commit -s -m "chore(posts): drop legacy post types + mappers + api-mappers"
```

push しない。

---

## Deferred (本 A3 では実施しない)

- 他 module の legacy cleanup (portfolio module、trust slice 等) → 個別の cleanup PR
- monolith backend (handler methods + use_cases + adapters) → A4
- proto messages drop (`CastPost`, `FeedPost`, `LikeCastPost*` etc.) → A5
- DB columns drop (`posts.cast_user_id`, `likes.guest_user_id` 等) → A5 以降

## Self-Review

- **caller ゼロ確証**: types/mappers/api-mappers の各々を grep で 2 段防御
- **動作変更ゼロ**: 3 file は dead code (A1/A2 で全 caller drop 済)
- **新 Q4a 産物保護**: `./post-view`, `./post-mappers` は barrel に残し続ける
- **A4 への準備**: frontend 側の legacy types/mappers が完全に消えるため、A4 で monolith 側を drop しても frontend と整合
