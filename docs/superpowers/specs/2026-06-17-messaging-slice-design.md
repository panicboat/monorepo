# Messaging Slice Design — 1-on-1 DM + streaming events (PG LISTEN/NOTIFY pub/sub + SSE bridge)

Date: 2026-06-17
Status: Design spec (implementation-ready)
Scope: 「周辺」スライス第 4 弾。followers 同士の 1-on-1 DM を新スライス `messaging` で実装。realtime delivery を **PostgreSQL LISTEN/NOTIFY** + gRPC server-streaming + Next.js BFF SSE bridge で実現。read indicator + typing indicator + thread inbox + unread badge を v1 で揃える。

Related:
- `2026-05-31-domain-context-map-design.md` (keep/transform 7 + new 4。messaging は new 4 の最後)
- `2026-06-15-social-slice-design.md` (followers 相互判定 / block check の cross-slice 利用)
- `2026-06-16-notifications-slice-design.md` (notifications で polling MVP を採用、messaging で streaming infra を立てる方針)
- `2026-06-17-app-shell-design.md` (bottom-tab メッセージ slot + drawer メッセージ slot に unread badge を載せる)

## Grounding

- `/messages` route は #699 で stub、本 spec で実装に置換。
- streaming infra は本プロダクト初導入。memory `feedback_destroy_and_recreate` 方針 + brainstorming で「PG LISTEN/NOTIFY で内部 pub/sub」を採用 (Redis 追加なし)。
- Hanami / Gruf の server-streaming RPC + Next.js App Router の `ReadableStream` SSE response を組み合わせ。

## Goal

followers 同士で 1-on-1 DM をやり取り、新着 message / 既読 marker / typing indicator を realtime に受信、inbox で thread 一覧 + 未読件数を表示。streaming は viewer の全 thread を 1 つの `StreamEvents` server-streaming で統合受信。internal pub/sub は PG LISTEN/NOTIFY、各 message 送信時に sender / recipient 両方の channel に NOTIFY。

## Decisions (brainstorming 確定済)

| 項目 | 決定 |
|---|---|
| thread タイプ | **1-on-1 のみ** (group thread / media 添付は v2 以降) |
| 送信権限 | **相互 followers のみ** (`social.follows` を両方向で approved 確認) |
| block 判定 | 双方向 block check (`Social::BlockRepository.blocked?` 両方向) |
| self-message | 禁止 |
| delivery | **gRPC server-streaming + SSE bridge** (Next.js BFF が SSE 変換) |
| 内部 pub/sub | **PostgreSQL LISTEN/NOTIFY** (channel = `messaging_user_<account_id>`)、Redis 追加なし |
| event 種別 | `MessageEvent` (new message) / `ReadStateEvent` (read marker update) / `TypingEvent` (ephemeral) |
| typing | DB 書込みなし、Event publish のみ、client side 3s auto-expire |
| read indicator | thread × account × `last_read_message_id` を `read_states` 表に保持 |
| unread badge | bottom-tab メッセージ slot + drawer メッセージ slot に表示 (polling fallback for total unread) |
| notification 連動 | **なし** (streaming + unread badge で代替、duplicate 防止) |

## Domain model

### Schema

新 PostgreSQL schema `messaging`、3 表:

```sql
CREATE SCHEMA messaging;

-- 1-on-1 thread, account_a < account_b 正規化
CREATE TABLE messaging.threads (
  id              uuid        NOT NULL,
  account_a       uuid        NOT NULL,
  account_b       uuid        NOT NULL,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (account_a, account_b),
  CHECK (account_a < account_b)
);

CREATE INDEX idx_threads_account_a_last ON messaging.threads (account_a, last_message_at DESC);
CREATE INDEX idx_threads_account_b_last ON messaging.threads (account_b, last_message_at DESC);

CREATE TABLE messaging.messages (
  id         uuid        NOT NULL,
  thread_id  uuid        NOT NULL,
  sender_id  uuid        NOT NULL,
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_messages_thread_created ON messaging.messages (thread_id, created_at DESC, id DESC);

CREATE TABLE messaging.read_states (
  thread_id            uuid        NOT NULL,
  account_id           uuid        NOT NULL,
  last_read_message_id uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, account_id)
);
```

### Thread 正規化

`(account_a, account_b)` は常に `account_a < account_b` でソート保持。`GetOrCreateThread(recipient_account_id)` 内で `[viewer, recipient]` を sort → upsert。これで thread の一意性 (1-on-1 = 1 行) と lookup の単純化を両立。

### Suppression rules (SendMessage 内)

1. sender == recipient → reject
2. sender が recipient を block 済 or recipient が sender を block 済 → reject
3. **相互 followers** でない (どちらか一方でも `social.follows.status != 'approved'`) → reject

### Read state

- `last_read_message_id` を per (thread, account) で保持
- 未読件数 = `messages.thread_id = X AND sender_id != viewer AND id > last_read_message_id` の count (実装は created_at 比較で十分、id ordering と一致)
- 全 thread 合計未読 = `GetTotalUnreadCount()` (badge 用、polling fallback)

### Cross-slice contracts

```ruby
Social::Slice["repositories.follow_repository"]
  .find(follower_id:, followee_id:)
    # 両方向で approved status を確認 (相互 followers 判定)

Social::Slice["repositories.block_repository"]
  .blocked?(blocker_id:, blocked_id:)

Profile::Slice["use_cases.get_profile"]
  .call(account_id:)
    # thread counterpart の表示用
```

## API contract — `messaging.v1`

```proto
syntax = "proto3";
package messaging.v1;

import "google/protobuf/timestamp.proto";
import "profile/v1/service.proto";

service MessagingService {
  // Unary
  rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
  rpc ListThreads(ListThreadsRequest) returns (ListThreadsResponse);
  rpc GetOrCreateThread(GetOrCreateThreadRequest) returns (GetOrCreateThreadResponse);
  rpc ListMessages(ListMessagesRequest) returns (ListMessagesResponse);
  rpc MarkRead(MarkReadRequest) returns (MarkReadResponse);
  rpc GetTotalUnreadCount(GetTotalUnreadCountRequest) returns (GetTotalUnreadCountResponse);
  rpc SendTyping(SendTypingRequest) returns (SendTypingResponse);

  // Streaming
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
  profile.v1.Profile counterpart = 2;             // viewer 視点の相手
  Message last_message = 3;                        // unset = 空 thread
  int32 unread_count = 4;
  google.protobuf.Timestamp last_message_at = 5;
}

message SendMessageRequest {
  // thread_id 指定可、または recipient_account_id 指定で auto-create
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
  int32 limit = 2;       // default 50, max 100
  string cursor = 3;     // base64 (created_at, id) descending
}
message ListMessagesResponse {
  repeated Message messages = 1;  // 新しい順
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
    Message message_event = 1;       // 新着 message (incoming)
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

## Streaming infra

### PostgreSQL LISTEN/NOTIFY

- channel 命名: `messaging_user_<account_id>` (例: `messaging_user_11111111-...`)
- payload format: JSON 文字列 `{ "type": "message" | "read_state" | "typing", "data": {...} }`
- limit: PG NOTIFY payload は 8KB、message 本文は別途 fetch 推奨 (本 spec は payload に full content を含むので 8KB 超え心配なら content を別 fetch にする選択肢あり、v1 では小さい content 想定で full payload 採用)

### `SendMessage` flow

1. validate (mutual followers / not blocked / not self)
2. get_or_create thread
3. INSERT message + UPDATE thread.last_message_at
4. NOTIFY `messaging_user_<sender_id>` + `messaging_user_<recipient_id>` (両者 channel) with `{type: "message", data: <message>}`

### `MarkRead` flow

1. UPSERT read_states (thread_id, account_id, last_read_message_id)
2. NOTIFY `messaging_user_<counterpart_id>` with `{type: "read_state", data: <read_state>}`

### `SendTyping` flow

1. (validate thread membership)
2. NOTIFY `messaging_user_<counterpart_id>` with `{type: "typing", data: <typing>}`

### `StreamEvents` (server-streaming)

- `authenticate_user!` で viewer 確定
- gruf streaming yield loop で:
  1. PG connection 1 つ取得、`LISTEN messaging_user_<viewer_id>`
  2. loop: PG `wait_for_notify` で待機、event 来たら parse して proto Event を yield
  3. client disconnect で connection close (UNLISTEN)
- timeout / heartbeat: 30s 毎に keep-alive (no-op event or 空 Yield) 検討、v1 では PG connection の TCP keepalive に依存

### Next.js BFF SSE bridge

- `GET /api/messaging/stream` route handler
- 内部で `messagingClient.streamEvents({})` を call、async iterator から各 event を `data: <json>\n\n` SSE format で client へ write
- client は `EventSource('/api/messaging/stream')` で receive、自動再接続 + (option) exponential backoff
- close on `req.signal.aborted` (Next.js が tab close 時に signal を発火)
- response は `ReadableStream` で渡す (Next.js 16 App Router)

## Frontend

- **data 層** (`src/modules/messaging/`):
  - `types.ts`: `MessageView` / `ThreadView` / `EventPayload` 等
  - `hooks/`:
    - `useThreads()` — useSWR + `refreshInterval: 30000` (polling fallback) + streaming で realtime update
    - `useMessages(threadId)` — useSWRInfinite cursor、SSE event で先頭に prepend
    - `useTotalUnread()` — useSWR + `refreshInterval: 30000` (bottom-tab badge)
    - `useMessagingStream()` — context-level、`EventSource` で global stream、event を SWR cache に mutate
    - `useTyping(threadId)` — counterpart の typing state、`SendTyping` action 込み
- **BFFs** (`src/app/api/messaging/`):
  - `GET /api/messaging/threads` — list
  - `POST /api/messaging/threads` — get_or_create (body: `{ recipientAccountId }`)
  - `GET /api/messaging/threads/[id]/messages` — list
  - `POST /api/messaging/messages` — send (body: `{ threadId or recipientAccountId, content }`)
  - `POST /api/messaging/threads/[id]/read` — mark (body: `{ messageId }`)
  - `POST /api/messaging/threads/[id]/typing` — fire-and-forget
  - `GET /api/messaging/unread-count` — total badge
  - `GET /api/messaging/stream` — **SSE bridge**
- **UI**:
  - `/messages/page.tsx` 実装: thread inbox (avatar + counterpart name + last message preview + 時刻 + unread dot)、tap で `/messages/[id]` へ
  - `/messages/[id]/page.tsx` 新規: chat view、新→古順で render、bottom に composer、typing indicator は counterpart 側で 3s 表示
  - `MessageProvider` (root layout 内): `useMessagingStream` で全 thread の event を受信、SWR cache mutate
  - bottom-tab メッセージ slot の badge: `useTotalUnread` で取得

## Decomposition (5 PR)

- **M0** (本 spec、commit + self-review + user 確認)
- **M1**: monolith schema + relations + repository + 7 unary use_cases (Send/List/GetOrCreate/ListMessages/MarkRead/GetTotalUnreadCount/SendTyping) + handler + bin/grpc。`StreamEvents` は **method stub のみ** (実 LISTEN/NOTIFY publish は M2)、NOTIFY 呼出は SendMessage/MarkRead/SendTyping 内で実装 (subscriber 0 でも publish は問題なし)。
- **M2**: `StreamEvents` 本実装 (PG LISTEN/NOTIFY subscriber loop + gruf yield streaming) + 連動 smoke。
- **M3**: frontend data 層 + SSE bridge (types + 5 hooks + 8 BFFs + grpc.ts に messagingClient + `MessageProvider` + `/api/messaging/stream` route)。
- **M4**: frontend UI (`/messages/page.tsx` 実装 + `/messages/[id]/page.tsx` 新規 + bottom-tab badge 連動 + typing indicator UI + composer)。

各 PR build-green / additive / auto-merge 運用。M2 の streaming smoke はローカル PG で manual で確認 (LISTEN/NOTIFY behavior が test 化困難なため、container smoke で publish + 同 process LISTEN 同時実行する形に留める)。

## Deferred / out of scope

- **group thread (3 人以上)**: 別 spec、data model 大変更
- **media 添付 (画像 / video)**: media slice 連携で別 PR
- **音声 / video 通話**: 別 infra (WebRTC) で大物
- **message reactions (emoji)**: 別 PR
- **message edit / delete**: 別 PR (v1 = immutable text only)
- **thread mute / archive**: 別 PR
- **e2e encryption**: 別 spec (法務 hard gate 含む)
- **search inside DM**: 別 PR
- **block 後の thread 残骸処理**: v1 では既存 thread 保持、新 message 送信不可
- **typing 3s expire の正確な spec**: client-side timer で対応、server-side 期限は持たない
- **reconnect / missed events 再同期**: SSE reconnect 時に `ListMessages(thread_id, since=last_seen)` を SWR refresh で吸収 (本 spec の verify 範囲)

## Verification

- **M1 monolith**: rspec post 62/0 + profile 153/14 baseline 維持、container smoke で 8 use_case + handler 解決、empty path 動作、bin/grpc 起動で `Messaging::V1::MessagingService::Service` 登場
- **M2 streaming**: 同一 process で publisher (SendMessage) + subscriber (StreamEvents) を同時実行する smoke で event 受信確認
- **M3 frontend data**: tsc / build / lint baseline 維持、新 BFFs が route 一覧
- **M4 frontend UI**: tsc / build / lint 緑、`/messages` + `/messages/[id]` route 出力、bottom-tab badge 連動

全 PR additive / build-green / auto-merge 運用。
