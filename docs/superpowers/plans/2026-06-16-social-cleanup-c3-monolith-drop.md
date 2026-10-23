# Social Cleanup C3: drop legacy relationship slice + adapter migration + bin/grpc fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monolith 側で旧 `slices/relationship/*` を全 drop、`bin/grpc` から旧 service 登録を除去、**S2b で抜けていた新 social.v1 handler の登録を追加** (hidden bug fix)、Feed / Post の cross-slice adapter 内部 repo dep を `Relationship::Slice` → `Social::Slice` に切替。これで monolith 側の relationship 依存を排除し、S5 で frontend が呼んでいる `socialFollowClient` が実際に応答する状態にする。

**Architecture:** 3 stage:
1. **bin/grpc fix (CRITICAL)** — S2b の handler は container 登録済だが server 起動時の load が抜けており、social.v1 RPC は production で UNIMPLEMENTED 状態。relationship 削除と同時に social を追加。
2. **adapter migration** — `Feed::Adapters::{Block,Follow}Adapter` と `Post::Adapters::{Block,Follow}Adapter` の private repo を `Relationship::Slice[...]` → `Social::Slice[...]` に swap、不要 method 除去。adapter の public API は据置 (caller 無変更)。
3. **slice drop** — `slices/relationship/` (22 file)、`spec/slices/relationship/` (2 file)、`config/db/seeds/relationship/` (2 file + dir) を全削除。

**Tech Stack:** Ruby / Hanami 2 / ROM / Gruf。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` Decomposition > cleanup 節。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c3-monolith-drop`、branch `chore/social-cleanup-c3-monolith-drop` (origin/main = `7d8a8e6a`、C2 #683 マージ後)。**push しない**。
- 触らない: 新 `slices/social/*`、frontend、proto、`slices/post/policies/access_policy.rb` / `slices/post/grpc/comment_handler.rb` (adapter caller、adapter 公開 API 据置で無改変)、relationship schema 物理 drop は C5 で実施 (本 PR では DB 内の `relationship.*` 表は残存)。

### Survey 結果 (全て確認済)

**bin/grpc (現状):**
- Line 43-44: `require "relationship/v1/{follow,block}_service_services_pb"` — DELETE
- Line 72-74: `require_relative "../slices/relationship/grpc/{handler,follow_handler,block_handler}"` — DELETE
- social proto stub / handler の require が **存在しない** — ADD (新 S2b handler を server に登録するため)

**Feed::Adapters::BlockAdapter** caller:
- `Feed::UseCases::ListFeed#call` (line 29): `bidirectionally_blocked_account_ids(account_id:)` のみ使用 → 残す
- `blocked_guest_ids` / `blocker_cast_ids_for_guest` は呼ばれていない → drop

**Feed::Adapters::FollowAdapter** caller:
- `Feed::UseCases::ListFeed#call` (line 37): `following_account_ids(account_id:)` のみ使用 → 残す
- `following_cast_user_ids` は呼ばれていない → drop

**Post::Adapters::BlockAdapter** caller:
- `Post::Grpc::Handler#get_blocked_user_ids` (line 112): `blocked_guest_ids(blocker_id:)` 使用 → 残す
- `Post::Policies::AccessPolicy#filter_visible` (line 35): `blocked_by_cast_ids(guest_user_id:)` 使用 → 残す
- `Post::Policies::AccessPolicy#cast_blocked_guest?` (line 67): `cast_blocked_guest?(cast_user_id:, guest_user_id:)` 使用 → 残す

**Post::Adapters::FollowAdapter** caller:
- `Post::Policies::AccessPolicy#filter_visible` (line 42): `following_status_batch(cast_user_ids:, guest_user_id:)` 使用 → 残す
- `Post::Policies::AccessPolicy#following?` (line 71): `following?(cast_user_id:, guest_user_id:)` 使用 → 残す
- `following_cast_user_ids` は呼ばれていない → drop

### Repo dep swap mapping

旧 `Relationship::Repositories::FollowRepository`:
- `following?(cast_user_id:, guest_user_id:)` → 新 `Social.follow_repo.find(follower_id: guest_user_id, followee_id: cast_user_id)&.status == "approved"`
- `following_status_batch(cast_user_ids:, guest_user_id:)` ⇒ `{cast_id => status_or_"none"}` → 新 `Social.follow_repo.status_batch(follower_id: guest_user_id, followee_ids: cast_user_ids)` + missing key を "none" で埋める
- `following_account_ids(account_id:)` → 新 `Social.follow_repo.following_account_ids(account_id:)` (S2a で同名 method)

旧 `Relationship::Repositories::BlockRepository`:
- `blocked?(blocker_id:, blocked_id:)` → 新 `Social.block_repo.blocked?(blocker_id:, blocked_id:)` (同名)
- `blocked_user_ids(blocker_id:)` / `blocked_guest_ids(blocker_id:)` → 新 `Social.block_repo.blocked_ids(account_id: blocker_id)` (type フィルタは drop、symmetric)
- `blocker_ids_for_blocked(blocked_id:, blocker_type:)` → 新 `Social.block_repo.blocker_ids(account_id: blocked_id)` (type フィルタ drop)
- `blocker_ids_of(blocked_id:)` → 新 `Social.block_repo.blocker_ids(account_id: blocked_id)` (同義)

> **Semantic shift**: 旧 `blocker_type: "cast"` フィルタは新 symmetric model では消失。`Post::Adapters` 内では `blocked_guest_ids` / `blocked_by_cast_ids` のような type 限定 method 名が残るが、内部実装は type 無関係 (全 blocked / 全 blocker を返す)。caller (AccessPolicy / CommentHandler) は依然 cast/guest semantics で動くが、symmetric data に対しては結果が "より包括的" になる方向で safe (block されている account の post を hide するのは type と関係なく正解)。

## File Structure

**Modify (5 file):**
- `services/monolith/workspace/bin/grpc` (5 行追加 + 5 行削除)
- `services/monolith/workspace/slices/feed/adapters/block_adapter.rb` (2 method drop、internal repo swap)
- `services/monolith/workspace/slices/feed/adapters/follow_adapter.rb` (1 method drop、internal repo swap)
- `services/monolith/workspace/slices/post/adapters/block_adapter.rb` (internal repo swap、3 method 維持)
- `services/monolith/workspace/slices/post/adapters/follow_adapter.rb` (1 method drop、2 method internal swap)

**Delete (26 file + dirs):**
- `services/monolith/workspace/slices/relationship/` 全体 (22 file + dirs)
- `services/monolith/workspace/spec/slices/relationship/` 全体 (2 file + dirs)
- `services/monolith/workspace/config/db/seeds/relationship/` 全体 (2 file + 1 dir)

---

## Task 1 [CRITICAL]: `bin/grpc` の修正 (social 追加 + relationship 削除)

**Files:** Modify `services/monolith/workspace/bin/grpc`。

- [ ] **Step 1: line 43-44 を削除し、social の require に置換**

旧 (line 43-44):
```ruby
require "relationship/v1/follow_service_services_pb"
require "relationship/v1/block_service_services_pb"
```

新 (同位置):
```ruby
require "social/v1/follow_service_services_pb"
require "social/v1/block_service_services_pb"
```

- [ ] **Step 2: line 72-74 を削除し、social の require に置換**

旧 (line 72-74):
```ruby
require_relative "../slices/relationship/grpc/handler"
require_relative "../slices/relationship/grpc/follow_handler"
require_relative "../slices/relationship/grpc/block_handler"
```

新 (同位置):
```ruby
require_relative "../slices/social/grpc/handler"
require_relative "../slices/social/grpc/follow_handler"
require_relative "../slices/social/grpc/block_handler"
```

> **背景**: S2b PR #678 は `slices/social/grpc/` に handler を新規追加したが、`bin/grpc` の handler load list に追加し忘れていた。本 PR の core fix。これがないと runtime で `social.v1.FollowService` / `BlockService` は UNIMPLEMENTED 応答。

---

## Task 2: `Feed::Adapters::BlockAdapter` migration

**Files:** Modify `services/monolith/workspace/slices/feed/adapters/block_adapter.rb`。

`bidirectionally_blocked_account_ids` 以外を drop、internal repo を Social に swap。

- [ ] **Step 1: 全置換**

旧 (全 file):
```ruby
# frozen_string_literal: true

module Feed
  module Adapters
    class BlockAdapter
      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      def blocker_cast_ids_for_guest(guest_user_id:)
        block_repo.blocker_ids_for_blocked(blocked_id: guest_user_id, blocker_type: "cast")
      end

      # Symmetric: returns union of accounts that this account blocked AND accounts that blocked this account.
      # Used by feed slice to hide posts in both directions.
      def bidirectionally_blocked_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        outgoing = block_repo.blocked_user_ids(blocker_id: account_id)
        incoming = block_repo.blocker_ids_of(blocked_id: account_id)
        (outgoing + incoming).uniq
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
```

新:
```ruby
# frozen_string_literal: true

module Feed
  module Adapters
    # Wraps Social::Repositories::BlockRepository for the feed slice's symmetric
    # block exclusion (bidirectional union). Internal repo dep is the new social
    # schema; legacy cast/guest split is no longer modeled.
    class BlockAdapter
      def bidirectionally_blocked_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        block_repo.bidirectionally_blocked_ids(account_id: account_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
cd services/monolith/workspace && ruby -c slices/feed/adapters/block_adapter.rb
```

---

## Task 3: `Feed::Adapters::FollowAdapter` migration

**Files:** Modify `services/monolith/workspace/slices/feed/adapters/follow_adapter.rb`。

- [ ] **Step 1: 全置換**

新:
```ruby
# frozen_string_literal: true

module Feed
  module Adapters
    # Wraps Social::Repositories::FollowRepository for the feed slice's
    # "following" tab whitelist.
    class FollowAdapter
      def following_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        follow_repo.following_account_ids(account_id: account_id)
      end

      private

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/feed/adapters/follow_adapter.rb
```

---

## Task 4: `Post::Adapters::BlockAdapter` migration

**Files:** Modify `services/monolith/workspace/slices/post/adapters/block_adapter.rb`。

3 method は public API そのまま、internal repo を Social に swap。type 限定セマンティクスは消失するが symmetric world ではこれが正解。

- [ ] **Step 1: 全置換**

新:
```ruby
# frozen_string_literal: true

module Post
  module Adapters
    # Cross-slice block view from Post slice. Backed by the new social schema
    # (symmetric model). The legacy "blocked_guest" / "blocker_cast" semantics
    # are preserved at the public API level but the underlying queries are
    # type-agnostic — returns all blocked / all blockers regardless of legacy
    # cast/guest classification.
    class BlockAdapter
      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_ids(account_id: blocker_id)
      end

      def cast_blocked_guest?(cast_user_id:, guest_user_id:)
        block_repo.blocked?(blocker_id: cast_user_id, blocked_id: guest_user_id)
      end

      def blocked_by_cast_ids(guest_user_id:)
        block_repo.blocker_ids(account_id: guest_user_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/post/adapters/block_adapter.rb
```

---

## Task 5: `Post::Adapters::FollowAdapter` migration

**Files:** Modify `services/monolith/workspace/slices/post/adapters/follow_adapter.rb`。

`following_cast_user_ids` drop、`following?` / `following_status_batch` 維持して Social へ swap。

`following_status_batch` は missing key を "none" で埋めて旧 contract と互換。

- [ ] **Step 1: 全置換**

新:
```ruby
# frozen_string_literal: true

module Post
  module Adapters
    # Cross-slice follow view from Post slice. Backed by the new social schema.
    # Legacy cast/guest naming is preserved at the public API (callers in
    # access_policy still use those terms) but internally maps to symmetric
    # follower/followee account ids.
    class FollowAdapter
      def following?(cast_user_id:, guest_user_id:)
        row = follow_repo.find(follower_id: guest_user_id, followee_id: cast_user_id)
        !!(row && row.status == "approved")
      end

      def following_status_batch(cast_user_ids:, guest_user_id:)
        return {} if cast_user_ids.nil? || cast_user_ids.empty? || guest_user_id.nil?

        present = follow_repo.status_batch(follower_id: guest_user_id, followee_ids: cast_user_ids)
        cast_user_ids.each_with_object({}) do |id, h|
          h[id] = present[id.to_s] || "none"
        end
      end

      private

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/post/adapters/follow_adapter.rb
```

---

## Task 6: `slices/relationship/` 削除

**Files:** Delete `services/monolith/workspace/slices/relationship/` 全体 (22 file)。

- [ ] **Step 1: 削除**

```bash
cd services/monolith/workspace
/usr/bin/rm -rf slices/relationship
```

- [ ] **Step 2: 確認**

```bash
/usr/bin/find slices/relationship 2>&1 | /usr/bin/head -3
```

期待: "No such file or directory"。

---

## Task 7: `spec/slices/relationship/` 削除

**Files:** Delete `services/monolith/workspace/spec/slices/relationship/` 全体 (2 spec file)。

- [ ] **Step 1: 削除**

```bash
/usr/bin/rm -rf spec/slices/relationship
```

---

## Task 8: `config/db/seeds/relationship/` 削除

**Files:** Delete `services/monolith/workspace/config/db/seeds/relationship/` 全体 (2 file + dir)。

- [ ] **Step 1: 削除**

```bash
/usr/bin/rm -rf config/db/seeds/relationship
```

- [ ] **Step 2: seeds.rb (entry) で relationship を参照していないか確認**

```bash
/usr/bin/grep -n "relationship" config/db/seeds.rb 2>&1 | /usr/bin/head -5
```

ヒットあれば該当行を削除 (現状未確認、grep 結果に応じて plan 追記)。なければスキップ。

---

## Task 9: 検証 + commit

- [ ] **Step 1: rspec baseline (relationship spec 消滅後の新 baseline)**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -10
```

期待: post 62/0、profile 148/14 (relationship spec が消えるので 3 slice → 2 slice、feed は spec dir 不在で対象外)。Post slice の AccessPolicy 関連 spec が無い前提なので、adapter 切替で post 62/0 が維持されること。

- [ ] **Step 2: container resolve smoke**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  # Relationship slice 消滅確認
  begin
    Relationship::Slice
    puts "ERROR: Relationship slice still exists"
  rescue NameError, KeyError
    puts "OK: Relationship slice removed"
  end

  # Adapter resolve
  fa = Feed::Adapters::FollowAdapter.new
  ba = Feed::Adapters::BlockAdapter.new
  pfa = Post::Adapters::FollowAdapter.new
  pba = Post::Adapters::BlockAdapter.new
  puts "Feed::Adapters::FollowAdapter: #{fa.following_account_ids(account_id: nil).inspect}"
  puts "Feed::Adapters::BlockAdapter: #{ba.bidirectionally_blocked_account_ids(account_id: nil).inspect}"
  puts "Post::Adapters::FollowAdapter: #{pfa.following_status_batch(cast_user_ids: [], guest_user_id: nil).inspect}"
  puts "Post::Adapters::BlockAdapter: #{pba.cast_blocked_guest?(cast_user_id: "00000000-0000-0000-0000-000000000000", guest_user_id: "00000000-0000-0000-0000-000000000000").inspect}"
' 2>&1 | /usr/bin/tail -15
```

期待: 全 adapter resolve 成功、empty path で nil/empty 返却、Relationship::Slice 消滅。

- [ ] **Step 3: bin/grpc boot smoke (server 起動チェック)**

```bash
timeout 10 bundle exec ruby bin/grpc 2>&1 | /usr/bin/head -20 &
sleep 5
# 起動成功なら "Starting gRPC Stub Server" がログに出る
```

期待: "Starting gRPC Stub Server on 0.0.0.0:9001" + `Gruf.services` リストに `Social::Grpc::FollowHandler` / `Social::Grpc::BlockHandler` が含まれる。relationship handler は登場しない。

> **注意**: timeout 後にプロセスが残るので、`pkill -f "bundle exec ruby bin/grpc"` で clean up すること。

- [ ] **Step 4: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 5 modified + 26 deleted + plan = **32 files**。

- [ ] **Step 5: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-social-cleanup-c3-monolith-drop
/usr/bin/git add -A services/monolith/workspace docs/superpowers/plans/2026-06-16-social-cleanup-c3-monolith-drop.md
/usr/bin/git commit -s -m "chore(social): drop legacy relationship slice + register social handlers + adapter swap"
```

push しない。

---

## Deferred

- **C4** (旧 relationship.v1 proto + stub drop): `proto/relationship/v1/*` 削除、両 stub 再生成 (monolith / frontend)、`src/stub/relationship/*` 削除
- **C5** (旧 relationship schema 物理 drop): `relationship.follows` / `relationship.blocks` DROP TABLE + DROP SCHEMA
- **Post adapter 名称の symmetric refactor** (`Post::Adapters::BlockAdapter#blocked_guest_ids` → `#blocked_ids` 等): caller (AccessPolicy / CommentHandler) も touch する必要があり scope 大、別 PR
- **AccessPolicy / CommentHandler の symmetric model 完全準拠 refactor**: 旧 cast/guest semantics の polishing、別 PR (memory `A4d`)

## Self-Review

- **Spec coverage**: cleanup 多段 PR の第 3 段 (monolith drop + 隠れ S2b bug fix)
- **Placeholder 無し**: 全 file の修正 / 削除コードを完全列挙、column mapping を明示
- **bin/grpc fix** が CRITICAL の理由: S2b で handler を作ったが server boot script 未更新、production で UNIMPLEMENTED 状態だった。C2 で frontend が `socialFollowClient` に切替済のため runtime 実害あり (try/catch でグレースフルだが、private cast 詳細が常に hidden)。本 PR が production 修復を兼ねる。
- **Adapter public API 据置**: 5 adapter は内部 repo swap のみ、caller (AccessPolicy / CommentHandler / ListFeed) 無改変で動作維持
- **Semantic shift 許容**: 旧 `blocked_type: "guest"` 等の type フィルタは symmetric world で消失、結果が "より包括的" になる方向で safe
- **検証**: rspec 2 slice baseline + container smoke + bin/grpc 起動 smoke (Social handler 登録の実証)
