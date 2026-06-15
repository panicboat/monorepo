# Social Cleanup C5: drop legacy `relationship` DB schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 最終 cleanup PR。DB schema `relationship` (`follows` / `blocks` 表) を物理 DROP する migration を追加、`config/db/structure.sql` を再生成する。これで relationship スキーマは 完全消滅 (frontend → BFF → monolith code → proto → stubs → DB schema の全 layer から legacy 排除完了)。

**Architecture:** ROM::SQL.migration 単体。up = DROP TABLE × 2 + DROP SCHEMA。down = 空 schema + 空 table を再作成 (元データは復元不能、空殻のみで rollback 機能を確保)。structure.sql は migration 実行後の dump を commit。

**Tech Stack:** Sequel / PostgreSQL / ROM-SQL migration / Hanami DB tooling。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` Decomposition > cleanup 節 (最終段)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c5-schema-drop`、branch `chore/social-cleanup-c5-schema-drop` (origin/main = `eaaff624`、C4 #685 マージ後)。**push しない**。
- 触らない: 新 `social` schema、historic migration (20260203 / 20260207 / 20260209 / 20260216 / 20260227 / 20260615180000 など)、他テーブル、code layer (全 PR で既に relationship 依存を排除済)。

### Survey 結果 (確認済)

- `structure.sql` の `relationship.*` 参照 = 11 件、全て schema / table / constraint 定義のみ
- 他 schema からの FK 参照 (REFERENCES relationship.*) = **0 件** → CASCADE 不要 (ただし安全のため DROP SCHEMA CASCADE は使用)
- code layer に relationship 依存 = **0 件** (前 4 PR で完全排除済)
- C1 (#682) で `relationship.{follows,blocks}` → `social.{follows,blocks}` データ移行済、本番データは social 側に存在

### 元 table 構造 (down 用、確認済)

`relationship.follows`:
- id (uuid PK)
- cast_user_id (uuid)
- guest_user_id (uuid)
- status (text DEFAULT 'approved')
- created_at (timestamptz DEFAULT now())

`relationship.blocks`:
- id (uuid PK)
- blocker_id (uuid)
- blocker_type (text)
- blocked_id (uuid)
- blocked_type (text)
- created_at (timestamptz DEFAULT now())

## File Structure

- Create: `services/monolith/workspace/config/db/migrate/20260616000000_drop_relationship_schema.rb`
- Modify: `services/monolith/workspace/config/db/structure.sql` (re-dump 後の差分、relationship schema 関連 11 件削除)

---

## Task 1: Migration ファイルを書く

**Files:** Create `services/monolith/workspace/config/db/migrate/20260616000000_drop_relationship_schema.rb`。

タイムスタンプは C1 (`20260615180000`) より後の `20260616000000` (本日 00:00 UTC)。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

# Physically drop the legacy `relationship` schema. Data was bulk-copied to
# the `social` schema in 20260615180000_migrate_relationship_to_social.rb;
# subsequent PRs (#683 / #684 / #685) removed every code, BFF, stub, and proto
# consumer. This is the last PR of the cleanup sequence.
#
# `down` rebuilds an empty schema + table skeleton so the migration is
# technically reversible, but the original data cannot be restored — callers
# of `bundle exec hanami db rollback` past this point should treat the rolled
# back state as "schema present but empty."
ROM::SQL.migration do
  up do
    run "DROP TABLE IF EXISTS relationship.follows"
    run "DROP TABLE IF EXISTS relationship.blocks"
    run "DROP SCHEMA IF EXISTS relationship CASCADE"
  end

  down do
    run "CREATE SCHEMA IF NOT EXISTS relationship"

    create_table :"relationship__follows" do
      column :id, :uuid, null: false
      column :cast_user_id, :uuid, null: false
      column :guest_user_id, :uuid, null: false
      column :status, :text, null: false, default: "approved"
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:cast_user_id, :guest_user_id]
      index :cast_user_id
      index :guest_user_id
      index :status
    end

    create_table :"relationship__blocks" do
      column :id, :uuid, null: false
      column :blocker_id, :uuid, null: false
      column :blocker_type, :text, null: false
      column :blocked_id, :uuid, null: false
      column :blocked_type, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:blocker_id, :blocked_id]
      index :blocker_id
      index :blocked_id
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
cd services/monolith/workspace && ruby -c config/db/migrate/20260616000000_drop_relationship_schema.rb
```

期待: `Syntax OK`。

---

## Task 2: migration 実行 + `structure.sql` 再 dump

**Files:** Modify `services/monolith/workspace/config/db/structure.sql` (auto-generated)。

- [ ] **Step 1: ローカル DB に migration を実行**

```bash
cd services/monolith/workspace
bundle exec hanami db migrate 2>&1 | /usr/bin/tail -10
```

期待: "Run migration 20260616000000_drop_relationship_schema (up)" 系の出力 + 完了。

- [ ] **Step 2: structure.sql 再生成**

```bash
# Hanami の standard schema dump task は無いので pg_dump -s --schema-only で structure.sql 相当を再生成
DATABASE_URL=$(/usr/bin/grep "DATABASE_URL" .env 2>/dev/null | /usr/bin/head -1 | /usr/bin/cut -d= -f2-)
# あるいは config/db/structure.sql の生成 task が hanami db dump として存在するか確認
bundle exec rake -T 2>&1 | /usr/bin/grep -i "dump\|structure" | /usr/bin/head -5
```

期待: dump task 名 (例 `db:structure:dump`、`hanami db dump`) を確認。**plan を実装する agent が rake task 名を runtime で確定して実行する**。

(fallback: pg_dump で structure.sql 再生成)

```bash
DB_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/monolith_development}"
/usr/bin/pg_dump --schema-only --no-owner --no-privileges "$DB_URL" > config/db/structure.sql
```

- [ ] **Step 3: structure.sql の relationship 残骸が消えたか確認**

```bash
/usr/bin/grep -c "relationship" config/db/structure.sql 2>&1
```

期待: `0` (relationship 文字列 0 件)。

> **Note**: もし dump tooling が relationship を消し漏らす場合は、手動で structure.sql から該当 11 行 (`CREATE SCHEMA relationship;`、`CREATE TABLE relationship.{follows,blocks}`、`ALTER TABLE ONLY relationship.*` 系) を sed で削除する。

---

## Task 3: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -10
```

期待: post 62/0、profile 153/14 (C3 後 baseline)。

- [ ] **Step 2: container resolve smoke (relationship スキーマ消滅後の SQL が壊れていないか)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  # Social slice repo 経由で SQL が走ることを確認 (relationship.{follows,blocks} を一切参照しないことが key)
  fr = Social::Slice["repositories.follow_repository"]
  br = Social::Slice["repositories.block_repository"]
  zero = "00000000-0000-0000-0000-000000000000"
  puts "follow.find(empty): #{fr.find(follower_id: zero, followee_id: zero).inspect}"
  puts "follow.following_account_ids(empty): #{fr.following_account_ids(account_id: zero).inspect}"
  puts "block.bidirectionally_blocked_ids(empty): #{br.bidirectionally_blocked_ids(account_id: zero).inspect}"
' 2>&1 | /usr/bin/tail -10
```

期待: 全 method 解決成功、各 query が relationship.* に触れないことが SQL ログから確認可能。

- [ ] **Step 3: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 1 new migration + 1 modified structure.sql + plan = **3 files**。

- [ ] **Step 4: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c5-schema-drop
/usr/bin/git add -A services/monolith/workspace docs/superpowers/plans/2026-06-16-social-cleanup-c5-schema-drop.md
/usr/bin/git commit -s -m "chore(social): drop legacy relationship DB schema"
```

push しない。

---

## Deferred / Out of scope

- なし (これが最終 cleanup PR、完了後は relationship 文字列が DB 含め全層から消滅)

## Self-Review

- **Spec coverage**: cleanup 多段 PR の **最終段** (DB schema 物理 drop)
- **Placeholder 無し**: 全 SQL / down restore の table 構造を完全列挙
- **Surgical**: migration 1 本 + structure.sql 再生成のみ
- **Data safety**: C1 でデータは既に social へコピー済、relationship 表 drop で本番データ消失リスクなし
- **Reversibility**: down で空 schema + 表を復元可能 (rollback 後の状態は "空殻のみ" だが migration history は整合)
- **検証**: rspec baseline + container smoke で relationship 触らない動作確認 + structure.sql 残骸 0 件
