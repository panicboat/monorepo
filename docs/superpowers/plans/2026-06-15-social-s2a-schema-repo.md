# Social S2a: schema + relations + repositories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monolith に `slices/social/` 新規スライスを greenfield 作成し、DB schema `social` + 2 table (`follows` / `blocks`) + relations + 2 repositories まで配置する。use_cases / handlers は **S2b** で実装。

**Architecture:** **Greenfield additive**。新 PostgreSQL schema `social` (旧 `social.*` テーブルは 2026-02-16 migration で全て `relationship` / `post` に移動済みなので空)。Hanami slice 規約に従い `slices/social/` 配下に最小構成 (`db/{relation,repo}.rb`、`relations/{follows,blocks}.rb`、`repositories/{follow,block}_repository.rb`)。symmetric `follower_id` / `followee_id`、`blocker_id` / `blocked_id` 列。Block の auto-unfollow transaction は repository に持たせる。

**Tech Stack:** Ruby / Hanami 2 / ROM / Sequel / PostgreSQL。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` (§Domain model / §Monolith social slice の schema / relations / repository)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s2-monolith`、branch `feat/social-s2-monolith` (origin/main = `4baac9b5` base、S1 #676 マージ後)。**push しない**、PR は親が判断。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- DB: localhost:5432 (postgres/password/monolith)、`hanami` は postgres@18 path 想定 (`export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"`)。
- 触らない: 旧 `slices/relationship/*`、他 slice、proto、frontend。

### 既存パターン (踏襲)

- migration: `ROM::SQL.migration do ... up do ... down do` (例: `config/db/migrate/20260207000000_create_blocks.rb`)
- schema: `:"social__follows"` (PostgreSQL schema = `social`、table = `follows`、ROM の `__` 命名規約)
- slice base: `module Social; module DB; class Relation < Monolith::DB::Relation; end; end; end` (relationship slice と同形)
- relation: `schema(:"social__follows", as: :follows, infer: false) do ... attribute ... primary_key :id end`
- repository: `class FollowRepository < Social::DB::Repo` で `follows` relation 使用

## File Structure

- Create: `services/monolith/workspace/config/db/migrate/20260615000000_create_social_schema.rb`
- Create: `services/monolith/workspace/slices/social/db/relation.rb`
- Create: `services/monolith/workspace/slices/social/db/repo.rb`
- Create: `services/monolith/workspace/slices/social/relations/follows.rb`
- Create: `services/monolith/workspace/slices/social/relations/blocks.rb`
- Create: `services/monolith/workspace/slices/social/repositories/follow_repository.rb`
- Create: `services/monolith/workspace/slices/social/repositories/block_repository.rb`

---

## Task 1: migration 作成 + 実行

**Files:** Create `services/monolith/workspace/config/db/migrate/20260615000000_create_social_schema.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS social"

    create_table :"social__follows" do
      column :id, :uuid, null: false
      column :follower_id, :uuid, null: false
      column :followee_id, :uuid, null: false
      column :status, :text, null: false, default: "approved"  # "pending" | "approved"
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:follower_id, :followee_id]
      index :follower_id
      index :followee_id
      index [:followee_id, :status]
    end

    create_table :"social__blocks" do
      column :id, :uuid, null: false
      column :blocker_id, :uuid, null: false
      column :blocked_id, :uuid, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:blocker_id, :blocked_id]
      index :blocker_id
      index :blocked_id
    end
  end

  down do
    drop_table :"social__blocks"
    drop_table :"social__follows"
    run "DROP SCHEMA IF EXISTS social CASCADE"
  end
end
```

- [ ] **Step 2: migration 実行**

```bash
cd services/monolith/workspace
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
bundle exec hanami db migrate 2>&1 | /usr/bin/tail -5
```

Expected: `=> database monolith migrated in N.NNNs` + `monolith_test migrated` 両方緑。

- [ ] **Step 3: 確認**

```bash
PGPASSWORD=password psql -h localhost -U postgres -d monolith -c "\dt social.*"
PGPASSWORD=password psql -h localhost -U postgres -d monolith -c "\d social.follows"
```

Expected: `social.follows` / `social.blocks` 2 テーブル、カラム + index + unique constraint 確認。

---

## Task 2: slice base (`db/relation.rb` + `db/repo.rb`)

**Files:** Create 2 files。

- [ ] **Step 1: `slices/social/db/relation.rb`**

```ruby
# frozen_string_literal: true

module Social
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

- [ ] **Step 2: `slices/social/db/repo.rb`**

```ruby
# frozen_string_literal: true

module Social
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

- [ ] **Step 3: 構文チェック**

```bash
ruby -c slices/social/db/relation.rb slices/social/db/repo.rb
```

両方 `Syntax OK`。

---

## Task 3: relations (`follows.rb` + `blocks.rb`)

**Files:** Create 2 files。

- [ ] **Step 1: `slices/social/relations/follows.rb`**

```ruby
# frozen_string_literal: true

module Social
  module Relations
    class Follows < Social::DB::Relation
      schema(:"social__follows", as: :follows, infer: false) do
        attribute :id, Types::String
        attribute :follower_id, Types::String
        attribute :followee_id, Types::String
        attribute :status, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 2: `slices/social/relations/blocks.rb`**

```ruby
# frozen_string_literal: true

module Social
  module Relations
    class Blocks < Social::DB::Relation
      schema(:"social__blocks", as: :blocks, infer: false) do
        attribute :id, Types::String
        attribute :blocker_id, Types::String
        attribute :blocked_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 3: 構文チェック**

```bash
ruby -c slices/social/relations/follows.rb slices/social/relations/blocks.rb
```

両方 `Syntax OK`。

---

## Task 4: `FollowRepository`

**Files:** Create `services/monolith/workspace/slices/social/repositories/follow_repository.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module Repositories
    # Symmetric follow repository. follower_id/followee_id are both account_ids.
    # status is "approved" (immediate, default for public targets) or "pending" (private targets).
    class FollowRepository < Social::DB::Repo
      include Concerns::CursorPagination

      # --- Mutations ----

      # Insert or no-op. Returns the resulting status (existing or new).
      # @return [Hash{success: Boolean, status: String, reason: Symbol?}]
      def follow(follower_id:, followee_id:, status:)
        existing = follows.where(follower_id: follower_id, followee_id: followee_id).one
        return { success: false, status: existing.status, reason: :already_exists } if existing

        follows.changeset(:create,
          id: SecureRandom.uuid_v7,
          follower_id: follower_id,
          followee_id: followee_id,
          status: status,
          updated_at: Time.now
        ).commit
        { success: true, status: status }
      end

      def unfollow(follower_id:, followee_id:)
        follows.dataset.where(follower_id: follower_id, followee_id: followee_id).delete > 0
      end

      def update_status(follower_id:, followee_id:, status:)
        updated = follows.dataset
          .where(follower_id: follower_id, followee_id: followee_id)
          .update(status: status, updated_at: Time.now)
        updated > 0
      end

      # Delete both directions (used by Block transaction in BlockRepository).
      def remove_bidirectional(account_a:, account_b:)
        follows.dataset
          .where(
            Sequel.|(
              { follower_id: account_a, followee_id: account_b },
              { follower_id: account_b, followee_id: account_a }
            )
          )
          .delete
      end

      # --- Reads ----

      def find(follower_id:, followee_id:)
        follows.where(follower_id: follower_id, followee_id: followee_id).one
      end

      def list_following(account_id:, status: "approved", limit: 20, cursor: nil)
        scope = follows.where(follower_id: account_id, status: status)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_followers(account_id:, status: "approved", limit: 20, cursor: nil)
        scope = follows.where(followee_id: account_id, status: status)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_pending_to(account_id:, limit: 20, cursor: nil)
        list_followers(account_id: account_id, status: "pending", limit: limit, cursor: cursor)
      end

      def count_pending_to(account_id:)
        follows.where(followee_id: account_id, status: "pending").count
      end

      # @return [Hash{target_account_id (String) => status (String)}], missing keys = no row
      def status_batch(follower_id:, followee_ids:)
        return {} if followee_ids.nil? || followee_ids.empty?

        rows = follows.dataset
          .where(follower_id: follower_id, followee_id: followee_ids)
          .select_map([:followee_id, :status])
        rows.each_with_object({}) { |(target, status), h| h[target.to_s] = status }
      end

      # Used by Feed FOLLOWING tab (already exposed since F3).
      def following_account_ids(account_id:)
        follows.dataset
          .where(follower_id: account_id, status: "approved")
          .select_map(:followee_id)
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
```

- [ ] **Step 2: 構文チェック**

```bash
ruby -c slices/social/repositories/follow_repository.rb
```

`Syntax OK` 必須。

---

## Task 5: `BlockRepository` (bidirectional + auto-unfollow transaction)

**Files:** Create `services/monolith/workspace/slices/social/repositories/block_repository.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module Repositories
    # Symmetric block repository. blocker_id/blocked_id are both account_ids.
    # Block creates a one-way row but the effect is bidirectional (enforced by callers reading
    # bidirectionally_blocked_ids). Block transactionally removes any follows in both directions
    # so the relationship is severed.
    class BlockRepository < Social::DB::Repo
      include Concerns::CursorPagination

      # @param follow_repo [Social::Repositories::FollowRepository] injected for transactional unfollow
      def initialize(follow_repo:)
        super()
        @follow_repo = follow_repo
      end

      # --- Mutations ----

      def block(blocker_id:, blocked_id:)
        rom.gateways[:default].transaction do
          existing = blocks.where(blocker_id: blocker_id, blocked_id: blocked_id).one
          unless existing
            blocks.changeset(:create,
              id: SecureRandom.uuid_v7,
              blocker_id: blocker_id,
              blocked_id: blocked_id
            ).commit
          end
          @follow_repo.remove_bidirectional(account_a: blocker_id, account_b: blocked_id)
        end
        true
      end

      def unblock(blocker_id:, blocked_id:)
        blocks.dataset.where(blocker_id: blocker_id, blocked_id: blocked_id).delete > 0
      end

      # --- Reads ----

      def blocked?(blocker_id:, blocked_id:)
        blocks.where(blocker_id: blocker_id, blocked_id: blocked_id).exist?
      end

      # account_id has blocked these ids
      def blocked_ids(account_id:)
        blocks.dataset.where(blocker_id: account_id).select_map(:blocked_id)
      end

      # These ids have blocked account_id
      def blocker_ids(account_id:)
        blocks.dataset.where(blocked_id: account_id).select_map(:blocker_id)
      end

      # Union: anyone in a bidirectional block with account_id
      def bidirectionally_blocked_ids(account_id:)
        (blocked_ids(account_id: account_id) + blocker_ids(account_id: account_id)).uniq
      end

      # cursor pagination for ListBlocked
      def list_blocked(blocker_id:, limit: 20, cursor: nil)
        scope = blocks.where(blocker_id: blocker_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # @return [Hash{target_account_id (String) => Boolean}]
      def status_batch(blocker_id:, blocked_ids:)
        return {} if blocked_ids.nil? || blocked_ids.empty?

        present = blocks.dataset
          .where(blocker_id: blocker_id, blocked_id: blocked_ids)
          .select_map(:blocked_id)
          .map(&:to_s)
        blocked_ids.each_with_object({}) { |id, h| h[id.to_s] = present.include?(id.to_s) }
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
```

- [ ] **Step 2: 構文チェック**

```bash
ruby -c slices/social/repositories/block_repository.rb
```

`Syntax OK` 必須。

---

## Task 6: container resolve smoke + diff + commit

- [ ] **Step 1: rspec 既存全 slice 維持確認**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0、feed 4/0 (or dir absent)、relationship 31/0、profile 148/14 baseline 維持。

- [ ] **Step 2: container resolve smoke**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  follow_repo = Social::Slice["repositories.follow_repository"]
  puts "FollowRepository: #{follow_repo.class}"
  puts "list_following empty: #{follow_repo.list_following(account_id: "00000000-0000-0000-0000-000000000000").inspect}"

  block_repo = Social::Slice["repositories.block_repository"]
  puts "BlockRepository: #{block_repo.class}"
  puts "blocked_ids empty: #{block_repo.blocked_ids(account_id: "00000000-0000-0000-0000-000000000000").inspect}"
' 2>&1 | /usr/bin/tail -10
```

期待:
- `FollowRepository: Social::Repositories::FollowRepository`
- `list_following empty: []`
- `BlockRepository: Social::Repositories::BlockRepository`
- `blocked_ids empty: []`

container key auto-resolve 成功と migration 配備の動作確認を同時に。

- [ ] **Step 3: diff stat 確認**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s2-monolith
/usr/bin/git diff --stat origin/main HEAD
```

期待: migration 1 + slice 7 file 新規 (db 2 + relations 2 + repositories 2 + + plan) + config/db/structure.sql 自動更新 (hanami migrate で生成) + plan = **9-10 files**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s2-monolith
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-15-social-s2a-schema-repo.md
/usr/bin/git commit -s -m "feat(social): schema migration + slice base + relations + repositories"
```

push しない (controller 判断)。

---

## Deferred (本 S2a では実施しない)

- use_cases (Follow / Unfollow / Approve / Reject / Cancel / ListFollowing / ListFollowers / ListPendingFollowRequests / GetFollowStatus / GetPendingFollowCount / Block / Unblock / ListBlocked / GetBlockStatus) → **S2b**
- handlers (`Social::Grpc::FollowHandler` / `BlockHandler`) → **S2b**
- cross-slice helpers (`viewer_can_see_post` / `filter_visible_posts`) → **S3**
- frontend data 層 → **S4**
- frontend UI → **S5**
- cleanup of legacy `relationship` slice → cleanup フェーズ

## Self-Review (作成者チェック済)

- **Spec coverage (S2a 範囲)**: schema (`social.follows` / `social.blocks` with UNIQUE + indexes)、relations、`FollowRepository` / `BlockRepository` の主要メソッド全実装。Block の auto-unfollow transaction を repository で実装。
- **Greenfield additive**: 既存 `relationship` slice / 他 slice 完全無改変。
- **Placeholder 無し**: 全 task に完全コード。
- **型 / 命名整合**: schema attribute `Types::String` + `Types::Time`、Sequel migration の `uuid` 型と整合。`follower_id` / `followee_id` / `blocker_id` / `blocked_id` 全て account_id (UUID string)。
- **既存パターン踏襲**: relationship slice の `Relation < Monolith::DB::Relation` / `schema(:"namespace__table", as: :alias)` パターン完全同形。
- **テスト方針**: rspec 既存 4 slice baseline 維持確認 + container smoke で resolve 成功と migration 配備を同時確認。新 unit spec は YAGNI で skip (S2b で integration spec、handler smoke で実機検証)。
