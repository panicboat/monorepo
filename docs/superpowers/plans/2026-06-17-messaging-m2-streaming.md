# Messaging M2: StreamEvents server-streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M1 (#711) で stub のまま残った `MessagingHandler#stream_events` を **PG LISTEN/NOTIFY subscriber loop** で実装。M1 で publish 側 (`db.notify`) は完成済、本 PR で listen side を完成して realtime delivery を end-to-end で動かす。

**Architecture:** gruf server-streaming RPC は handler method 内で `yield response` で送信。PG 接続を pool から取得 (`db.synchronize do |conn|`)、`LISTEN messaging_user_<viewer_id>` を発行、`conn.wait_for_notify(timeout)` で waiting + payload 受信、JSON parse → proto Event 構築 → yield。client disconnect で yield が raise、`ensure` で UNLISTEN + connection 返却。

**Tech Stack:** Ruby / Sequel PG adapter (`wait_for_notify`) / gruf server-streaming / Hanami logger。

**Spec:** `docs/superpowers/specs/2026-06-17-messaging-slice-design.md` Streaming infra 節。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-messaging-m2-streaming`、branch `feat/messaging-m2-streaming` (origin/main = `43485b39`、M1 #711 マージ後)。**push しない**。
- 触らない: M1 で作った use_case / repo / handler の other method、proto、frontend、bin/grpc (handler 既に bound 済)。

### 既存 NOTIFY publish 確認済

M1 (#711) で SendMessage / MarkRead / SendTyping 内で:
- `db.notify("messaging_user_<recipient_id>", payload: <json>)` を実行
- payload JSON: `{"type": "message" | "read_state" | "typing", "data": {<field-by-field>}}`
- message: `{id, thread_id, sender_id, content, created_at (ISO8601)}`
- read_state: `{thread_id, account_id, last_read_message_id}`
- typing: `{thread_id, account_id}`

### gruf streaming RPC mechanics

- handler method 内で `yield <proto Response>` 1 回ごとに client へ 1 message 送信
- client disconnect → 次回 yield で gRPC error raise (GRPC::Cancelled 系)
- ensure block で cleanup

### PG `wait_for_notify` API

- Sequel の PG adapter で `conn.async_exec("LISTEN <channel>")` 発行
- `conn.wait_for_notify(timeout) do |chan, pid, payload| ... end` で payload 受信
- timeout 内に no payload なら block 未呼出 + return nil
- `conn` は `db.synchronize { |conn| ... }` で pool から取得 (block 終了で返却)

### Disconnect detection (MVP 限界)

- gruf に直接の "cancelled?" 検出 API は提供されていない (request.active_call.peer_cert 等にアクセス可だが cancellation flag は隠蔽)
- 本 PR の MVP では yield 自体が raise するのを利用 (event 来ない → 検出遅れる、worst case で client 死亡から数時間 PG connection 保持)
- 改善余地: 定期 keepalive event (proto Event に heartbeat variant 追加が必要)、別 PR で対応

## File Structure

**Modify (1 file):**
- `services/monolith/workspace/slices/messaging/grpc/messaging_handler.rb` (stream_events を本実装に置換 + 2 private helper 追加)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-17-messaging-m2-streaming.md`

合計 **2 file**。

---

## Task 1: `stream_events` を本実装に置換

**Files:** Modify `services/monolith/workspace/slices/messaging/grpc/messaging_handler.rb`。

### 旧 (M1 stub、line 169 付近)

```ruby
# Noop stub. M2 will replace this with a PG LISTEN loop that yields
# proto Event messages. Returning without yielding closes the stream cleanly
# — clients reconnect on EOF.
def stream_events
  # intentionally empty for M1
end
```

### 新

```ruby
require "json"

# Server-streaming RPC. Subscribes to PG LISTEN/NOTIFY channel
# `messaging_user_<viewer_id>` (published by M1's SendMessage/MarkRead/SendTyping)
# and yields proto Event messages to the client.
#
# Loop exits when:
#   - client disconnects (yield raises GRPC error)
#   - the conn is closed by PG side
#
# UNLISTEN + connection return-to-pool always run via ensure block.
def stream_events
  authenticate_user!
  viewer = current_user_id
  channel = "messaging_user_#{viewer}"

  db = messaging_repo.send(:thread_records).dataset.db

  db.synchronize do |conn|
    quoted_channel = conn.escape_identifier(channel)
    conn.async_exec("LISTEN #{quoted_channel}")
    begin
      loop do
        conn.wait_for_notify(0.5) do |_chan, _pid, payload|
          event = parse_payload_to_event(payload)
          yield event if event
        end
      end
    ensure
      begin
        conn.async_exec("UNLISTEN #{quoted_channel}")
      rescue StandardError
        # connection may already be in error state, ignore
      end
    end
  end
end

private

# Parse JSON payload produced by M1's NOTIFY senders and build proto Event.
# Returns nil for unknown types or malformed payloads (silently drop bad payloads).
def parse_payload_to_event(payload)
  return nil if payload.nil? || payload.empty?

  parsed = JSON.parse(payload)
  data = parsed["data"] || {}

  case parsed["type"]
  when "message"
    msg = ::Messaging::V1::Message.new(
      id: data["id"].to_s,
      thread_id: data["thread_id"].to_s,
      sender_id: data["sender_id"].to_s,
      content: data["content"].to_s,
      created_at: parse_iso8601_timestamp(data["created_at"])
    )
    ::Messaging::V1::Event.new(message_event: msg)
  when "read_state"
    rs = ::Messaging::V1::ReadStateEvent.new(
      thread_id: data["thread_id"].to_s,
      account_id: data["account_id"].to_s,
      last_read_message_id: data["last_read_message_id"].to_s
    )
    ::Messaging::V1::Event.new(read_state: rs)
  when "typing"
    typing = ::Messaging::V1::TypingEvent.new(
      thread_id: data["thread_id"].to_s,
      account_id: data["account_id"].to_s
    )
    ::Messaging::V1::Event.new(typing: typing)
  end
rescue JSON::ParserError, ArgumentError => e
  Hanami.logger.warn("Messaging::StreamEvents bad payload: #{e.class}: #{e.message}")
  nil
end

def parse_iso8601_timestamp(s)
  return nil if s.nil? || s.empty?
  t = Time.iso8601(s)
  Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: t.nsec || 0)
rescue ArgumentError
  nil
end
```

- [ ] **Step 1: 既存 stub method 全体を上記新版に置換**

- [ ] **Step 2: `require "json"` を file 先頭に追加** (既存 `require` ブロックに 1 行追加、既に require 済の可能性あり、未確認なら追加)

- [ ] **Step 3: `private` の位置確認**

新コードは `def stream_events` + `private` + 2 helper の形。既存 file の `private` 配下に他の helper (例: `build_message_proto`、`build_thread_proto` 等) があるので、新 helper はそれらの隣に並べる (重複 `private` 宣言は無害だが、整理として 1 block にまとめる)。

- [ ] **Step 4: Syntax check**

```bash
cd services/monolith/workspace && ruby -c slices/messaging/grpc/messaging_handler.rb
```

---

## Task 2: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 baseline 維持。

- [ ] **Step 2: container resolve smoke (handler load + method exist)**

```bash
bundle exec ruby -I stubs -I lib -e '
  require "hanami/prepare"

  klass = Messaging::Grpc::MessagingHandler
  puts "Handler: #{klass}"
  puts "stream_events method: #{klass.instance_method(:stream_events).source_location.inspect}"
  puts "parse_payload_to_event method: #{klass.instance_method(:parse_payload_to_event).source_location.inspect}"
' 2>&1 | /usr/bin/tail -5
```

期待: 全 method 解決、source_location が本 file を指す。

- [ ] **Step 3: end-to-end streaming smoke**

同 process で publisher + subscriber を実行し、event 受信を実証する:

```bash
bundle exec ruby -I stubs -I lib -e '
  require "hanami/prepare"
  require "json"

  # repo の db handle 取得
  repo = Messaging::Slice["repositories.messaging_repository"]
  db = repo.send(:thread_records).dataset.db

  viewer = "00000000-0000-0000-0000-000000000000"
  channel = "messaging_user_#{viewer}"

  received = []
  publisher_thread = Thread.new do
    sleep 0.3
    # 3 種の event を publish
    db.notify(channel, payload: { type: "message", data: { id: "11111111-...", thread_id: "22222222-...", sender_id: "33333333-...", content: "hello", created_at: Time.now.iso8601 } }.to_json)
    db.notify(channel, payload: { type: "read_state", data: { thread_id: "22222222-...", account_id: "44444444-...", last_read_message_id: "55555555-..." } }.to_json)
    db.notify(channel, payload: { type: "typing", data: { thread_id: "22222222-...", account_id: "44444444-..." } }.to_json)
  end

  # subscriber side: 同じ db pool から conn 取得して LISTEN
  db.synchronize do |conn|
    conn.async_exec("LISTEN #{conn.escape_identifier(channel)}")
    deadline = Time.now + 3
    while Time.now < deadline && received.size < 3
      conn.wait_for_notify(0.5) do |_c, _p, payload|
        received << JSON.parse(payload)["type"]
      end
    end
    conn.async_exec("UNLISTEN #{conn.escape_identifier(channel)}")
  end

  publisher_thread.join
  puts "received types: #{received.inspect}"
' 2>&1 | /usr/bin/tail -5
```

期待: `received types: ["message", "read_state", "typing"]` (publisher が NOTIFY を流し、subscriber が同 channel で wait_for_notify 経由で受信)。

> **Note**: 同一 process / 同一 db pool 内で publisher と subscriber を動かすため、`db.synchronize` で取得した connection が 1 つの場合は publish と subscribe の両方が直列化される可能性あり。pool size が 1 だと wait が timeout、size 2+ なら問題なく動作。実装時に pool size 確認 + size 不足なら publish を別 connection (`db.disconnect; db.connect ...`) で実施する選択肢あり。**最重要は parse_payload_to_event の動作確認**、上記 smoke が pool 都合で fail しても handler 自体の logic は parse helper 単体テストで検証可。

- [ ] **Step 4: bin/grpc 起動 smoke (service 登録維持)**

```bash
PATH=/opt/homebrew/Cellar/postgresql@18/18.4/bin:$PATH bundle exec ruby -I stubs -I lib bin/grpc 2>&1 &
GRPC_PID=$!
sleep 8
kill $GRPC_PID 2>/dev/null
wait $GRPC_PID 2>&1 | /usr/bin/grep -E "Starting|Messaging|Services:" | /usr/bin/head -5
```

期待: M1 と同じく `Messaging::V1::MessagingService::Service` 登場、handler 編集で service binding が壊れていないこと。

- [ ] **Step 5: diff stat + commit**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-17-messaging-m2-streaming.md
/usr/bin/git commit -s -m "feat(messaging): StreamEvents server-streaming (PG LISTEN/NOTIFY subscriber, M2)"
```

期待: 2 file (modify 1 + plan 1) のみ、Co-Authored-By 無し。

push しない。

---

## Deferred

- **Keepalive / heartbeat event**: proto Event に heartbeat variant 追加 + 定期送信、別 PR (現状は client disconnect 検出が events 待ち)
- **Connection pool sizing**: long-running LISTEN がプール枯渇する可能性 (1 viewer = 1 connection)、production scale 時に dedicated pool / Redis pub/sub への移行で対応
- **M3** (frontend data + SSE bridge)
- **M4** (frontend UI)

## Self-Review

- **Spec coverage (M2 範囲)**: `StreamEvents` server-streaming 本実装、3 event type の parse + proto 構築
- **Placeholder 無し**: 全 code 完全列挙、helper 2 個も完全
- **既存 publish との整合**: M1 の payload format (`{type, data}`) を decode 側で完全踏襲、type 文字列 ("message" / "read_state" / "typing") と data field 名一致
- **Cleanup**: yield raise (client disconnect) で `ensure` UNLISTEN + connection 返却、PG pool exhaustion 軽減
- **Bad payload tolerance**: JSON parse error + unknown type は silently drop + warn log、connection は維持
- **検証**: rspec baseline + handler resolve smoke + end-to-end pub/sub smoke + bin/grpc 起動 smoke
