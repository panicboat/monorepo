# Post AccessPolicy + dead adapter cleanup (A4d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Post slice の **dead code** を drop し、symmetric naming に refactor。具体的に `Post::Policies::AccessPolicy`、`Post::Adapters::FollowAdapter`、`Post::Adapters::BlockAdapter` の 2 unused method を完全削除、唯一活きてる `blocked_guest_ids` を `blocked_ids` に rename。memory `A4d` で deferred されていた tech debt の回収。

**Architecture:** **Pure deletion + 1 rename**。AccessPolicy は handler の memoized helper 経由で `Post::Policies::AccessPolicy.new` が import されているだけで、**`access_policy.can_view_post?` / `filter_viewable_posts` の call site は 1 つも無い** (legacy cast/guest post flow が C3 までに置換されたため)。AccessPolicy が落ちれば、それだけが使っていた adapter method 群も dead 化する。

**Tech Stack:** Ruby / Hanami slice。

**Spec:** spec 無し (memory `A4d` 記載の deferred 項目、social slice cleanup の最後の余り)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-post-access-policy-drop`、branch `chore/post-access-policy-drop` (origin/main = `11324ba9`、F1 #689 マージ後)。**push しない**。
- 触らない: 他 slice、proto、frontend、CommentHandler の `get_blocked_user_ids` API 名 (handler 内部 helper、rename しない)、Profile slice、Feed slice。

### Survey 結果 (確認済)

- `Post::Policies::AccessPolicy` の caller: handler.rb の `access_policy` helper 定義のみ、`access_policy.<method>` 呼出は **0 件**
- `Post::Adapters::FollowAdapter` の caller: handler.rb の `follow_adapter` helper 定義 + AccessPolicy (= dead)。**他 0 件**
- `Post::Adapters::BlockAdapter` の caller:
  - `handler.rb:112` (`get_blocked_user_ids`、CommentHandler 4 箇所から呼ばれる) — `blocked_guest_ids(blocker_id:)` を使用 → **rename 対象**
  - AccessPolicy (dead) — `cast_blocked_guest?` / `blocked_by_cast_ids` を使用 → drop 対象

### Rename: `blocked_guest_ids(blocker_id:)` → `blocked_ids(account_id:)`

- 既存 `Social::Repositories::BlockRepository` には同名 `blocked_ids(account_id:)` 既存、symmetric model に揃える
- 内部実装は変わらず (`block_repo.blocked_ids(account_id:)` 呼出)
- caller (handler.rb#get_blocked_user_ids) も合わせて kwarg を `account_id` に統一

## File Structure

**Delete (2 file):**
- `services/monolith/workspace/slices/post/policies/access_policy.rb`
- `services/monolith/workspace/slices/post/adapters/follow_adapter.rb`

**Modify (2 file):**
- `services/monolith/workspace/slices/post/adapters/block_adapter.rb` (3 method → 1 method、rename)
- `services/monolith/workspace/slices/post/grpc/handler.rb` (3 削除: require、follow_adapter helper、access_policy helper + 1 rename: get_blocked_user_ids 内部呼出)

---

## Task 1: `Post::Policies::AccessPolicy` 削除

**Files:** Delete `services/monolith/workspace/slices/post/policies/access_policy.rb`。

- [ ] **Step 1: 削除**

```bash
cd services/monolith/workspace
/usr/bin/rm slices/post/policies/access_policy.rb
```

- [ ] **Step 2: policies ディレクトリが空になれば rmdir**

```bash
/usr/bin/rmdir slices/post/policies 2>&1
```

(他 file が残っていれば失敗、それで OK)。

---

## Task 2: `Post::Adapters::FollowAdapter` 削除

**Files:** Delete `services/monolith/workspace/slices/post/adapters/follow_adapter.rb`。

- [ ] **Step 1: 削除**

```bash
/usr/bin/rm slices/post/adapters/follow_adapter.rb
```

---

## Task 3: `Post::Adapters::BlockAdapter` を 1 method に絞り symmetric rename

**Files:** Modify `services/monolith/workspace/slices/post/adapters/block_adapter.rb`。

旧 3 method (`blocked_guest_ids`、`cast_blocked_guest?`、`blocked_by_cast_ids`) を 1 method (`blocked_ids`) に絞る。

- [ ] **Step 1: 全置換**

```ruby
# frozen_string_literal: true

module Post
  module Adapters
    # Cross-slice block view from Post slice. Wraps the new social schema's
    # block repository. Used by Post::Grpc::Handler#get_blocked_user_ids to
    # exclude blocked accounts from comment hydration.
    class BlockAdapter
      def blocked_ids(account_id:)
        block_repo.blocked_ids(account_id: account_id)
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

## Task 4: `Post::Grpc::Handler` から dead helper 削除 + rename caller 更新

**Files:** Modify `services/monolith/workspace/slices/post/grpc/handler.rb`。

3 削除 + 1 rename。

- [ ] **Step 1: `require_relative "../adapters/follow_adapter"` (line 9) を削除**

旧 (line 9):
```ruby
require_relative "../adapters/follow_adapter"
```

→ 行ごと削除。

- [ ] **Step 2: `def follow_adapter` helper (lines 44-46 付近) を削除**

旧:
```ruby
def follow_adapter
  @follow_adapter ||= Post::Adapters::FollowAdapter.new
end
```

→ block ごと削除。

- [ ] **Step 3: `def access_policy` helper (lines 56-58 付近) を削除**

旧:
```ruby
def access_policy
  @access_policy ||= Post::Policies::AccessPolicy.new
end
```

→ block ごと削除。

- [ ] **Step 4: `get_blocked_user_ids` の adapter 呼出を rename**

旧 (line 112 付近):
```ruby
def get_blocked_user_ids
  blocker = find_blocker
  return [] unless blocker

  block_adapter.blocked_guest_ids(blocker_id: blocker[:id])
end
```

新:
```ruby
def get_blocked_user_ids
  blocker = find_blocker
  return [] unless blocker

  block_adapter.blocked_ids(account_id: blocker[:id])
end
```

- [ ] **Step 5: Syntax check**

```bash
ruby -c slices/post/grpc/handler.rb
```

---

## Task 5: 検証 + commit

- [ ] **Step 1: orphan reference 確認**

```bash
cd services/monolith/workspace
/usr/bin/grep -rn "AccessPolicy\|FollowAdapter\|cast_blocked_guest\|blocked_by_cast_ids\|blocked_guest_ids" slices/post --include="*.rb" 2>&1 | /usr/bin/head -10
```

期待: 出力無し (空)。

- [ ] **Step 2: rspec baseline 維持**

```bash
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0、profile 153/14 (baseline 維持)。

- [ ] **Step 3: container resolve smoke (BlockAdapter のみ生存確認)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  ba = Post::Adapters::BlockAdapter.new
  zero = "00000000-0000-0000-0000-000000000000"
  puts "Post::Adapters::BlockAdapter#blocked_ids: #{ba.blocked_ids(account_id: zero).inspect}"
  begin
    Post::Policies::AccessPolicy
    puts "ERROR: AccessPolicy still resolves"
  rescue NameError
    puts "OK: AccessPolicy removed"
  end
  begin
    Post::Adapters::FollowAdapter
    puts "ERROR: FollowAdapter still resolves"
  rescue NameError
    puts "OK: FollowAdapter removed"
  end
' 2>&1 | /usr/bin/tail -10
```

期待: `[]` + 2 個の "OK: ... removed"。

- [ ] **Step 4: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 2 deleted + 2 modified + plan = **5 files**。

- [ ] **Step 5: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-post-access-policy-drop
/usr/bin/git add -A services/monolith/workspace docs/superpowers/plans/2026-06-16-post-access-policy-drop.md
/usr/bin/git commit -s -m "chore(post): drop dead AccessPolicy + FollowAdapter, rename blocked_guest_ids -> blocked_ids"
```

push しない。

---

## Deferred

- **CommentHandler の `get_blocked_user_ids` helper rename** (`user_ids` → `account_ids` 等) — caller 4 箇所への ripple があり、symmetric naming polish の余り。別 PR。

## Self-Review

- **Surgical**: AccessPolicy が dead code であることを caller grep で確認済、削除に runtime risk なし
- **Placeholder 無し**: 全 modify / delete 完全列挙
- **Naming 一貫性**: BlockAdapter は唯一活き method の signature を Social repo と揃える (`blocked_ids(account_id:)`)、kwarg も symmetric
- **検証**: orphan grep 空 + rspec baseline + container smoke (AccessPolicy / FollowAdapter の NameError 確認)
