# A2: Drop legacy post/feed/comments BFFs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A1 (#669) で frontend hooks が drop され orphan 化した 10 件の legacy BFF route ファイルを delete。`/api/cast/timeline`, `/api/feed/{cast,guest}`, `/api/guest/{likes,comments,timeline}` 配下を一括 cleanup。

**Architecture:** **Surgical removal**。caller ゼロ確証済 (controller pre-survey)。ディレクトリごと削除。`/api/feed/cast`、`/api/feed/guest` は親 dir `/api/feed/` を残す (F4a の `/api/feed/route.ts` = symmetric が同居)。

**Tech Stack:** Next.js 16 / TypeScript / pnpm。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-bffs`
- branch: `chore/drop-legacy-bffs` (origin/main = `3871a4f3` base、#669 マージ後)
- 検証: `pnpm exec tsc --noEmit` 緑 + `pnpm build` 緑 + `pnpm lint` baseline 同等
- 削除対象 10 file:
  - `services/frontend/workspace/src/app/api/cast/timeline/route.ts`
  - `services/frontend/workspace/src/app/api/feed/cast/route.ts`
  - `services/frontend/workspace/src/app/api/feed/guest/route.ts`
  - `services/frontend/workspace/src/app/api/guest/comments/route.ts`
  - `services/frontend/workspace/src/app/api/guest/comments/[id]/route.ts`
  - `services/frontend/workspace/src/app/api/guest/comments/[id]/replies/route.ts`
  - `services/frontend/workspace/src/app/api/guest/likes/route.ts`
  - `services/frontend/workspace/src/app/api/guest/likes/status/route.ts`
  - `services/frontend/workspace/src/app/api/guest/timeline/route.ts`
  - `services/frontend/workspace/src/app/api/guest/timeline/[id]/route.ts`
- 触らない: 他 `/api/cast/*` (blocks, following, profile, onboarding 等)、他 `/api/guest/*` (profile, following, search, tags 等)、`/api/feed/route.ts` (F4a の symmetric)、新 `/api/posts/*` (Q4a)、shared helpers (`@/lib/api-helpers`, `@/lib/request`, `@/lib/grpc`)。
- **caller ゼロ確証** (controller pre-survey 済): 上記 10 BFF パスに対する `"/api/cast/timeline"` `"/api/feed/cast"` `"/api/feed/guest"` `"/api/guest/likes"` `"/api/guest/comments"` `"/api/guest/timeline"` の client 側 (`src/app/api/` 以外) 参照は **全て 0 件**。

### 削除前提の再確証 (実装前必須、念のため)

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-bffs
for p in "/api/cast/timeline" "/api/feed/cast" "/api/feed/guest" "/api/guest/likes" "/api/guest/comments" "/api/guest/timeline"; do
  count=$(/usr/bin/grep -rln "\"$p\"\\|'$p'\\|\\\`$p\\\`" services/frontend/workspace/src --include="*.ts" --include="*.tsx" 2>/dev/null | /usr/bin/grep -v "/app/api/" | /usr/bin/wc -l)
  echo "$p: $count clients (must be 0)"
done
```

期待: 全 6 prefix で **0 clients**。1 件以上ヒットしたら **BLOCKED で escalate**。

## File Structure

- Delete: 10 files (上記 list)
- Modify: なし (ディレクトリは routing で自動的に消える、Next.js は file-based routing)

---

## Task 1: caller ゼロ再確証 + 10 file 削除

**Files:** Delete 10 files。

- [ ] **Step 1: 削除前 grep で caller ゼロ確認** (Context §「再確証」コマンドを実行)

期待: 全 6 prefix で `0 clients`。出力に 1 以上があれば **BLOCKED** で escalate。

- [ ] **Step 2: 10 file を git rm**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-bffs
/usr/bin/git rm services/frontend/workspace/src/app/api/cast/timeline/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/feed/cast/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/feed/guest/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/guest/comments/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/guest/comments/[id]/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/guest/comments/[id]/replies/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/guest/likes/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/guest/likes/status/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/guest/timeline/route.ts
/usr/bin/git rm services/frontend/workspace/src/app/api/guest/timeline/[id]/route.ts
```

git rm でディレクトリ内の最後の file が消えれば、空ディレクトリも自動撤去される (git は file-tracking、Next.js は file-based routing なので routes 自体も消える)。

---

## Task 2: build / lint で検証 + commit

- [ ] **Step 1: build (route 表で削除後 BFFs が消えていることを確認)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-bffs/services/frontend/workspace
pnpm build 2>&1 | /usr/bin/tail -30
```

緑必須。route 一覧から 10 件分の dynamic route (`/api/cast/timeline`、`/api/feed/cast`、`/api/feed/guest`、`/api/guest/comments`、`/api/guest/comments/[id]`、`/api/guest/comments/[id]/replies`、`/api/guest/likes`、`/api/guest/likes/status`、`/api/guest/timeline`、`/api/guest/timeline/[id]`) が消えていること。新 `/api/posts/*` (Q4a) と `/api/feed` (F4a) は継続出力。

- [ ] **Step 2: 型チェック + lint**

```bash
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm lint 2>&1 | /usr/bin/tail -10
```

両方 baseline 同等以下。**期待**: `cast/onboarding/images/route.ts` の lint error (legacy 系 5 errors の 1 つ) は本 PR 範囲外で残存、`/api/cast/timeline/route.ts` が呼び出していた api-mappers helper の dead-code 検知が出る可能性 → 出れば次 A3 で対処。

- [ ] **Step 3: diff stat 確認**

```bash
/usr/bin/git diff --stat origin/main HEAD
```

期待: 10 file delete + plan = 11 files。**他に変更ゼロ**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-drop-legacy-bffs
/usr/bin/git add services/frontend/workspace/src/app/api docs/superpowers/plans/2026-06-14-drop-legacy-bffs.md
/usr/bin/git commit -s -m "chore(posts): drop legacy post/feed/comments BFF routes"
```

push しない。

---

## Deferred (本 A2 では実施しない)

- `/api/cast/*` の他 routes (blocks, following, profile, onboarding 等) → 別 A step で個別判断 (active code 含む可能性)
- `/api/guest/*` の他 routes (profile, following, search, tags 等) → 同上
- `api-mappers.ts` / `mappers.ts` (post lib 配下) の dead exports cleanup → A3
- `post/types.ts` の `CastPost` 型 → A3
- monolith backend (handler methods / use_cases / adapters) → A4
- proto messages drop → A5

## Self-Review

- **caller ゼロ確証**: pre-survey + 削除前再確認の 2 段防御
- **動作変更ゼロ**: 10 BFF は dead code (A1 で frontend hook drop 済、production component 0 件)
- **scope 厳守**: `/api/feed/` 親 dir は F4a の `route.ts` を残すため touch せず、子 dir のみ削除
- **後続 PR の準備**: A3 で `api-mappers` / `mappers` の dead exports を整理
