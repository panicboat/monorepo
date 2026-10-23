# Messaging M1: monolith unary slice + NOTIFY publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** messaging slice 第 1 段 (unary 部分)。proto `messaging.v1` + 両 stub + 3 table schema + slice scaffold + 2 relation + 1 repository + **7 unary use_cases** + 2 handler (StreamEvents は **method stub のみ** = `raise GRPC::Unimplemented` 等)、bin/grpc 登録、SendMessage / MarkRead / SendTyping 内で **NOTIFY publish 実装** (subscriber 不在でも問題なし)。M2 で StreamEvents の LISTEN side を実装する足場を本 PR で完成。

**Architecture:** discovery D1 + bookmarks B1 + notifications N1+N2 の合体パターン。relation alias は `:thread_records` / `:message_records` / `:read_state_records` で ROM-SQL 衝突回避 (notifications lesson)。Cross-slice = `Social::Slice` (follow + block check) + `Profile::Slice` (counterpart hydration)。NOTIFY は `Sequel::Database#notify` (PostgreSQL adapter 提供) で実行、payload は JSON 文字列。

**Tech Stack:** Protobuf / Ruby / Hanami 2 / ROM-SQL / gruf / PostgreSQL LISTEN/NOTIFY。

**Spec:** `docs/superpowers/specs/2026-06-17-messaging-slice-design.md`。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-messaging-m1-unary`、branch `feat/messaging-m1-unary` (origin/main = `682936df`、spec #710 マージ後)。**push しない**。
- 触らない: 他 slice の既存 method、frontend (stub regen 以外)、cross-slice emit hook (notifications との連動なし)。

### 既存パターン (踏襲)

- slice scaffold = discovery D1 (#708) と同形、ただし自前 table あり (discovery と違って relation / repo がある)
- relation alias = `:thread_records` / `:message_records` / `:read_state_records` で notifications N1 lesson 適用
- bin/grpc 登録 = proto stub require + handler require 同 PR (S2b hidden bug 回避)
- NOTIFY 実装 = Sequel の `db.notify("channel", payload: "<json>")` (built-in PG adapter API)
- cursor pagination = 既存 `Concerns::CursorPagination` 流用

### NOTIFY 実装パターン

```ruby
db = thread_records.dataset.db
payload = { type: "message", data: serialize_message(message) }.to_json
db.notify("messaging_user_#{recipient_id}", payload: payload)
```

LISTEN side (M2) で同 payload を JSON parse して event 復元。

### StreamEvents stub

M1 では handler method を空 yield ループ or 即 return で stub 化:
```ruby
def stream_events
  # M2 で本実装、現状は subscriber 不在を装う
end
```

Gruf streaming は M2 で完全実装、M1 では method 自体は bind 済で `Gruf.services` に登場するため最低限の noop で OK。

## File Structure

**Proto (1 new):**
- `proto/messaging/v1/messaging_service.proto`

**Monolith stubs (2 new):**
- `services/monolith/workspace/stubs/messaging/v1/messaging_service_pb.rb`
- `services/monolith/workspace/stubs/messaging/v1/messaging_service_services_pb.rb`

**Frontend stub (1 new):**
- `services/frontend/workspace/src/stub/messaging/v1/messaging_service_pb.ts`

**Monolith slice (14 new):**
- `services/monolith/workspace/config/db/migrate/20260617130000_create_messaging_schema.rb`
- `services/monolith/workspace/slices/messaging/config/slice.rb`
- `services/monolith/workspace/slices/messaging/db/repo.rb`
- `services/monolith/workspace/slices/messaging/db/relation.rb`
- `services/monolith/workspace/slices/messaging/relations/threads.rb`
- `services/monolith/workspace/slices/messaging/relations/messages.rb`
- `services/monolith/workspace/slices/messaging/relations/read_states.rb`
- `services/monolith/workspace/slices/messaging/repositories/messaging_repository.rb` (3 表まとめて 1 repo)
- `services/monolith/workspace/slices/messaging/use_cases/send_message.rb`
- `services/monolith/workspace/slices/messaging/use_cases/list_threads.rb`
- `services/monolith/workspace/slices/messaging/use_cases/get_or_create_thread.rb`
- `services/monolith/workspace/slices/messaging/use_cases/list_messages.rb`
- `services/monolith/workspace/slices/messaging/use_cases/mark_read.rb`
- `services/monolith/workspace/slices/messaging/use_cases/get_total_unread_count.rb`
- `services/monolith/workspace/slices/messaging/use_cases/send_typing.rb`
- `services/monolith/workspace/slices/messaging/grpc/handler.rb`
- `services/monolith/workspace/slices/messaging/grpc/messaging_handler.rb`

**Monolith bin/grpc (1 modify):**
- `services/monolith/workspace/bin/grpc` (proto stub require + handler require、3 行追加)

**Plan (1 new):**
- `docs/superpowers/plans/2026-06-17-messaging-m1-unary.md`

合計 ~22 file (+ structure.sql 自動更新)。

---

## Task 1: proto `messaging.v1`

**Files:** Create `proto/messaging/v1/messaging_service.proto`。

- [ ] **Step 1: 実装**

spec の API contract 節そのままコピー。重要要素は:
- `service MessagingService` 全 8 RPC (7 unary + 1 server-streaming `StreamEvents`)
- `enum` なし、`oneof payload` で Event のバリアント表現
- import `google/protobuf/timestamp.proto` + `profile/v1/service.proto`

(完全な proto code は spec を参照、または下記)

```proto
syntax = "proto3";
package messaging.v1;

import "google/protobuf/timestamp.proto";
import "profile/v1/service.proto";

service MessagingService {
  rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
  rpc ListThreads(ListThreadsRequest) returns (ListThreadsResponse);
  rpc GetOrCreateThread(GetOrCreateThreadRequest) returns (GetOrCreateThreadResponse);
  rpc ListMessages(ListMessagesRequest) returns (ListMessagesResponse);
  rpc MarkRead(MarkReadRequest) returns (MarkReadResponse);
  rpc GetTotalUnreadCount(GetTotalUnreadCountRequest) returns (GetTotalUnreadCountResponse);
  rpc SendTyping(SendTypingRequest) returns (SendTypingResponse);
  rpc StreamEvents(StreamEventsRequest) returns (stream Event);
}

message Message {
  string id = 1;
  string thread_id = 2;
  string sender_id = 3;
  string content = 4;
  google.protobuf.Timestamp created_at = 5;
}

message Thread {
  string id = 1;
  profile.v1.Profile counterpart = 2;
  Message last_message = 3;
  int32 unread_count = 4;
  google.protobuf.Timestamp last_message_at = 5;
}

message SendMessageRequest {
  string thread_id = 1;
  string recipient_account_id = 2;
  string content = 3;
}
message SendMessageResponse { Message message = 1; string thread_id = 2; }

message ListThreadsRequest  { int32 limit = 1; string cursor = 2; }
message ListThreadsResponse {
  repeated Thread threads = 1;
  string next_cursor = 2;
  bool has_more = 3;
  int32 total_unread_count = 4;
}

message GetOrCreateThreadRequest  { string recipient_account_id = 1; }
message GetOrCreateThreadResponse { Thread thread = 1; }

message ListMessagesRequest {
  string thread_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
message ListMessagesResponse {
  repeated Message messages = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message MarkReadRequest { string thread_id = 1; string message_id = 2; }
message MarkReadResponse {}

message GetTotalUnreadCountRequest {}
message GetTotalUnreadCountResponse { int32 count = 1; }

message SendTypingRequest { string thread_id = 1; }
message SendTypingResponse {}

message StreamEventsRequest {}

message Event {
  oneof payload {
    Message message_event = 1;
    ReadStateEvent read_state = 2;
    TypingEvent typing = 3;
  }
}

message ReadStateEvent {
  string thread_id = 1;
  string account_id = 2;
  string last_read_message_id = 3;
}

message TypingEvent {
  string thread_id = 1;
  string account_id = 2;
}
```

- [ ] **Step 2: buf lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/proto && buf lint 2>&1 | /usr/bin/tail -5
```

---

## Task 2: 両 stub 再生成

- [ ] **Step 1: frontend stub**

```bash
cd services/frontend/workspace && pnpm proto:gen 2>&1 | /usr/bin/tail -5
```

- [ ] **Step 2: monolith stub (arm64-darwin)**

```bash
cd services/monolith/workspace
bundle exec grpc_tools_ruby_protoc \
  --proto_path=../../../proto \
  --ruby_out=stubs --grpc_out=stubs \
  ../../../proto/messaging/v1/messaging_service.proto 2>&1 | /usr/bin/tail -3
```

- [ ] **Step 3: ruby -c 両 stub**

---

## Task 3: schema migration

**Files:** Create `services/monolith/workspace/config/db/migrate/20260617130000_create_messaging_schema.rb`。

- [ ] **Step 1: 実装**

spec の Schema 節を Sequel::Migration に翻訳。重要:
- `account_a < account_b` CHECK 制約
- UNIQUE `(account_a, account_b)` on threads
- index on messages `(thread_id, created_at DESC, id DESC)`
- read_states の composite PK

```ruby
ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS messaging"

    create_table :"messaging__threads" do
      column :id, :uuid, null: false
      column :account_a, :uuid, null: false
      column :account_b, :uuid, null: false
      column :last_message_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      primary_key [:id]
      unique [:account_a, :account_b], name: :uq_threads_account_pair
      constraint :chk_threads_account_order, "account_a < account_b"
    end
    run "CREATE INDEX idx_threads_a_last ON messaging.threads (account_a, last_message_at DESC)"
    run "CREATE INDEX idx_threads_b_last ON messaging.threads (account_b, last_message_at DESC)"

    create_table :"messaging__messages" do
      column :id, :uuid, null: false
      column :thread_id, :uuid, null: false
      column :sender_id, :uuid, null: false
      column :content, :text, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      primary_key [:id]
    end
    run "CREATE INDEX idx_messages_thread_created ON messaging.messages (thread_id, created_at DESC, id DESC)"

    create_table :"messaging__read_states" do
      column :thread_id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :last_read_message_id, :uuid
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")
      primary_key [:thread_id, :account_id]
    end
  end

  down do
    drop_table :"messaging__read_states"
    drop_table :"messaging__messages"
    drop_table :"messaging__threads"
    run "DROP SCHEMA IF EXISTS messaging CASCADE"
  end
end
```

- [ ] **Step 2: ruby -c + 実行 + structure.sql 再 dump**

```bash
ruby -c config/db/migrate/20260617130000_create_messaging_schema.rb
bundle exec hanami db migrate 2>&1 | /usr/bin/tail -5
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec hanami db structure dump 2>&1 | /usr/bin/tail -3
```

---

## Task 4: slice scaffold + relations + repository

### Task 4.1: slice base

`slices/messaging/config/slice.rb` + `db/repo.rb` + `db/relation.rb` — discovery D1 / bookmarks B1 と同形。

### Task 4.2: 3 relations (`thread_records` / `message_records` / `read_state_records` alias)

`slices/messaging/relations/threads.rb`:
```ruby
module Messaging
  module Relations
    class Threads < Messaging::DB::Relation
      schema(:"messaging__threads", as: :thread_records, infer: false) do
        attribute :id, Types::String
        attribute :account_a, Types::String
        attribute :account_b, Types::String
        attribute :last_message_at, Types::Time.optional
        attribute :created_at, Types::Time
        primary_key :id
      end
    end
  end
end
```

`messages.rb` (alias `:message_records`)、`read_states.rb` (alias `:read_state_records`、composite PK `[:thread_id, :account_id]`)。

### Task 4.3: `MessagingRepository`

3 表まとめて 1 repository に。主要 method:
- `find_thread(id:)`
- `find_thread_by_pair(account_a:, account_b:)` (sort 内部で実施 = caller が `[viewer, recipient].sort` で渡す)
- `upsert_thread(account_a:, account_b:)` — `ON CONFLICT (account_a, account_b) DO UPDATE` (last_message_at update 用 stub)
- `list_threads(account_id:, limit:, cursor:)` — `account_a = X OR account_b = X` で union、order by last_message_at desc
- `insert_message(id:, thread_id:, sender_id:, content:)` + `update_thread_last_message_at(thread_id:, time:)` (両方を transaction で 1 use_case 内)
- `list_messages(thread_id:, limit:, cursor:)` — order by created_at desc, id desc
- `upsert_read_state(thread_id:, account_id:, last_read_message_id:)` — `ON CONFLICT (thread_id, account_id) DO UPDATE`
- `find_read_state(thread_id:, account_id:)`
- `unread_count(thread_id:, account_id:, since_message_id: nil)` — `messages.thread_id = X AND sender_id != viewer AND id > since` count
- `total_unread_count(account_id:)` — sum 全 thread の unread (簡易: thread 列挙 + 各 unread を計算 / SQL 1 本で大物化)

実装は plan 内で 1 つずつ完全 code 提示 (省略はしない、ただし長いため別タスクで分解)。

- [ ] **Step**: 4 file Syntax check (`config/slice`, `db/{repo,relation}`, `relations/*`, `repositories/messaging_repository.rb`)

---

## Task 5: 7 unary use_cases

各 use_case の完全 code は本 plan の長さ制約で要約のみ提示、実装時は spec の API contract + 下記要点で書く。

### `SendMessage`

```ruby
class SendMessage
  include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

  def call(sender_id:, content:, thread_id: nil, recipient_account_id: nil)
    # 1. resolve recipient: thread_id 指定なら thread.account_a/b から判定、無ければ recipient_account_id を直接使用
    # 2. validate: sender != recipient、mutual followers (両方向 approved)、not bidirectionally blocked
    # 3. get_or_create thread (account_a, account_b normalized sort)
    # 4. INSERT message (uuid_v7) + UPDATE thread.last_message_at = now()
    # 5. NOTIFY messaging_user_<sender> + messaging_user_<recipient> with serialized message
    # 6. return { message: row, thread_id: }
  end

  private

  def social_follow_repo
    @social_follow_repo ||= Social::Slice["repositories.follow_repository"]
  end

  def social_block_repo
    @social_block_repo ||= Social::Slice["repositories.block_repository"]
  end

  def mutual_followers?(a, b)
    s1 = social_follow_repo.find(follower_id: a, followee_id: b)
    s2 = social_follow_repo.find(follower_id: b, followee_id: a)
    s1 && s1.status == "approved" && s2 && s2.status == "approved"
  end

  def bidirectionally_blocked?(a, b)
    social_block_repo.blocked?(blocker_id: a, blocked_id: b) ||
      social_block_repo.blocked?(blocker_id: b, blocked_id: a)
  end

  def notify(recipient_id, type:, data:)
    db = messaging_repo.send(:thread_records).dataset.db  # or pass db via repo accessor
    payload = { type: type, data: data }.to_json
    db.notify("messaging_user_#{recipient_id}", payload: payload)
  end
end
```

実装時の error class:
- `SelfMessageError`、`NotFollowedError`、`BlockedError`、`ThreadNotFoundError` 等を define
- handler 側で各 error を gRPC status に mapping

### `ListThreads`

- `messaging_repo.list_threads(account_id: viewer, limit:, cursor:)` で row 配列
- 各 row の counterpart = (account_a / account_b の viewer ではない方) を `Profile::Slice["use_cases.get_profile"]` で hydration
- 各 row の last_message = `messaging_repo.last_message(thread_id:)` で fetch
- 各 row の unread_count = `messaging_repo.unread_count(thread_id:, account_id: viewer, since_message_id: read_state.last_read_message_id)`
- total_unread_count = `messaging_repo.total_unread_count(account_id: viewer)`
- 返り Hash `{ threads: [...], next_cursor:, has_more:, total_unread_count: }`

### `GetOrCreateThread`

- `recipient_account_id` を受け取り、followers 相互 + not blocked validate
- `messaging_repo.upsert_thread(account_a:, account_b:)` で取得 (sort で a < b)
- counterpart profile + last_message + unread を addon

### `ListMessages`

- `messaging_repo.find_thread(id:)` で thread 取得、viewer が account_a / b のどちらかでないなら `ForbiddenError`
- `messaging_repo.list_messages(thread_id:, limit:, cursor:)` で row、降順
- 返り Hash

### `MarkRead`

- `messaging_repo.upsert_read_state(thread_id:, account_id: viewer, last_read_message_id:)`
- counterpart に NOTIFY `messaging_user_<counterpart_id>` with `{type: "read_state", data: {...}}`

### `GetTotalUnreadCount`

- `messaging_repo.total_unread_count(account_id: viewer)` で int 返却

### `SendTyping`

- `messaging_repo.find_thread(id:)` で counterpart 解決
- DB 書込みなし、counterpart に NOTIFY `messaging_user_<counterpart_id>` with `{type: "typing", data: {thread_id:, account_id: viewer}}`

---

## Task 6: handler base + MessagingHandler (StreamEvents stub)

```ruby
module Messaging
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include ::Concerns::CursorPagination
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]
    end
  end
end
```

```ruby
require "messaging/v1/messaging_service_services_pb"
require_relative "handler"

module Messaging
  module Grpc
    class MessagingHandler < Handler
      bind ::Messaging::V1::MessagingService::Service
      self.rpc_descs.clear
      rpc :SendMessage, ..., ::Messaging::V1::SendMessageResponse
      # ... 全 8 RPC ...

      include Messaging::Deps[
        send_message_uc: "use_cases.send_message",
        list_threads_uc: "use_cases.list_threads",
        get_or_create_thread_uc: "use_cases.get_or_create_thread",
        list_messages_uc: "use_cases.list_messages",
        mark_read_uc: "use_cases.mark_read",
        get_total_unread_count_uc: "use_cases.get_total_unread_count",
        send_typing_uc: "use_cases.send_typing"
      ]

      # 各 unary method 実装、error → GRPC::BadStatus mapping
      def send_message
        authenticate_user!
        # ... error rescue + serialize ...
      end

      # ...

      def stream_events
        # M2 で実装、本 PR では即 return (no yields)、subscriber 不在を装う
        # gruf streaming RPC は yield なしで終了すれば空 stream として close される
      end
    end
  end
end
```

---

## Task 7: `bin/grpc` 登録

- [ ] **Step 1**: proto stub require ブロックに `require "messaging/v1/messaging_service_services_pb"` 追加 (discovery の隣)
- [ ] **Step 2**: handler require ブロックに `require_relative "../slices/messaging/grpc/handler"` + `require_relative "../slices/messaging/grpc/messaging_handler"` 追加 (discovery の隣)

---

## Task 8: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 baseline 維持。

- [ ] **Step 2: container resolve smoke**

```bash
bundle exec ruby -I stubs -I lib -e '
  require "hanami/prepare"

  %w[
    repositories.messaging_repository
    use_cases.send_message
    use_cases.list_threads
    use_cases.get_or_create_thread
    use_cases.list_messages
    use_cases.mark_read
    use_cases.get_total_unread_count
    use_cases.send_typing
  ].each { |k| puts "#{k} => #{Messaging::Slice[k].class}" }

  puts "MessagingHandler: #{Messaging::Grpc::MessagingHandler}"

  zero = "00000000-0000-0000-0000-000000000000"
  count = Messaging::Slice["use_cases.get_total_unread_count"].call(account_id: zero)
  puts "total_unread(empty): #{count.inspect}"
' 2>&1 | /usr/bin/tail -15
```

期待: 全 use_case + handler 解決、`total_unread(empty): 0`。

- [ ] **Step 3: bin/grpc 起動 smoke**

```bash
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec ruby -I stubs -I lib bin/grpc 2>&1 &
GRPC_PID=$!
sleep 8
kill $GRPC_PID 2>/dev/null
wait $GRPC_PID 2>&1 | /usr/bin/grep -E "Starting|Messaging|Services:" | /usr/bin/head -5
```

期待: `Services:` line に `Messaging::V1::MessagingService::Service` 登場。

- [ ] **Step 4: frontend tsc / build (stub のみ、consumer なし)**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -5
pnpm build 2>&1 | /usr/bin/tail -10
```

- [ ] **Step 5: diff stat**

期待: 約 23 file (proto 1 + stubs 3 + slice ~15 + bin/grpc 1 + structure.sql 1 + plan 1 + 1 migration)。

- [ ] **Step 6: commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-messaging-m1-unary
/usr/bin/git add -A proto services/monolith/workspace services/frontend/workspace docs/superpowers/plans/2026-06-17-messaging-m1-unary.md
/usr/bin/git commit -s -m "feat(messaging): proto + monolith slice (schema + repo + 7 unary use_cases + handler + NOTIFY publish, M1)"
```

push しない。

---

## Deferred

- **M2** (streaming): `StreamEvents` 本実装 (PG LISTEN/NOTIFY subscriber + gruf yield loop)
- **M3** (frontend data + SSE bridge)
- **M4** (frontend UI)

## Self-Review

- **Spec coverage (M1 範囲)**: proto 8 RPC + 3 表 + 7 unary use_case + 2 handler (StreamEvents は noop stub) + bin/grpc 登録 + NOTIFY publish in 3 use_case
- **ROM relation alias lesson**: `:thread_records` / `:message_records` / `:read_state_records` で衝突回避
- **bin/grpc lesson**: proto stub require + handler require を本 PR で同時追加
- **Cross-slice**: Social (follow + block) と Profile (counterpart hydration) のみ、emit 系なし
- **NOTIFY**: `db.notify(channel, payload:)` で全 publish 実装、M2 で listener が来ても backwards compatible
- **Error mapping**: SendMessage の各 validate error は use_case 内 raise + handler 内 rescue で gRPC status に
- **検証**: rspec baseline + container smoke + bin/grpc 起動 smoke
