# Notifications N2: use_cases + handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** N1 (#692) で作った `Notifications::Repositories::NotificationRepository` の上に、**4 use_cases + 2 handler file** を実装、`bin/grpc` に handler require を追加して、`notifications.v1.NotificationService` 全 3 RPC が production で応答する状態にする。

**Architecture:** social slice (S2b #678) と同形。base handler + 1 RPC handler。Emit use_case は suppression rules (self-action / blocked) を内包、cross-slice block check に `Social::Slice["repositories.block_repository"]` を呼ぶ。List use_case は `Profile::Slice["use_cases.get_profile"]` で `latest_actor` を hydration、cross-slice の bundled `unread_count` も同 use_case で返す。

**Tech Stack:** Ruby / Hanami 2 / gruf / ROM-SQL。

**Spec:** `docs/superpowers/specs/2026-06-16-notifications-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n2-usecases-handler`、branch `feat/notifications-n2-usecases-handler` (origin/main = `8240d5e5`、N1 #692 マージ後)。**push しない**。
- 触らない: N1 で作った scaffold、他 slice、frontend、proto、cross-slice emit hook (N3 で追加)。

### 既存パターン (踏襲)

- handler base: `Social::Grpc::Handler` (S2b) — `Gruf::Controllers::Base` + `Grpc::Authenticatable` include + `Concerns::CursorPagination` include + repo deps
- handler: `Social::Grpc::FollowHandler` — `bind ::Social::V1::FollowService::Service`、`self.rpc_descs.clear`、`rpc :Method, Req, Res` declarations、`include Social::Deps[uc_key: "use_cases.foo"]`、`authenticate_user!` → call uc → return response proto
- use_case: `Social::UseCases::Follows::Follow` — `include Social::Deps[follow_repo: "repositories.follow_repository"]`、`def call(**)` returns Hash
- cross-slice: `Profile::Slice["use_cases.get_profile"]` で `Profile::V1::Profile` を直接 list 系 response の `repeated profile.v1.Profile profiles = ...` に詰める

### N1 で確定済の constraint

- relation reader 名は **`notification_records`** (ROM-SQL の dry-monitor instrumentation 衝突回避、N1 #692 で alias rename 済)
- `bin/grpc` line 50 直下 (proto stub require ブロックの末尾) に `require "notifications/v1/notification_service_services_pb"` 済、本 PR で handler require をその下 (handler require ブロックの末尾) に追加

## File Structure

**New (6 file):**
- `services/monolith/workspace/slices/notifications/use_cases/emit.rb`
- `services/monolith/workspace/slices/notifications/use_cases/list_notifications.rb`
- `services/monolith/workspace/slices/notifications/use_cases/get_unread_count.rb`
- `services/monolith/workspace/slices/notifications/use_cases/mark_read.rb`
- `services/monolith/workspace/slices/notifications/grpc/handler.rb`
- `services/monolith/workspace/slices/notifications/grpc/notification_handler.rb`

**Modify (1 file):**
- `services/monolith/workspace/bin/grpc` (handler require 2 行追加)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-16-notifications-n2-usecases-handler.md`

合計 8 file。

---

## Task 1: `Notifications::UseCases::Emit`

**Files:** Create `services/monolith/workspace/slices/notifications/use_cases/emit.rb`。

Suppression: self-action / recipient-blocked-actor を skip。fire-and-forget 呼出 (cross-slice from Post / Social) のため内部 rescue で nil を返す。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Notifications
  module UseCases
    # Fire-and-forget notification emit. Applies suppression (self-action skip,
    # block-aware skip) then idempotently upserts via NotificationRepository#emit.
    #
    # Returns the resulting row on success, nil on suppression or failure.
    # Callers (cross-slice from Post / Social use_cases) should NOT rescue or branch
    # on the return value -- emit must never disrupt the source action.
    class Emit
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      # @param recipient_id [String] account_id receiving the notification
      # @param type [String] one of: 'like' | 'comment' | 'reply' | 'follow_request' | 'follow_approved'
      # @param target_resource_id [String] post_id | comment_id | actor_account_id (per type)
      # @param actor_id [String] account_id who triggered the event
      # @return [Object, nil] row or nil
      def call(recipient_id:, type:, target_resource_id:, actor_id:)
        return nil if recipient_id.nil? || actor_id.nil?
        return nil if recipient_id.to_s == actor_id.to_s

        return nil if block_repo.blocked?(blocker_id: recipient_id, blocked_id: actor_id)

        notification_repo.emit(
          recipient_id: recipient_id,
          type: type,
          target_resource_id: target_resource_id,
          actor_id: actor_id
        )
      rescue StandardError => e
        Hanami.logger.warn("Notifications::Emit failed: #{e.class}: #{e.message}")
        nil
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
cd services/monolith/workspace && ruby -c slices/notifications/use_cases/emit.rb
```

---

## Task 2: `Notifications::UseCases::ListNotifications`

**Files:** Create `services/monolith/workspace/slices/notifications/use_cases/list_notifications.rb`。

cursor pagination + per-row `Profile::Slice` で latest_actor hydration + bundled unread_count。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Notifications
  module UseCases
    # Cursor-paginated list of the recipient's notifications, with each row's
    # latest_actor hydrated to profile.v1.Profile via the Profile slice. The
    # response is bundled with the recipient's total unread_count so the frontend
    # avoids a separate round-trip on page load.
    class ListNotifications
      include Concerns::CursorPagination
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      MAX_LIMIT = 50

      # @return [Hash] { rows: Array<row>, profiles_by_actor_id: Hash, next_cursor: String|nil, has_more: Boolean, unread_count: Integer }
      def call(recipient_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        rows = notification_repo.list(recipient_id: recipient_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.latest_event_at.iso8601, id: last.id)
        end

        actor_ids = result[:items].map(&:latest_actor_id).uniq
        profiles_by_actor_id = actor_ids.each_with_object({}) do |aid, h|
          h[aid] = get_profile.call(account_id: aid)
        end

        {
          rows: result[:items],
          profiles_by_actor_id: profiles_by_actor_id,
          next_cursor: result[:next_cursor],
          has_more: result[:has_more],
          unread_count: notification_repo.count_unread(recipient_id: recipient_id)
        }
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/notifications/use_cases/list_notifications.rb
```

---

## Task 3: `Notifications::UseCases::GetUnreadCount`

**Files:** Create `services/monolith/workspace/slices/notifications/use_cases/get_unread_count.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Notifications
  module UseCases
    class GetUnreadCount
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(recipient_id:)
        notification_repo.count_unread(recipient_id: recipient_id)
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/notifications/use_cases/get_unread_count.rb
```

---

## Task 4: `Notifications::UseCases::MarkRead`

**Files:** Create `services/monolith/workspace/slices/notifications/use_cases/mark_read.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Notifications
  module UseCases
    class MarkRead
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      # @return [Boolean] true if the row was updated, false if not found or not recipient
      def call(id:, recipient_id:)
        notification_repo.mark_read(id: id, recipient_id: recipient_id)
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/notifications/use_cases/mark_read.rb
```

---

## Task 5: `Notifications::Grpc::Handler` base

**Files:** Create `services/monolith/workspace/slices/notifications/grpc/handler.rb`。

Social handler base と同形。`Gruf::Controllers::Base` + `Grpc::Authenticatable` + `Concerns::CursorPagination`、repo dep を共通注入。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Notifications
  module Grpc
    # Base handler for Notifications slice. Provides authenticatable + cursor pagination.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include Concerns::CursorPagination

      include Notifications::Deps[
        notification_repo: "repositories.notification_repository"
      ]
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/notifications/grpc/handler.rb
```

---

## Task 6: `Notifications::Grpc::NotificationHandler` (3 RPC binding)

**Files:** Create `services/monolith/workspace/slices/notifications/grpc/notification_handler.rb`。

Social FollowHandler と同形。3 RPC を bind、各 method で `authenticate_user!` → call uc → return proto response。

`latest_actor` の hydration は ListNotifications use_case が返す `profiles_by_actor_id` を proto Notification に詰める時に lookup。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "notifications/v1/notification_service_services_pb"
require_relative "handler"

module Notifications
  module Grpc
    class NotificationHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "notifications.v1.NotificationService"

      bind ::Notifications::V1::NotificationService::Service

      self.rpc_descs.clear

      rpc :ListNotifications, ::Notifications::V1::ListNotificationsRequest, ::Notifications::V1::ListNotificationsResponse
      rpc :GetUnreadCount, ::Notifications::V1::GetUnreadCountRequest, ::Notifications::V1::GetUnreadCountResponse
      rpc :MarkRead, ::Notifications::V1::MarkReadRequest, ::Notifications::V1::MarkReadResponse

      include Notifications::Deps[
        list_uc: "use_cases.list_notifications",
        unread_count_uc: "use_cases.get_unread_count",
        mark_read_uc: "use_cases.mark_read"
      ]

      def list_notifications
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_uc.call(recipient_id: current_user_id, limit: limit, cursor: cursor)

        proto_notifications = result[:rows].map do |row|
          ::Notifications::V1::Notification.new(
            id: row.id,
            type: type_to_enum(row.type),
            target_resource_id: row.target_resource_id,
            actor_count: row.actor_count,
            latest_actor: result[:profiles_by_actor_id][row.latest_actor_id],
            latest_event_at: time_to_timestamp(row.latest_event_at),
            read_at: row.read_at ? time_to_timestamp(row.read_at) : nil
          )
        end

        ::Notifications::V1::ListNotificationsResponse.new(
          notifications: proto_notifications,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more],
          unread_count: result[:unread_count]
        )
      end

      def get_unread_count
        authenticate_user!
        count = unread_count_uc.call(recipient_id: current_user_id)
        ::Notifications::V1::GetUnreadCountResponse.new(count: count)
      end

      def mark_read
        authenticate_user!
        mark_read_uc.call(id: request.message.id, recipient_id: current_user_id)
        ::Notifications::V1::MarkReadResponse.new
      end

      private

      def type_to_enum(type)
        case type
        when "like" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_LIKE
        when "comment" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_COMMENT
        when "reply" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_REPLY
        when "follow_request" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_FOLLOW_REQUEST
        when "follow_approved" then ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_FOLLOW_APPROVED
        else ::Notifications::V1::NotificationType::NOTIFICATION_TYPE_UNSPECIFIED
        end
      end

      def time_to_timestamp(t)
        Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: (t.nsec || 0))
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/notifications/grpc/notification_handler.rb
```

---

## Task 7: `bin/grpc` に handler require 追加

**Files:** Modify `services/monolith/workspace/bin/grpc`。

handler require ブロックの末尾 (現状 trust handler の下) に追記。

- [ ] **Step 1: 追記**

旧 (line 80-81 付近):
```ruby
require_relative "../slices/trust/grpc/handler"
require_relative "../slices/trust/grpc/trust_handler"
```

新:
```ruby
require_relative "../slices/trust/grpc/handler"
require_relative "../slices/trust/grpc/trust_handler"
require_relative "../slices/notifications/grpc/handler"
require_relative "../slices/notifications/grpc/notification_handler"
```

---

## Task 8: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 baseline 維持。

- [ ] **Step 2: container resolve smoke (4 use_case + 2 handler class 解決 + 簡易動作確認)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  %w[
    use_cases.emit
    use_cases.list_notifications
    use_cases.get_unread_count
    use_cases.mark_read
  ].each { |k| puts "#{k} => #{Notifications::Slice[k].class}" }

  puts "Notifications::Grpc::Handler: #{Notifications::Grpc::Handler}"
  puts "Notifications::Grpc::NotificationHandler: #{Notifications::Grpc::NotificationHandler}"

  zero = "00000000-0000-0000-0000-000000000000"
  # Empty path: list + count
  list_result = Notifications::Slice["use_cases.list_notifications"].call(recipient_id: zero)
  puts "list empty rows: #{list_result[:rows].length}, unread: #{list_result[:unread_count]}"

  count = Notifications::Slice["use_cases.get_unread_count"].call(recipient_id: zero)
  puts "unread_count(empty): #{count}"

  # Emit suppression smoke (self-action)
  result = Notifications::Slice["use_cases.emit"].call(
    recipient_id: zero, type: "like", target_resource_id: zero, actor_id: zero
  )
  puts "emit(self-action): #{result.inspect}"
' 2>&1 | /usr/bin/tail -20
```

期待:
- 全 use_case + handler class 解決
- `list empty rows: 0, unread: 0`
- `unread_count(empty): 0`
- `emit(self-action): nil` (suppression OK)

- [ ] **Step 3: bin/grpc boot smoke (Gruf.services リストに NotificationHandler 登場)**

```bash
cd services/monolith/workspace
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH timeout 10 bundle exec ruby -I stubs bin/grpc 2>&1 | /usr/bin/grep -E "Starting|Notifications|notifications.v1" | /usr/bin/head -10
pkill -f "bundle exec ruby.*bin/grpc" 2>&1 ; true
```

期待: "Starting gRPC Stub Server" + `Notifications::Grpc::NotificationHandler` 登場、または `notifications.v1.NotificationService` の binding ログ。

> **Note**: 既存 `Post::Concerns::CursorPagination` autoload error が出る場合あり (前 PR で観測済の pre-existing issue)、その場合 require 経路を疑い別途調査。Notifications handler の require が読まれていることが確認できれば本 PR の目的は達成。

- [ ] **Step 4: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 6 new + 1 modify + plan = **8 files**。

- [ ] **Step 5: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n2-usecases-handler
/usr/bin/git add -A services/monolith/workspace docs/superpowers/plans/2026-06-16-notifications-n2-usecases-handler.md
/usr/bin/git commit -s -m "feat(notifications): use_cases + grpc handler (3 RPC live, N2)"
```

push しない。

---

## Deferred

- **N3** (cross-slice emit hooks): Post::Likes::LikePost、Post::Comments::AddComment、Social::Follows::Follow、Social::Follows::ApproveFollowRequest に fire-and-forget `Notifications::Slice["use_cases.emit"].call(...)` を追加
- **N4** (frontend data): types + mappers + 2 hook + 3 BFF route + grpc.ts に notificationClient 追加
- **N5** (frontend UI): NotificationBell + /notifications page + /dev/ui mock

## Self-Review

- **Spec coverage (N2 範囲)**: 4 use_case + 2 handler + bin/grpc handler require
- **Placeholder 無し**: 全 ruby code 完全列挙
- **Cross-slice 呼出**: Emit が `Social::Slice["repositories.block_repository"]`、ListNotifications が `Profile::Slice["use_cases.get_profile"]` の二経路、smoke で suppression 動作確認
- **bin/grpc lesson**: handler require を本 PR で追加、S2b hidden bug 回避
- **型 / 命名整合**:
  - `recipient_id`、`actor_id`、`target_resource_id` を kwarg 統一
  - `type` enum string → proto enum 変換は handler private method で
  - cursor encode は `latest_event_at` を `created_at` field として既存 `Concerns::CursorPagination` 互換
- **検証**: rspec baseline + container smoke (4 use_case + 2 handler + suppression empty path) + bin/grpc 起動 smoke
