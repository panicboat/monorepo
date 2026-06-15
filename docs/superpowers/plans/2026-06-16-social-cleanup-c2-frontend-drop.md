# Social Cleanup C2: drop legacy frontend (relationship module + BFFs + socialStore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 旧 `src/modules/relationship/*` ・旧 BFFs (10 routes) ・dead `src/stores/socialStore.ts` を全 drop。同時に唯一の external consumer (`src/app/api/guest/casts/[id]/route.ts` の follow status 参照) を `socialFollowClient` (= social/v1) に切り替え、`src/lib/grpc.ts` から legacy relationship client 2 個も drop する。これで frontend 側の relationship/v1 依存をゼロにする。

**Architecture:** **Pure deletion + 1 file migration + grpc.ts trim**。新 hook (S4) も新 UI (S5) もこの drop に依存しない (`@/modules/social` のみ使用)。

**Tech Stack:** Next.js 16 / TypeScript / connect-es。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` (Decomposition > cleanup 節)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c2-frontend-drop`、branch `chore/social-cleanup-c2-frontend-drop` (origin/main = `b300d32d`、C1 #682 マージ後)。**push しない**。
- 触らない: 新 `src/modules/social/*`、`src/stub/relationship/*` (stub は C4 で proto と一緒に drop)、monolith、proto、他 slice、portfolio mapper。

### Survey 結果 (確認済)

外部 consumer:
- `src/app/api/guest/casts/[id]/route.ts` だけが `@/stub/relationship/v1/follow_service_pb` + `followClient` を直接 import (cast profile の visibility=PRIVATE 時に follow status を見る)
- `src/lib/grpc.ts` だけが legacy `followClient` / `blockClient` を export
- page / component で legacy `useFollow` / `useBlockedBy` / `useFollowRequests` / `useSocialStore` を import している箇所は **無い**
- 10 legacy BFF route ファイルは relationship module 経由でのみ呼ばれていた → relationship module 削除と同時に dead

`/api/cast/guests/[userId]/blocked-by/route.ts` は spec 上「symmetric model では privacy 理由で非提供」とされる `ListBlockedBy` を expose していた legacy。delete のみ。

### `src/app/api/guest/casts/[id]/route.ts` の migration

旧 (line 7, 40-45):
```typescript
import { FollowStatus } from "@/stub/relationship/v1/follow_service_pb";
// ...
const followResponse = await followClient.getFollowStatus(
  { castUserIds: [castUserId] },
  headers
);
const status = followResponse.statuses[castUserId];
canViewDetails = status === FollowStatus.APPROVED;
```

新:
```typescript
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";
// ...
const followResponse = await socialFollowClient.getFollowStatus(
  { targetAccountIds: [castUserId] },
  headers
);
const status = followResponse.statuses[castUserId];
canViewDetails = status === FollowStatus.APPROVED;
```

(import の `followClient` も `socialFollowClient` に置換)

注意: `FollowStatus.APPROVED` enum 値は両 stub で同じ命名 (connect-es は `FOLLOW_STATUS_APPROVED` の prefix を strip するため両側で `APPROVED` 文字列)。enum 整数値も両側 `3` で互換 (relationship 旧 enum も APPROVED=3、social 新 enum も APPROVED=3)。

### `src/lib/grpc.ts` の trim

drop:
```typescript
import { FollowService } from "@/stub/relationship/v1/follow_service_pb";
import { BlockService } from "@/stub/relationship/v1/block_service_pb";
// ...
export const followClient = createClient(FollowService, transport);
export const blockClient = createClient(BlockService, transport);
```

保持:
- `socialFollowClient` / `socialBlockClient` は変名せずそのまま (本 PR は drop に専念、rename は YAGNI)

## File Structure

**Delete (合計 ~17 file):**
- `src/modules/relationship/` 全体 (8 file: index.ts, types.ts, hooks/{index,useFollow,useBlockedBy,useFollowRequests}.ts, lib/{index,api-mappers}.ts)
- `src/app/api/cast/blocks/route.ts`
- `src/app/api/cast/blocks/status/route.ts`
- `src/app/api/cast/followers/route.ts`
- `src/app/api/cast/following/requests/route.ts`
- `src/app/api/cast/following/requests/count/route.ts`
- `src/app/api/cast/following/requests/[guestUserId]/approve/route.ts`
- `src/app/api/cast/following/requests/[guestUserId]/reject/route.ts`
- `src/app/api/cast/guests/[userId]/blocked-by/route.ts`
- `src/app/api/guest/following/route.ts`
- `src/app/api/guest/following/status/route.ts`
- `src/stores/socialStore.ts`

**Modify (2 file):**
- `src/app/api/guest/casts/[id]/route.ts` (import + client + param name 置換)
- `src/lib/grpc.ts` (2 import + 2 export 削除)

---

## Task 1: `src/modules/relationship/` 全削除

- [ ] **Step 1: ディレクトリ確認**

```bash
cd services/frontend/workspace
/usr/bin/find src/modules/relationship -type f
```

期待: 8 file 列挙 (`index.ts`, `types.ts`, `hooks/index.ts`, `hooks/useFollow.ts`, `hooks/useBlockedBy.ts`, `hooks/useFollowRequests.ts`, `lib/index.ts`, `lib/api-mappers.ts`)。

- [ ] **Step 2: 全削除**

```bash
/usr/bin/rm -rf src/modules/relationship
```

---

## Task 2: legacy BFF 10 file 削除

- [ ] **Step 1: 削除**

```bash
cd services/frontend/workspace
/usr/bin/rm src/app/api/cast/blocks/status/route.ts
/usr/bin/rm src/app/api/cast/blocks/route.ts
/usr/bin/rmdir src/app/api/cast/blocks
/usr/bin/rm src/app/api/cast/followers/route.ts
/usr/bin/rmdir src/app/api/cast/followers
/usr/bin/rm src/app/api/cast/following/requests/count/route.ts
/usr/bin/rmdir src/app/api/cast/following/requests/count
/usr/bin/rm src/app/api/cast/following/requests/[guestUserId]/approve/route.ts
/usr/bin/rmdir src/app/api/cast/following/requests/[guestUserId]/approve
/usr/bin/rm src/app/api/cast/following/requests/[guestUserId]/reject/route.ts
/usr/bin/rmdir src/app/api/cast/following/requests/[guestUserId]/reject
/usr/bin/rmdir src/app/api/cast/following/requests/[guestUserId]
/usr/bin/rm src/app/api/cast/following/requests/route.ts
/usr/bin/rmdir src/app/api/cast/following/requests
/usr/bin/rmdir src/app/api/cast/following
/usr/bin/rm src/app/api/cast/guests/[userId]/blocked-by/route.ts
/usr/bin/rmdir src/app/api/cast/guests/[userId]/blocked-by
/usr/bin/rm src/app/api/guest/following/status/route.ts
/usr/bin/rmdir src/app/api/guest/following/status
/usr/bin/rm src/app/api/guest/following/route.ts
/usr/bin/rmdir src/app/api/guest/following
```

> **Note**: `rmdir` は空ディレクトリのみ削除。`[userId]` や他兄弟 route が残るディレクトリ (例: `src/app/api/cast/guests/[userId]/`) は触らない (`/usr/bin/rmdir` が non-empty で失敗するのは OK、無視で問題なし)。

- [ ] **Step 2: 残骸確認**

```bash
/usr/bin/find src/app/api/cast/blocks src/app/api/cast/followers src/app/api/cast/following src/app/api/guest/following 2>&1 | /usr/bin/head -5
```

期待: 全部 "No such file or directory"。

---

## Task 3: `src/stores/socialStore.ts` 削除

- [ ] **Step 1: 削除**

```bash
/usr/bin/rm src/stores/socialStore.ts
```

---

## Task 4: `src/app/api/guest/casts/[id]/route.ts` migration

**Files:** Modify `src/app/api/guest/casts/[id]/route.ts`。

- [ ] **Step 1: line 2 の import**

旧:
```typescript
import { castClient, offerClient, followClient } from "@/lib/grpc";
```

新:
```typescript
import { castClient, offerClient, socialFollowClient } from "@/lib/grpc";
```

- [ ] **Step 2: line 7 の stub import**

旧:
```typescript
import { FollowStatus } from "@/stub/relationship/v1/follow_service_pb";
```

新:
```typescript
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";
```

- [ ] **Step 3: line 40-43 の RPC 呼出**

旧:
```typescript
const followResponse = await followClient.getFollowStatus(
  { castUserIds: [castUserId] },
  headers
);
```

新:
```typescript
const followResponse = await socialFollowClient.getFollowStatus(
  { targetAccountIds: [castUserId] },
  headers
);
```

---

## Task 5: `src/lib/grpc.ts` trim

**Files:** Modify `src/lib/grpc.ts`。

- [ ] **Step 1: line 11-12 削除**

```typescript
import { FollowService } from "@/stub/relationship/v1/follow_service_pb";
import { BlockService } from "@/stub/relationship/v1/block_service_pb";
```

- [ ] **Step 2: line 41-43 削除 (comment 含む)**

```typescript
// Relationship domain clients (legacy relationship.v1 — kept for old /api/cast/*, /api/guest/* BFFs)
export const followClient = createClient(FollowService, transport);
export const blockClient = createClient(BlockService, transport);
```

- [ ] **Step 3: line 45 の comment 更新**

旧:
```typescript
// Social domain clients (social.v1 — new symmetric account-based follow/block)
```

新:
```typescript
// Social domain clients (social.v1 — symmetric account-based follow/block)
```

(コメント内の "new" は legacy が消えた今、不要)

---

## Task 6: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑 (legacy refs が全て消えた状態)
- build 緑、旧 `/api/cast/*` と `/api/guest/following` route が出力に出ない、`/api/guest/casts/[id]` は残る
- lint baseline 同等 (新規 error 増加無し)

- [ ] **Step 2: orphan reference 確認**

```bash
/usr/bin/grep -rn "@/modules/relationship\|@/stores/socialStore\|@/stub/relationship/v1/follow_service\|@/stub/relationship/v1/block_service\|followClient\b\|blockClient\b\|useSocialStore" src --include="*.tsx" --include="*.ts" 2>&1 | /usr/bin/head -10
```

期待: 出力無し (空)。これで relationship 由来の symbol 参照がゼロを確認。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 18 deleted file + 2 modified file + plan = **21 files** (= relationship module 8 + BFF 10 + socialStore 1 = 19 deletions、guest/casts/[id] + grpc.ts = 2 modifications)。

> 注: 上で 18 と書いたのは plan の見積もり。実際の rmdir のリスト記述では削除 file カウントが微妙にずれる可能性あり (例えば `src/modules/relationship/` の file 数を grep で confirm 推奨)。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c2-frontend-drop
/usr/bin/git add -A services/frontend/workspace docs/superpowers/plans/2026-06-16-social-cleanup-c2-frontend-drop.md
/usr/bin/git commit -s -m "chore(social): drop legacy frontend (relationship module + BFFs + socialStore)"
```

push しない。

---

## Deferred

- **C3** (旧 monolith handler / use_cases / adapters drop + Feed adapter の social 切替): `slices/relationship/grpc/*`、`slices/relationship/use_cases/*`、`Feed::Adapters::{Block,Follow}Adapter` を social schema 参照に置換、`Post::Adapters::FollowAdapter` 等 cross-slice の relationship 経由処理
- **C4** (旧 relationship.v1 proto + stub drop): `proto/relationship/v1/*` 削除、stub 再生成、`src/stub/relationship/*` 削除
- **C5** (旧 relationship schema 物理 drop): `relationship.follows` / `relationship.blocks` DROP TABLE + DROP SCHEMA migration

## Self-Review

- **Spec coverage**: cleanup 多段 PR の第 2 段 (frontend drop)
- **Placeholder 無し**: 全 file path + 削除 / 修正コマンドが完全列挙
- **Surgical changes**: legacy のみ drop、新 social の touch なし
- **External consumer migration**: `guest/casts/[id]/route.ts` が follow status 参照を `socialFollowClient` に切替 (enum 値互換性は両 stub で APPROVED=3 確認)
- **Orphan reference check**: Step 2 で grep 結果が空であることを smoke
- **検証**: tsc / build / lint baseline 維持、route 出力で legacy 消失 + 新 route 残存を確認
