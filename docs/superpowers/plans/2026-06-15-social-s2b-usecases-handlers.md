# Social S2b: use_cases + handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S2a (#677) で作った social slice の repositories の上に、**14 use_cases (10 follow + 4 block) + 2 gRPC handlers** を実装し、`social.v1.FollowService` / `BlockService` 全 14 RPC が動く状態にする。Profile の hydration は `Profile::Slice["use_cases.get_profile"]` 経由。

**Architecture:** **Greenfield additive**。Hanami slice 規約に従い `slices/social/use_cases/{follows,blocks}/*.rb` と `slices/social/grpc/{follow_handler,block_handler}.rb` を新規作成。各 use_case は薄いラッパー (repository への delegation)、Follow だけ profile.is_private 参照ロジック、Block は repository の transaction を呼ぶ。Handler は `Gruf::Controllers::Base` + `Grpc::Authenticatable` で標準 pattern。

**Tech Stack:** Ruby / Hanami 2 / gruf / ROM。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s2b-usecases-handlers`、branch `feat/social-s2b-usecases-handlers` (origin/main = `8826a142` base、S2a #677 マージ後)。**push しない**。
- 触らない: 旧 `slices/relationship/*`、他 slice、proto、frontend。

### 既存パターン (踏襲)

- handler: `Gruf::Controllers::Base` + `include Grpc::Authenticatable` (`current_user_id`) + `bind ::Social::V1::FollowService::Service` + `rpc :Follow, ...` declarations + `include Social::Deps[follow_uc: "use_cases.follows.follow", ...]`
- use_case: `class Follow; include Social::Deps[...]; def call(...); ... end; end`
- Cross-slice: `Profile::Slice["use_cases.get_profile"]` で profile.v1.Profile 取得 (返り値が`Profile::V1::Profile` proto)
- 既存 reference: `slices/relationship/grpc/block_handler.rb`、`slices/relationship/use_cases/follows/follow_cast.rb`

## File Structure

- Create: `slices/social/grpc/handler.rb` (base、`Gruf::Controllers::Base` 継承 + Authenticatable include + 共通 deps)
- Create: `slices/social/grpc/follow_handler.rb` (10 RPC)
- Create: `slices/social/grpc/block_handler.rb` (4 RPC)
- Create: 10 use_case under `slices/social/use_cases/follows/` (詳細下記)
- Create: 4 use_case under `slices/social/use_cases/blocks/` (詳細下記)

---

## Task 1: base handler (`slices/social/grpc/handler.rb`)

**Files:** Create file。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Social
  module Grpc
    # Base handler for Social slice. Provides authenticatable + cursor pagination.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include Concerns::CursorPagination

      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]
    end
  end
end
```

- [ ] **Step 2: 構文チェック**

```bash
cd services/monolith/workspace && ruby -c slices/social/grpc/handler.rb
```

---

## Task 2: follow use_cases (10 個)

### Task 2.1: `Social::UseCases::Follows::Follow`

**Files:** Create `slices/social/use_cases/follows/follow.rb`。

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Symmetric Follow. Looks up the target's profile.is_private (cross-slice) and decides
      # whether to insert pending or approved. Returns the resulting status.
      class Follow
        include Social::Deps[follow_repo: "repositories.follow_repository", block_repo: "repositories.block_repository"]

        # @return [Hash{status: String, reason: Symbol?}]
        def call(follower_id:, target_account_id:)
          if block_repo.blocked?(blocker_id: target_account_id, blocked_id: follower_id) ||
             block_repo.blocked?(blocker_id: follower_id, blocked_id: target_account_id)
            return { status: "none", reason: :blocked }
          end

          profile = get_profile.call(account_id: target_account_id)
          is_private = profile.respond_to?(:is_private) ? !!profile.is_private : false
          status = is_private ? "pending" : "approved"

          result = follow_repo.follow(follower_id: follower_id, followee_id: target_account_id, status: status)
          { status: result[:status] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end
      end
    end
  end
end
```

### Task 2.2: `Unfollow` / `CancelFollowRequest`

両方とも repo の `unfollow` を呼ぶ薄ラッパー (pending か approved かは問わず両方とも DELETE)。

`slices/social/use_cases/follows/unfollow.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class Unfollow
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_id:, target_account_id:)
          follow_repo.unfollow(follower_id: follower_id, followee_id: target_account_id)
          {}
        end
      end
    end
  end
end
```

`slices/social/use_cases/follows/cancel_follow_request.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Same as Unfollow but semantically used while status='pending'. The repo doesn't
      # distinguish so this is a thin alias.
      class CancelFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_id:, target_account_id:)
          follow_repo.unfollow(follower_id: follower_id, followee_id: target_account_id)
          {}
        end
      end
    end
  end
end
```

### Task 2.3: `ApproveFollowRequest` / `RejectFollowRequest`

`slices/social/use_cases/follows/approve_follow_request.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        # @param target_account_id [String] the account being followed (= viewer / approver)
        # @param requester_account_id [String] the account that requested to follow
        def call(target_account_id:, requester_account_id:)
          follow_repo.update_status(
            follower_id: requester_account_id,
            followee_id: target_account_id,
            status: "approved"
          )
          {}
        end
      end
    end
  end
end
```

`slices/social/use_cases/follows/reject_follow_request.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Reject = remove the pending row outright.
      class RejectFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(target_account_id:, requester_account_id:)
          follow_repo.unfollow(follower_id: requester_account_id, followee_id: target_account_id)
          {}
        end
      end
    end
  end
end
```

### Task 2.4: list use_cases (ListFollowing / ListFollowers / ListPendingFollowRequests)

3 use_case とも形は同じ: repo から rows を取り、cursor decode/encode、profile を per-id hydration、返り hash。

`slices/social/use_cases/follows/list_following.rb`:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Follows
      class ListFollowing
        include Concerns::CursorPagination
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        MAX_LIMIT = 50

        def call(account_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          rows = follow_repo.list_following(account_id: account_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.followee_id) }

          { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end
      end
    end
  end
end
```

`slices/social/use_cases/follows/list_followers.rb`:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Follows
      class ListFollowers
        include Concerns::CursorPagination
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        MAX_LIMIT = 50

        def call(account_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          rows = follow_repo.list_followers(account_id: account_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.follower_id) }

          { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end
      end
    end
  end
end
```

`slices/social/use_cases/follows/list_pending_follow_requests.rb`:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Follows
      # Pending follow requests TO viewer.
      class ListPendingFollowRequests
        include Concerns::CursorPagination
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        MAX_LIMIT = 50

        def call(account_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          rows = follow_repo.list_pending_to(account_id: account_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.follower_id) }

          { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end
      end
    end
  end
end
```

### Task 2.5: `GetFollowStatus` / `GetPendingFollowCount`

`slices/social/use_cases/follows/get_follow_status.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Batch follow status check. Missing keys = NONE (not following).
      class GetFollowStatus
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_id:, target_account_ids:)
          target_account_ids = (target_account_ids || []).compact.uniq
          present = follow_repo.status_batch(follower_id: follower_id, followee_ids: target_account_ids)
          target_account_ids.each_with_object({}) do |id, h|
            h[id.to_s] = present[id.to_s] || "none"
          end
        end
      end
    end
  end
end
```

`slices/social/use_cases/follows/get_pending_follow_count.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetPendingFollowCount
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(account_id:)
          follow_repo.count_pending_to(account_id: account_id)
        end
      end
    end
  end
end
```

- [ ] **Step: 10 use_case 全てで `ruby -c` Syntax OK**

```bash
for f in slices/social/use_cases/follows/*.rb; do ruby -c "$f"; done
```

---

## Task 3: block use_cases (4 個)

### Task 3.1: `Block` / `Unblock`

`slices/social/use_cases/blocks/block.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Blocks
      class Block
        include Social::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_id:, target_account_id:)
          block_repo.block(blocker_id: blocker_id, blocked_id: target_account_id)
          {}
        end
      end
    end
  end
end
```

`slices/social/use_cases/blocks/unblock.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Blocks
      class Unblock
        include Social::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_id:, target_account_id:)
          block_repo.unblock(blocker_id: blocker_id, blocked_id: target_account_id)
          {}
        end
      end
    end
  end
end
```

### Task 3.2: `ListBlocked` / `GetBlockStatus`

`slices/social/use_cases/blocks/list_blocked.rb`:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Blocks
      class ListBlocked
        include Concerns::CursorPagination
        include Social::Deps[block_repo: "repositories.block_repository"]

        MAX_LIMIT = 50

        def call(blocker_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          rows = block_repo.list_blocked(blocker_id: blocker_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.blocked_id) }

          { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end
      end
    end
  end
end
```

`slices/social/use_cases/blocks/get_block_status.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Blocks
      class GetBlockStatus
        include Social::Deps[block_repo: "repositories.block_repository"]

        def call(blocker_id:, target_account_ids:)
          target_account_ids = (target_account_ids || []).compact.uniq
          block_repo.status_batch(blocker_id: blocker_id, blocked_ids: target_account_ids)
        end
      end
    end
  end
end
```

- [ ] **Step: 4 use_case 全てで `ruby -c` Syntax OK**

---

## Task 4: PostPresenter equivalent for Profile hydration (skip — use_cases return Profile proto directly via Profile::Slice)

`Profile::Slice["use_cases.get_profile"]` は `Profile::V1::Profile` を返すので handler 側でそのまま `repeated profile.v1.Profile profiles = 1` に詰められる。追加 presenter 不要。

---

## Task 5: `FollowHandler` (10 RPC)

**Files:** Create `slices/social/grpc/follow_handler.rb`。

```ruby
# frozen_string_literal: true

require "social/v1/follow_service_services_pb"
require_relative "handler"

module Social
  module Grpc
    class FollowHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.FollowService"

      bind ::Social::V1::FollowService::Service

      self.rpc_descs.clear

      rpc :Follow, ::Social::V1::FollowRequest, ::Social::V1::FollowResponse
      rpc :Unfollow, ::Social::V1::UnfollowRequest, ::Social::V1::UnfollowResponse
      rpc :CancelFollowRequest, ::Social::V1::CancelFollowRequestRequest, ::Social::V1::CancelFollowRequestResponse
      rpc :ApproveFollowRequest, ::Social::V1::ApproveFollowRequestRequest, ::Social::V1::ApproveFollowRequestResponse
      rpc :RejectFollowRequest, ::Social::V1::RejectFollowRequestRequest, ::Social::V1::RejectFollowRequestResponse
      rpc :ListFollowing, ::Social::V1::ListFollowingRequest, ::Social::V1::ListFollowingResponse
      rpc :ListFollowers, ::Social::V1::ListFollowersRequest, ::Social::V1::ListFollowersResponse
      rpc :ListPendingFollowRequests, ::Social::V1::ListPendingFollowRequestsRequest, ::Social::V1::ListPendingFollowRequestsResponse
      rpc :GetFollowStatus, ::Social::V1::GetFollowStatusRequest, ::Social::V1::GetFollowStatusResponse
      rpc :GetPendingFollowCount, ::Social::V1::GetPendingFollowCountRequest, ::Social::V1::GetPendingFollowCountResponse

      include Social::Deps[
        follow_uc: "use_cases.follows.follow",
        unfollow_uc: "use_cases.follows.unfollow",
        cancel_follow_request_uc: "use_cases.follows.cancel_follow_request",
        approve_follow_request_uc: "use_cases.follows.approve_follow_request",
        reject_follow_request_uc: "use_cases.follows.reject_follow_request",
        list_following_uc: "use_cases.follows.list_following",
        list_followers_uc: "use_cases.follows.list_followers",
        list_pending_follow_requests_uc: "use_cases.follows.list_pending_follow_requests",
        get_follow_status_uc: "use_cases.follows.get_follow_status",
        get_pending_follow_count_uc: "use_cases.follows.get_pending_follow_count"
      ]

      def follow
        authenticate_user!
        result = follow_uc.call(follower_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::FollowResponse.new(status: status_to_enum(result[:status]))
      end

      def unfollow
        authenticate_user!
        unfollow_uc.call(follower_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::UnfollowResponse.new
      end

      def cancel_follow_request
        authenticate_user!
        cancel_follow_request_uc.call(follower_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::CancelFollowRequestResponse.new
      end

      def approve_follow_request
        authenticate_user!
        approve_follow_request_uc.call(target_account_id: current_user_id, requester_account_id: request.message.requester_account_id)
        ::Social::V1::ApproveFollowRequestResponse.new
      end

      def reject_follow_request
        authenticate_user!
        reject_follow_request_uc.call(target_account_id: current_user_id, requester_account_id: request.message.requester_account_id)
        ::Social::V1::RejectFollowRequestResponse.new
      end

      def list_following
        authenticate_user!
        account_id = request.message.account_id.empty? ? current_user_id : request.message.account_id
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_following_uc.call(account_id: account_id, limit: limit, cursor: cursor)
        ::Social::V1::ListFollowingResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_followers
        authenticate_user!
        account_id = request.message.account_id.empty? ? current_user_id : request.message.account_id
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_followers_uc.call(account_id: account_id, limit: limit, cursor: cursor)
        ::Social::V1::ListFollowersResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_pending_follow_requests
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_pending_follow_requests_uc.call(account_id: current_user_id, limit: limit, cursor: cursor)
        ::Social::V1::ListPendingFollowRequestsResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_follow_status
        authenticate_user!
        statuses = get_follow_status_uc.call(
          follower_id: current_user_id,
          target_account_ids: request.message.target_account_ids.to_a
        )
        proto_statuses = statuses.transform_values { |s| status_to_enum(s) }
        ::Social::V1::GetFollowStatusResponse.new(statuses: proto_statuses)
      end

      def get_pending_follow_count
        authenticate_user!
        count = get_pending_follow_count_uc.call(account_id: current_user_id)
        ::Social::V1::GetPendingFollowCountResponse.new(count: count)
      end

      private

      def status_to_enum(status)
        case status
        when "approved" then ::Social::V1::FollowStatus::FOLLOW_STATUS_APPROVED
        when "pending" then ::Social::V1::FollowStatus::FOLLOW_STATUS_PENDING
        else ::Social::V1::FollowStatus::FOLLOW_STATUS_NONE
        end
      end
    end
  end
end
```

- [ ] **Step: Syntax OK**

```bash
ruby -c slices/social/grpc/follow_handler.rb
```

---

## Task 6: `BlockHandler` (4 RPC)

**Files:** Create `slices/social/grpc/block_handler.rb`。

```ruby
# frozen_string_literal: true

require "social/v1/block_service_services_pb"
require_relative "handler"

module Social
  module Grpc
    class BlockHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.BlockService"

      bind ::Social::V1::BlockService::Service

      self.rpc_descs.clear

      rpc :Block, ::Social::V1::BlockRequest, ::Social::V1::BlockResponse
      rpc :Unblock, ::Social::V1::UnblockRequest, ::Social::V1::UnblockResponse
      rpc :ListBlocked, ::Social::V1::ListBlockedRequest, ::Social::V1::ListBlockedResponse
      rpc :GetBlockStatus, ::Social::V1::GetBlockStatusRequest, ::Social::V1::GetBlockStatusResponse

      include Social::Deps[
        block_uc: "use_cases.blocks.block",
        unblock_uc: "use_cases.blocks.unblock",
        list_blocked_uc: "use_cases.blocks.list_blocked",
        get_block_status_uc: "use_cases.blocks.get_block_status"
      ]

      def block
        authenticate_user!
        block_uc.call(blocker_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::BlockResponse.new
      end

      def unblock
        authenticate_user!
        unblock_uc.call(blocker_id: current_user_id, target_account_id: request.message.target_account_id)
        ::Social::V1::UnblockResponse.new
      end

      def list_blocked
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_blocked_uc.call(blocker_id: current_user_id, limit: limit, cursor: cursor)
        ::Social::V1::ListBlockedResponse.new(
          profiles: result[:profiles],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_block_status
        authenticate_user!
        statuses = get_block_status_uc.call(
          blocker_id: current_user_id,
          target_account_ids: request.message.target_account_ids.to_a
        )
        ::Social::V1::GetBlockStatusResponse.new(blocked: statuses)
      end
    end
  end
end
```

- [ ] **Step: Syntax OK**

```bash
ruby -c slices/social/grpc/block_handler.rb
```

---

## Task 7: rspec 維持 + container smoke + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/feed 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/relationship 2>&1 | /usr/bin/tail -5
bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: 全 baseline 維持 (post 62/0、feed 0、relationship 31/0、profile 148/14)。

- [ ] **Step 2: container resolve smoke (全 use_case + handler)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  # follow use_cases
  %w[
    use_cases.follows.follow
    use_cases.follows.unfollow
    use_cases.follows.cancel_follow_request
    use_cases.follows.approve_follow_request
    use_cases.follows.reject_follow_request
    use_cases.follows.list_following
    use_cases.follows.list_followers
    use_cases.follows.list_pending_follow_requests
    use_cases.follows.get_follow_status
    use_cases.follows.get_pending_follow_count
  ].each { |k| puts "#{k} => #{Social::Slice[k].class}" }

  # block use_cases
  %w[
    use_cases.blocks.block
    use_cases.blocks.unblock
    use_cases.blocks.list_blocked
    use_cases.blocks.get_block_status
  ].each { |k| puts "#{k} => #{Social::Slice[k].class}" }

  # handlers boot
  puts "FollowHandler class: #{Social::Grpc::FollowHandler}"
  puts "BlockHandler class: #{Social::Grpc::BlockHandler}"

  # functional smoke: empty state Follow status batch
  uc = Social::Slice["use_cases.follows.get_follow_status"]
  result = uc.call(follower_id: "00000000-0000-0000-0000-000000000000", target_account_ids: ["11111111-1111-1111-1111-111111111111"])
  puts "GetFollowStatus empty: #{result.inspect}"
' 2>&1 | /usr/bin/tail -25
```

期待: 全 14 use_case + 2 handler class 解決成功、`GetFollowStatus empty: {"11111111-...": "none"}` 返却。

- [ ] **Step 3: diff stat 確認**

期待: 1 base handler + 10 follow use_case + 4 block use_case + 2 handler + plan = **18 files**。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-s2b-usecases-handlers
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-15-social-s2b-usecases-handlers.md
/usr/bin/git commit -s -m "feat(social): use_cases + grpc handlers (14 RPC live)"
```

push しない。

---

## Deferred

- **cross-slice helpers** (`viewer_can_see_post` / `filter_visible_posts`) → S3
- **frontend data 層** → S4
- **frontend UI** → S5
- **旧 relationship slice の drop** → cleanup フェーズ
- **unit specs**: container smoke + functional smoke (GetFollowStatus empty path) で動作確認、unit spec は YAGNI で skip

## Self-Review

- **Spec coverage (S2b 範囲)**: 14 RPC 全実装、各々が薄い use_case → repository delegation。Follow のみ is_private 参照ロジック。
- **Greenfield additive**: 旧 relationship slice 完全無改変、新 social slice 内のみ。
- **Placeholder 無し**: 全 use_case + handler の完全コード提示。
- **型 / 命名整合**: `current_user_id`（authenticatable 提供）= account_id、Repository signature と一致 (follower_id / target_account_id / blocker_id / blocked_id 統一)。`FollowStatus::FOLLOW_STATUS_*` enum 値。
- **Profile hydration**: 全 list use_case が `Profile::Slice["use_cases.get_profile"]` per-id call、結果 (`Profile::V1::Profile`) をそのまま response の `repeated profile.v1.Profile` に詰める (追加 presenter 不要)。
- **テスト方針**: rspec 既存 baseline 維持 + container smoke で 16 unit (14 uc + 2 handler) resolve + 1 functional smoke (GetFollowStatus)。
