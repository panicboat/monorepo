# Notifications N1: proto + monolith slice scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** notifications slice 第 1 段。proto `notifications.v1` (3 RPC) を additive 追加し、両 stub を生成、monolith 側に `slices/notifications/` の scaffold (DB base、relations、repository) + schema migration + `bin/grpc` 登録を追加する。**use_case / handler は N2 で実装**、本 PR は build-green の足場のみ。

**Architecture:** social slice (S1+S2a) と同形 scaffold。1 schema + 1 table + 1 relation + 1 repository (idempotent emit / list / count / mark_read の 4 method)、proto 3 RPC + 1 enum + 5 message、両 stub regen。**`bin/grpc` への登録は本 PR で実施** (S2b の hidden bug を踏まないため)、handler ファイル本体は N2 で作るが、`bin/grpc` の `require_relative` も N2 で追加する方針。

**Tech Stack:** Protobuf / buf / Ruby / Hanami 2 / ROM-SQL / PostgreSQL。

**Spec:** `docs/superpowers/specs/2026-06-16-notifications-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n1-proto-scaffold`、branch `feat/notifications-n1-proto-scaffold` (origin/main = `08307ffd`、spec #691 マージ後)。**push しない**。
- 触らない: 他 slice / proto package、frontend、`bin/grpc` の handler 登録 (N2 で追加)、cross-slice 統合 (N3)。

### 既存パターン (踏襲)

- social slice scaffold (S2a #677): `slices/social/db/{repo,relation}.rb` を `Monolith::DB::*` 継承で薄く wrap、`relations/` に table mapping、`repositories/` に query method、migration は ROM::SQL.migration の up/down
- proto: social/v1 と同 layout (`syntax = "proto3"`、`package notifications.v1;`、`google.protobuf.Timestamp` import)
- stub regen: social と同様に `pnpm proto:gen` 経路 (frontend) と `bundle exec grpc_tools_ruby_protoc` (monolith arm64)、結果は notifications 関連のみ churn 0

## File Structure

**Proto (1 new file):**
- `proto/notifications/v1/notification_service.proto`

**Monolith stubs (2 new):**
- `services/monolith/workspace/stubs/notifications/v1/notification_service_pb.rb`
- `services/monolith/workspace/stubs/notifications/v1/notification_service_services_pb.rb`

**Frontend stub (1 new):**
- `services/frontend/workspace/src/stub/notifications/v1/notification_service_pb.ts`

**Monolith slice scaffold (7 new):**
- `services/monolith/workspace/config/db/migrate/20260616240000_create_notifications_schema.rb`
- `services/monolith/workspace/slices/notifications/config/slice.rb`
- `services/monolith/workspace/slices/notifications/db/repo.rb`
- `services/monolith/workspace/slices/notifications/db/relation.rb`
- `services/monolith/workspace/slices/notifications/relations/notifications.rb`
- `services/monolith/workspace/slices/notifications/repositories/notification_repository.rb`

**Monolith bin/grpc (1 modify):**
- `services/monolith/workspace/bin/grpc` (proto stub require のみ。handler require は N2 で追加)

**Plan (1 new):**
- `docs/superpowers/plans/2026-06-16-notifications-n1-proto-scaffold.md`

合計 13 file (proto 1 + stubs 3 + scaffold 7 + bin/grpc 1 modify + plan 1)。

---

## Task 1: proto `notifications.v1` 追加

**Files:** Create `proto/notifications/v1/notification_service.proto`。

- [ ] **Step 1: 実装**

```proto
syntax = "proto3";

package notifications.v1;

import "google/protobuf/timestamp.proto";
import "profile/v1/service.proto";

service NotificationService {
  rpc ListNotifications(ListNotificationsRequest) returns (ListNotificationsResponse);
  rpc GetUnreadCount(GetUnreadCountRequest) returns (GetUnreadCountResponse);
  rpc MarkRead(MarkReadRequest) returns (MarkReadResponse);
}

enum NotificationType {
  NOTIFICATION_TYPE_UNSPECIFIED = 0;
  NOTIFICATION_TYPE_LIKE = 1;
  NOTIFICATION_TYPE_COMMENT = 2;
  NOTIFICATION_TYPE_REPLY = 3;
  NOTIFICATION_TYPE_FOLLOW_REQUEST = 4;
  NOTIFICATION_TYPE_FOLLOW_APPROVED = 5;
}

message Notification {
  string id = 1;
  NotificationType type = 2;
  string target_resource_id = 3;             // post_id | comment_id | actor_account_id (per type)
  int32 actor_count = 4;                     // >= 1
  profile.v1.Profile latest_actor = 5;        // cross-slice hydration
  google.protobuf.Timestamp latest_event_at = 6;
  google.protobuf.Timestamp read_at = 7;      // unset = unread
}

message ListNotificationsRequest {
  int32 limit = 1;       // default 20, max 50
  string cursor = 2;     // base64 (latest_event_at, id)
}

message ListNotificationsResponse {
  repeated Notification notifications = 1;
  string next_cursor = 2;
  bool has_more = 3;
  int32 unread_count = 4;  // bundled to avoid 2x round-trip
}

message GetUnreadCountRequest {}

message GetUnreadCountResponse {
  int32 count = 1;
}

message MarkReadRequest {
  string id = 1;
}

message MarkReadResponse {}
```

- [ ] **Step 2: buf lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/proto
buf lint 2>&1 | /usr/bin/tail -10
```

期待: 致命傷 error 無し。

---

## Task 2: 両 stub 再生成

- [ ] **Step 1: 生成コマンド調査**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/find . -maxdepth 4 -name "buf.gen.*" 2>&1 | /usr/bin/head -5
/usr/bin/grep -l "proto:gen" services/*/workspace/package.json 2>&1 | /usr/bin/head -5
```

- [ ] **Step 2: frontend stub 生成**

```bash
cd services/frontend/workspace
pnpm proto:gen 2>&1 | /usr/bin/tail -10
```

期待: `src/stub/notifications/v1/notification_service_pb.ts` のみ新規、他 stub は無変更。churn あれば revert (`git checkout -- src/stub/<path>`)。

- [ ] **Step 3: monolith stub 生成 (arm64-darwin)**

```bash
cd services/monolith/workspace
bundle exec grpc_tools_ruby_protoc \
  --proto_path=../../../proto \
  --ruby_out=stubs \
  --grpc_out=stubs \
  ../../../proto/notifications/v1/notification_service.proto 2>&1 | /usr/bin/tail -5
```

期待: `stubs/notifications/v1/notification_service_pb.rb` + `stubs/notifications/v1/notification_service_services_pb.rb` の 2 file 新規。

- [ ] **Step 4: stub syntax check**

```bash
ruby -c stubs/notifications/v1/notification_service_pb.rb
ruby -c stubs/notifications/v1/notification_service_services_pb.rb
```

---

## Task 3: schema migration

**Files:** Create `services/monolith/workspace/config/db/migrate/20260616240000_create_notifications_schema.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS notifications"

    create_table :"notifications__notifications" do
      column :id, :uuid, null: false
      column :recipient_id, :uuid, null: false
      column :type, :text, null: false
      column :target_resource_id, :uuid, null: false
      column :actor_count, :integer, null: false, default: 1
      column :latest_actor_id, :uuid, null: false
      column :latest_event_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :read_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:recipient_id, :type, :target_resource_id], name: :uq_notifications_group
    end

    run <<~SQL
      CREATE INDEX idx_notifications_recipient_latest
        ON notifications.notifications (recipient_id, latest_event_at DESC)
    SQL

    run <<~SQL
      CREATE INDEX idx_notifications_recipient_unread
        ON notifications.notifications (recipient_id) WHERE read_at IS NULL
    SQL
  end

  down do
    drop_table :"notifications__notifications"
    run "DROP SCHEMA IF EXISTS notifications CASCADE"
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c config/db/migrate/20260616240000_create_notifications_schema.rb
```

- [ ] **Step 3: migration 実行 + structure.sql 再 dump**

```bash
bundle exec hanami db migrate 2>&1 | /usr/bin/tail -5
# 環境固有: pg_dump PATH に PostgreSQL 18 が要る場合あり
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec hanami db structure dump 2>&1 | /usr/bin/tail -5
```

期待: structure.sql に `notifications.notifications` 表 + index 出力。

---

## Task 4: monolith slice base files

### Task 4.1: `slices/notifications/config/slice.rb`

```ruby
# frozen_string_literal: true

module Notifications
  class Slice < Hanami::Slice
  end
end
```

### Task 4.2: `slices/notifications/db/repo.rb`

```ruby
# frozen_string_literal: true

module Notifications
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

### Task 4.3: `slices/notifications/db/relation.rb`

```ruby
# frozen_string_literal: true

module Notifications
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

- [ ] **Step 1: 3 file Syntax check**

```bash
ruby -c slices/notifications/config/slice.rb
ruby -c slices/notifications/db/repo.rb
ruby -c slices/notifications/db/relation.rb
```

---

## Task 5: `Notifications::Relations::Notifications`

**Files:** Create `services/monolith/workspace/slices/notifications/relations/notifications.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Notifications
  module Relations
    class Notifications < Notifications::DB::Relation
      schema(:"notifications__notifications", as: :notifications, infer: false) do
        attribute :id, Types::String
        attribute :recipient_id, Types::String
        attribute :type, Types::String
        attribute :target_resource_id, Types::String
        attribute :actor_count, Types::Integer
        attribute :latest_actor_id, Types::String
        attribute :latest_event_at, Types::Time
        attribute :read_at, Types::Time.optional
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/notifications/relations/notifications.rb
```

---

## Task 6: `Notifications::Repositories::NotificationRepository`

**Files:** Create `services/monolith/workspace/slices/notifications/repositories/notification_repository.rb`。

idempotent な upsert で aggregate、list / count / mark_read。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Notifications
  module Repositories
    # Single-table notification store with built-in aggregation:
    # UPSERT on (recipient_id, type, target_resource_id) increments actor_count and
    # rebumps latest_event_at + clears read_at on each new event.
    class NotificationRepository < Notifications::DB::Repo
      include Concerns::CursorPagination

      # Idempotent emit. Aggregates into existing group row if present, else inserts new.
      # Returns the resulting row.
      def emit(recipient_id:, type:, target_resource_id:, actor_id:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO notifications.notifications
            (id, recipient_id, type, target_resource_id, actor_count,
             latest_actor_id, latest_event_at, read_at, created_at)
          VALUES (?, ?, ?, ?, 1, ?, ?, NULL, ?)
          ON CONFLICT (recipient_id, type, target_resource_id) DO UPDATE SET
            actor_count = notifications.notifications.actor_count + 1,
            latest_actor_id = EXCLUDED.latest_actor_id,
            latest_event_at = EXCLUDED.latest_event_at,
            read_at = NULL
          RETURNING *
        SQL

        ds = notifications.dataset.db
        result = ds.fetch(sql, new_id, recipient_id, type, target_resource_id, actor_id, now, now).first
        result
      end

      def list(recipient_id:, limit: 20, cursor: nil)
        scope = notifications.where(recipient_id: recipient_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [latest_event_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def count_unread(recipient_id:)
        notifications.where(recipient_id: recipient_id, read_at: nil).count
      end

      # Updates read_at only if the caller is the recipient (defense against cross-account access).
      def mark_read(id:, recipient_id:)
        updated = notifications.dataset
          .where(id: id, recipient_id: recipient_id)
          .update(read_at: Time.now)
        updated > 0
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        scope.where {
          (latest_event_at < decoded[:created_at]) |
            ((latest_event_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
```

> **注**: cursor は既存 `Concerns::CursorPagination` に合わせて `(created_at, id)` の 2 column 形式で encode/decode、ここでは `created_at` field の意味を `latest_event_at` として読み替えて使う (cursor の文字列フォーマット互換のため field 名は流用)。

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/notifications/repositories/notification_repository.rb
```

---

## Task 7: `bin/grpc` に proto stub require 追加

**Files:** Modify `services/monolith/workspace/bin/grpc`。

- [ ] **Step 1: line 49 `require "trust/v1/service_services_pb"` の下に追記**

旧:
```ruby
require "trust/v1/service_services_pb"
```

新:
```ruby
require "trust/v1/service_services_pb"
require "notifications/v1/notification_service_services_pb"
```

> **Note**: handler 本体 (`slices/notifications/grpc/*`) は N2 で実装するため、`require_relative` の追加は N2 で行う。本 PR では proto stub の require のみ。

---

## Task 8: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0、profile 153/14 baseline 維持。

- [ ] **Step 2: container resolve smoke (repository 解決確認)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  repo = Notifications::Slice["repositories.notification_repository"]
  puts "NotificationRepository: #{repo.class}"
  zero = "00000000-0000-0000-0000-000000000000"
  puts "count_unread(empty): #{repo.count_unread(recipient_id: zero).inspect}"
  puts "list(empty): #{repo.list(recipient_id: zero).inspect}"
' 2>&1 | /usr/bin/tail -10
```

期待:
- `NotificationRepository: Notifications::Repositories::NotificationRepository`
- `count_unread(empty): 0`
- `list(empty): []`
- SQL ログに `notifications.notifications` 表アクセスが出る

- [ ] **Step 3: frontend tsc / build baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -5
pnpm build 2>&1 | /usr/bin/tail -10
```

期待: tsc 緑、build 緑、新 stub 影響無し (consumer は N4 で追加)。

- [ ] **Step 4: diff stat**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 1 proto + 3 stub + 7 monolith scaffold + 1 bin/grpc + 1 structure.sql + plan = **14 files 前後**。

- [ ] **Step 5: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n1-proto-scaffold
/usr/bin/git add -A proto services/monolith/workspace services/frontend/workspace docs/superpowers/plans/2026-06-16-notifications-n1-proto-scaffold.md
/usr/bin/git commit -s -m "feat(notifications): proto + monolith slice scaffold (N1)"
```

push しない。

---

## Deferred

- **N2** (use_cases + handlers): `Emit`、`ListNotifications`、`GetUnreadCount`、`MarkRead` use_case + `NotificationHandler`、`bin/grpc` の `require_relative` 追加
- **N3** (cross-slice emit hooks): Post::Likes::LikePost、Post::Comments::AddComment、Social::Follows::Follow、Social::Follows::ApproveFollowRequest に fire-and-forget emit を追加
- **N4** (frontend data layer): types + mappers + 2 hook + 3 BFF route + grpc.ts に notificationClient 追加
- **N5** (frontend UI): NotificationBell + /notifications page + /dev/ui mock

## Self-Review

- **Spec coverage (N1 範囲)**: proto 3 RPC + schema + relations + repository (4 method) + bin/grpc 半分 (proto stub require)
- **Placeholder 無し**: 全 ruby code + proto + SQL を完全列挙
- **Surgical**: 新規 file 中心 + bin/grpc 1 行追加のみ、既存 code 無改変
- **bin/grpc lesson**: S2b の hidden bug を回避するため proto stub require を本 PR で明示。handler require は N2 で同じ section に追加
- **検証**: rspec baseline + container smoke + frontend tsc/build で 4 軸 baseline 維持
