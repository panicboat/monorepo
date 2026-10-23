# Social Cleanup C4: drop legacy relationship.v1 proto + stubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 旧 `proto/relationship/v1/*` と monolith / frontend 両 stub から relationship.v1 を全 drop。C2 #683 で frontend 側、C3 #684 で monolith 側の consumer は全削除済なので、これは pure deletion。互換破壊あり (旧 stub に依存する外部 client は壊れるが、すでに本 repo 内に consumer なし)。

**Architecture:** **Pure deletion**。8 file (2 proto + 4 monolith stub + 2 frontend stub) を rm。buf 設定は変更不要 (relationship-specific 設定なし)、stub regenerator は単に何も出さなくなる。

**Tech Stack:** protobuf / connect-es / gRPC Ruby。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` Decomposition > cleanup 節。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c4-proto-drop`、branch `chore/social-cleanup-c4-proto-drop` (origin/main = `4729fce9`、C3 #684 マージ後)。**push しない**。
- 触らない: 新 `proto/social/v1/*`、`config/db/structure.sql` の relationship schema 関連 (C5 で物理 drop)、monolith / frontend の social code、他 slice、buf 設定 (relationship-specific 無し)。

### Survey 結果 (確認済)

- `services/monolith/workspace/slices/social/repositories/block_repository.rb:10` の "relationship is severed" は semantic comment、code reference 無し → 触らない
- proto/buf.yaml は relationship-specific entry なし → 触らない
- C2 / C3 後の grep で `relationship/v1/` の require / import / declare が **無い** ことを最終確認

## File Structure

**Delete (8 file):**
- `proto/relationship/v1/follow_service.proto`
- `proto/relationship/v1/block_service.proto`
- `services/monolith/workspace/stubs/relationship/v1/follow_service_pb.rb`
- `services/monolith/workspace/stubs/relationship/v1/follow_service_services_pb.rb`
- `services/monolith/workspace/stubs/relationship/v1/block_service_pb.rb`
- `services/monolith/workspace/stubs/relationship/v1/block_service_services_pb.rb`
- `services/frontend/workspace/src/stub/relationship/v1/follow_service_pb.ts`
- `services/frontend/workspace/src/stub/relationship/v1/block_service_pb.ts`

加えて空ディレクトリ (`proto/relationship/v1`, `proto/relationship`, `services/monolith/workspace/stubs/relationship/v1`, `services/monolith/workspace/stubs/relationship`, `services/frontend/workspace/src/stub/relationship/v1`, `services/frontend/workspace/src/stub/relationship`) を rmdir。

---

## Task 1: 全 stub / proto 削除 + orphan reference 確認

- [ ] **Step 1: 削除**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/rm -rf proto/relationship
/usr/bin/rm -rf services/monolith/workspace/stubs/relationship
/usr/bin/rm -rf services/frontend/workspace/src/stub/relationship
```

- [ ] **Step 2: 残骸確認**

```bash
/usr/bin/find proto/relationship services/monolith/workspace/stubs/relationship services/frontend/workspace/src/stub/relationship 2>&1 | /usr/bin/head -5
```

期待: 全 path "No such file or directory"。

- [ ] **Step 3: orphan reference (全 repo)**

```bash
/usr/bin/grep -rn "relationship/v1\|@/stub/relationship" services 2>&1 | /usr/bin/head -10
```

期待: 出力無し (空)。

---

## Task 2: 検証 + commit

- [ ] **Step 1: frontend tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待:
- tsc 緑 (orphan stub への参照が C2 で全削除済を再確認)
- build 緑
- lint baseline 同等 (5 errors / 7 warnings 等、本 PR で増減無し)

- [ ] **Step 2: monolith rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -10
```

期待: post 62/0、profile 153/14 (C3 後の新 baseline)。

- [ ] **Step 3: monolith bin/grpc boot smoke (relationship require の残存無し確認)**

```bash
cd services/monolith/workspace
/usr/bin/grep -n "relationship" bin/grpc 2>&1 | /usr/bin/head -5
```

期待: 出力無し (C3 ですべて social に置換済の確認)。

- [ ] **Step 4: diff stat**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 8 deleted file + plan = **9 files**。

- [ ] **Step 5: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c4-proto-drop
/usr/bin/git add -A proto services/monolith/workspace/stubs services/frontend/workspace/src/stub docs/superpowers/plans/2026-06-16-social-cleanup-c4-proto-drop.md
/usr/bin/git commit -s -m "chore(social): drop legacy relationship.v1 proto + stubs"
```

push しない。

---

## Deferred

- **C5** (旧 relationship schema 物理 drop): `relationship.follows` / `relationship.blocks` DROP TABLE + DROP SCHEMA の migration。本 PR では DB schema 触らず。`config/db/structure.sql` は schema dump なので C5 で migration 走らせて再 dump で消える。

## Self-Review

- **Spec coverage**: cleanup 多段 PR の第 4 段 (proto + stub drop)
- **Placeholder 無し**: 全削除 path 完全列挙
- **Surgical**: pure deletion + orphan grep のみ、コード修正なし
- **互換破壊あり** だが repo 内 consumer は C2 / C3 で全削除済、外部 client (もし存在すれば) は別件
- **検証**: frontend tsc/build/lint + monolith rspec + bin/grpc grep の 4 軸 baseline 維持
