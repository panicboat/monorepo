# Social Cleanup C1: data migration `relationship` → `social` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 旧 `relationship.follows` / `relationship.blocks` のデータを新 `social.follows` / `social.blocks` にコピーする migration を 1 本追加する。これで cleanup フェーズの後続 PR (旧 frontend hooks / monolith handler / proto stub / relationship schema drop) が安全に走らせられる状態にする。

**Architecture:** ROM::SQL.migration 単体。**SQL ベースのバルクコピー** (INSERT SELECT)、`ON CONFLICT DO NOTHING` で再実行安全 (既に social 側に同じ pair が存在すれば skip)。Down は社内 pair (= 元 relationship 側にも存在する) のみ削除する逆方向。

**Tech Stack:** Sequel / PostgreSQL / ROM-SQL migration。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` (Decomposition > cleanup 節)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c1-data-migration`、branch `chore/social-cleanup-c1-data-migration` (origin/main = `b6b731f5`、S5 #681 マージ後)。**push しない**。
- 触らない: 旧 `slices/relationship/*`、新 `slices/social/*`、frontend、proto。本 PR は migration 1 本のみ。

### 元データ構造 (確認済)

`relationship.follows`:
| column | type |
|---|---|
| `id` | uuid PK |
| `cast_user_id` | uuid (= followee) |
| `guest_user_id` | uuid (= follower) |
| `status` | text ("pending" / "approved"、20260209 で追加) |
| `created_at` | timestamptz |

`relationship.blocks`:
| column | type |
|---|---|
| `id` | uuid PK |
| `blocker_id` | uuid |
| `blocker_type` | text ("guest" / "cast" — 新モデルでは drop) |
| `blocked_id` | uuid |
| `blocked_type` | text (同上) |
| `created_at` | timestamptz |

### マッピング

**follows:**
- `social.follows.id` = `relationship.follows.id` (PK 互換、UUID 同値で持ち越し)
- `social.follows.follower_id` = `relationship.follows.guest_user_id`
- `social.follows.followee_id` = `relationship.follows.cast_user_id`
- `social.follows.status` = `relationship.follows.status`
- `social.follows.created_at` = `relationship.follows.created_at`
- `social.follows.updated_at` = `relationship.follows.created_at` (旧表に updated_at 列無し、created_at を流用)

**blocks:**
- `social.blocks.id` = `relationship.blocks.id`
- `social.blocks.blocker_id` = `relationship.blocks.blocker_id`
- `social.blocks.blocked_id` = `relationship.blocks.blocked_id`
- `social.blocks.created_at` = `relationship.blocks.created_at`
- `blocker_type` / `blocked_type` は drop (新モデルは symmetric account_id)

### Safety properties

- `ON CONFLICT DO NOTHING` で再実行安全。既に social 側に該当 pair の row があれば skip。
- 旧 relationship 表は **本 PR で削除しない** (C5 で物理 drop)。データは両方に残る状態で C2 (frontend drop)、C3 (monolith handler drop)、C4 (proto drop) に進む。
- 後続の C2 ~ C4 中に「旧 BFF を残しているコードがまだ動く」状態のままなので、user が画面側の互換 (新 hook 経由) で動く一方、旧 hook 経由でも動くという冗長状態を保つ。

## File Structure

- Create: `services/monolith/workspace/config/db/migrate/20260615180000_migrate_relationship_to_social.rb`

タイムスタンプは S2a の migration (`20260615000000_create_social_schema.rb`) より後に来るよう `20260615180000` を採用。

---

## Task 1: Migration ファイルを書く

**Files:** Create `services/monolith/workspace/config/db/migrate/20260615180000_migrate_relationship_to_social.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

# Bulk copy data from the legacy `relationship` schema into the new `social` schema.
# Re-runnable: ON CONFLICT DO NOTHING. Idempotent against (follower_id, followee_id) and
# (blocker_id, blocked_id) unique constraints on social.{follows,blocks}.
#
# Mapping:
#   relationship.follows.guest_user_id  -> social.follows.follower_id
#   relationship.follows.cast_user_id   -> social.follows.followee_id
#   relationship.follows.{status,created_at,id} -> social.follows.{status,created_at,id}
#     (updated_at left equal to created_at since the source table has no such column)
#   relationship.blocks.{blocker_id,blocked_id,created_at,id} -> social.blocks.{...}
#     (blocker_type / blocked_type from cast/guest split is dropped)
ROM::SQL.migration do
  up do
    run <<~SQL
      INSERT INTO social.follows (id, follower_id, followee_id, status, created_at, updated_at)
      SELECT id, guest_user_id, cast_user_id, status, created_at, created_at
      FROM relationship.follows
      ON CONFLICT (follower_id, followee_id) DO NOTHING
    SQL

    run <<~SQL
      INSERT INTO social.blocks (id, blocker_id, blocked_id, created_at)
      SELECT id, blocker_id, blocked_id, created_at
      FROM relationship.blocks
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    SQL
  end

  down do
    # Delete only rows whose (follower_id, followee_id) / (blocker_id, blocked_id) pair
    # exists in the legacy table -- preserve any new rows generated through social.v1 RPCs
    # after the up ran.
    run <<~SQL
      DELETE FROM social.follows s
      USING relationship.follows r
      WHERE s.follower_id = r.guest_user_id
        AND s.followee_id = r.cast_user_id
    SQL

    run <<~SQL
      DELETE FROM social.blocks s
      USING relationship.blocks r
      WHERE s.blocker_id = r.blocker_id
        AND s.blocked_id = r.blocked_id
    SQL
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
cd services/monolith/workspace && ruby -c config/db/migrate/20260615180000_migrate_relationship_to_social.rb
```

期待: `Syntax OK`。

---

## Task 2: 検証 + commit

- [ ] **Step 1: rspec baseline 維持確認**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/feed spec/slices/relationship spec/slices/profile 2>&1 | /usr/bin/tail -10
```

期待: post 62/0、feed 0、relationship 31/0、profile 148/14 baseline 同等。

- [ ] **Step 2: migration の **smoke** (transactional)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  rom = Hanami.app["persistence.rom"]
  gateway = rom.gateways[:default]

  # 旧 / 新 件数を読み取り
  pre_old_follows = gateway[:"relationship__follows"].count
  pre_old_blocks  = gateway[:"relationship__blocks"].count
  pre_new_follows = gateway[:"social__follows"].count
  pre_new_blocks  = gateway[:"social__blocks"].count
  puts "Before: relationship.follows=#{pre_old_follows}, relationship.blocks=#{pre_old_blocks}, social.follows=#{pre_new_follows}, social.blocks=#{pre_new_blocks}"

  gateway.transaction do
    # 上記 migration の up を inline 実行
    gateway.run <<~SQL
      INSERT INTO social.follows (id, follower_id, followee_id, status, created_at, updated_at)
      SELECT id, guest_user_id, cast_user_id, status, created_at, created_at
      FROM relationship.follows
      ON CONFLICT (follower_id, followee_id) DO NOTHING
    SQL
    gateway.run <<~SQL
      INSERT INTO social.blocks (id, blocker_id, blocked_id, created_at)
      SELECT id, blocker_id, blocked_id, created_at
      FROM relationship.blocks
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    SQL

    post_new_follows = gateway[:"social__follows"].count
    post_new_blocks  = gateway[:"social__blocks"].count
    puts "Migrated (in-tx): social.follows=#{post_new_follows} (delta=+#{post_new_follows - pre_new_follows}), social.blocks=#{post_new_blocks} (delta=+#{post_new_blocks - pre_new_blocks})"

    raise ActiveRecord::Rollback rescue nil
    raise Sequel::Rollback
  end

  puts "Rolled back. Final social.follows=#{gateway[:\"social__follows\"].count}, social.blocks=#{gateway[:\"social__blocks\"].count}"
' 2>&1 | /usr/bin/tail -10
```

期待: ローカル DB に test data が無い場合 `delta=+0` が出ても問題なし。schema が確かに存在し SQL がエラー無く流れることが見える。

> **注意**: smoke が DB に書き込まずに rollback で終わるよう Sequel::Rollback を発生させる。実 DB 状態は無変化。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 1 new migration + plan = **2 files**。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c1-data-migration
/usr/bin/git add services/monolith/workspace/config/db/migrate docs/superpowers/plans/2026-06-15-social-cleanup-c1-data-migration.md
/usr/bin/git commit -s -m "chore(social): migrate data from relationship to social schema"
```

push しない。

---

## Deferred

- **C2** (旧 frontend hooks / BFF drop): `src/modules/relationship/*`、`/api/cast/{blocks,following,followers}*`、`/api/guest/following*`
- **C3** (旧 monolith handler / use_cases / adapters drop): `slices/relationship/grpc/*`、`slices/relationship/use_cases/*`、`slices/post/adapters/follow_adapter.rb` 等の cross-slice adapter (relationship 経由のもの)、`Feed::Adapters::{Block,Follow}Adapter` の social 切替
- **C4** (旧 proto messages drop + stub 再生成): `proto/relationship/v1/*` 削除、両 stub 再生成。互換破壊あり (frontend で旧 import が残っていれば C2 で同時 drop されている前提)
- **C5** (旧 relationship schema 物理 drop): `relationship.follows` / `relationship.blocks` 削除 migration、最後の cleanup PR

## Self-Review

- **Spec coverage**: cleanup フェーズ 多段 PR の第 1 段 (データ移行)。spec の "cleanup" 節 5 段階のうち最初。
- **Placeholder 無し**: migration の up / down 両方完全 SQL 記述。
- **型 / 命名整合**:
  - 旧 `relationship.follows.cast_user_id` → 新 `social.follows.followee_id` (cast = followee は spec の symmetry 説明と一致)
  - 旧 `relationship.follows.guest_user_id` → 新 `social.follows.follower_id` (guest = follower)
  - `id` は両表で uuid PK、UUID 同値で持ち越し可能 (新 social 側で SecureRandom.uuid_v7 を強制しない、ROM repo は INSERT 時のみ生成、コピー時は SELECT 値そのまま)
  - `updated_at` を NOT NULL DEFAULT now() で持つ新表に対し、source の `created_at` を流用
- **Idempotency**: `ON CONFLICT (follower_id, followee_id)` / `ON CONFLICT (blocker_id, blocked_id)` で再実行安全
- **Reversibility**: down migration が source 表との pair マッチで delete、後から手動で新 RPC 経由で作った行は保護
- **No data loss**: 旧 `relationship.*` 表はこの PR では物理削除しない (C5 で初めて drop)
- **Verification**: rspec baseline 維持 + transactional smoke で SQL 流れの正当性確認
