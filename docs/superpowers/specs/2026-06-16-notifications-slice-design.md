# Notifications Slice Design — inbox + polling-based push for social/post events

Date: 2026-06-16
Status: Design spec (implementation-ready)
Scope: 「周辺」スライス第 1 弾。social/post の 5 種イベント (like / comment / reply / follow_request / follow_approved) を受け取る inbox を新規 `notifications` スライスで設計、frontend に `/notifications` ページ + bell badge を追加する。Realtime は polling MVP、event aggregation は 1 行集約 (group key = `(recipient, type, target_resource_id)`)。

Related:
- `2026-05-31-domain-context-map-design.md` (keep/transform 7 + new 4。notifications は new 4 の第 1 弾)
- `2026-06-15-social-slice-design.md` (follow / approve は本 spec の発火元)
- `2026-06-07-posts-slice-design.md` (like / comment は同上)

## Goal

social と post の inbound エンゲージメント (誰かが自分の post に like / comment した、誰かがフォロー申請してきた等) を、新 `notifications` スライス + `notifications.notifications` 1 表に集約格納し、frontend で inbox + bell badge として可視化する。realtime push は **polling (SWR refreshInterval: 30s)** で実装、true streaming は messaging slice 着手時にまとめて設計する。

## Grounding

- 旧コードベースに通知の概念は存在しない (Phase 1a で presentation 一掃済)。新規 greenfield。
- 既存 `social.v1` + `post.v1` の use_case 群は cross-slice 呼出を確立済 (`Profile::Slice[...]`、`Social::Slice[...]` 等)。fire-and-forget の event emit にこのパターンを流用。
- フロントエンドの shell は Phase 1b 未着手 = sidebar 不在。bell badge は当面 `/u/[username]` (viewer == owner 時のみ表示) を surface とし、shell rebuild 時に nav へ移管する。

## Decisions (brainstorming 確定済)

| 項目 | 決定 |
|---|---|
| v1 体験 | Inbox + Push (DB 永続 + 未読 / 既読 + cursor 一覧) |
| 通知 trigger | social: follow_request / follow_approved、post: like / comment / reply (= 5 種) |
| Realtime delivery | Polling MVP (SWR `refreshInterval: 30000`)、streaming は messaging で再検討 |
| Aggregation | 1 行集約 (group key = `(recipient, type, target_resource_id)`)、`latest_actor` + `actor_count` のみ保持 |
| Bell badge 位置 | `/u/[username]` の viewer==owner 時のみ。shell 完成後 nav へ移管 |
| Mark all read / per-trigger mute | v1 では drop、別 PR |

## Domain model

### Schema

新 PostgreSQL schema `notifications`、1 表:

```sql
CREATE SCHEMA notifications;

CREATE TABLE notifications.notifications (
  id                  uuid        NOT NULL,
  recipient_id        uuid        NOT NULL,
  type                text        NOT NULL,  -- enum-mapped (see below)
  target_resource_id  uuid        NOT NULL,
  actor_count         int         NOT NULL DEFAULT 1,
  latest_actor_id     uuid        NOT NULL,
  latest_event_at     timestamptz NOT NULL DEFAULT now(),
  read_at             timestamptz,           -- NULL = unread
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (recipient_id, type, target_resource_id)
);

CREATE INDEX idx_notifications_recipient_latest
  ON notifications.notifications (recipient_id, latest_event_at DESC);

CREATE INDEX idx_notifications_recipient_unread
  ON notifications.notifications (recipient_id) WHERE read_at IS NULL;
```

### `target_resource_id` の意味は type 依存

| type | target_resource_id | aggregate 単位 |
|---|---|---|
| `like` | `post_id` | post 単位で集約 (「A さん他 3 人が like」) |
| `comment` | `post_id` | 同上 |
| `reply` | `parent_comment_id` | 親コメント単位で集約 |
| `follow_request` | `actor_account_id` | 集約せず (1 follower = 1 行) |
| `follow_approved` | `actor_account_id` | 同上 (1 approver = 1 行) |

→ `UNIQUE (recipient_id, type, target_resource_id)` で follow_* は自然と 1 行になる (target = actor)。like/comment は post 単位で `ON CONFLICT DO UPDATE` で集約成長。

### Aggregation upsert (核心 query)

```sql
INSERT INTO notifications.notifications
  (id, recipient_id, type, target_resource_id, latest_actor_id, latest_event_at)
VALUES
  (gen_random_uuid(), $recipient, $type, $target, $actor, now())
ON CONFLICT (recipient_id, type, target_resource_id) DO UPDATE SET
  actor_count = notifications.notifications.actor_count + 1,
  latest_actor_id = EXCLUDED.latest_actor_id,
  latest_event_at = EXCLUDED.latest_event_at,
  read_at = NULL;  -- 新アクティビティで unread に戻す
```

UX 表示則 (frontend):
- `actor_count == 1` → "A さんが like しました"
- `actor_count > 1` → "A さん他 {actor_count - 1} 人が like しました"

### Suppression rules (emit 側で適用)

1. `actor_id == recipient_id` → skip (自分のアクションは通知しない)
2. `Social::Slice["repositories.block_repository"].blocked?(blocker_id: recipient, blocked_id: actor)` → skip (recipient が actor を block 済)

(mute / per-trigger off は v1 では未実装)

### Event 発火元 (cross-slice)

全て **fire-and-forget**: source 側 use_case の正常完了後に `Notifications::Slice["use_cases.emit"].call(...)` を呼ぶ。失敗しても source action は成功扱い (rescue + log 出力のみ)。

| 発火元 use_case | type | recipient | target_resource_id | actor |
|---|---|---|---|---|
| `Post::UseCases::Likes::LikePost` | `like` | `post.author_id` | `post.id` | `liker_id` |
| `Post::UseCases::Comments::AddComment` (top level) | `comment` | `post.author_id` | `post.id` | `commenter_id` |
| `Post::UseCases::Comments::AddComment` (reply) | `reply` | `parent_comment.author_id` | `parent_comment_id` | `replier_id` |
| `Social::UseCases::Follows::Follow` | `follow_request` if target is_private<br>`follow_approved` if public | `target_account_id` | `follower_id` (= actor) | `follower_id` |
| `Social::UseCases::Follows::ApproveFollowRequest` | `follow_approved` | `requester_account_id` | `approver_id` (= actor) | `approver_id` |

## API contract — `notifications.v1`

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
  string target_resource_id = 3;            // post_id / comment_id / actor_account_id (per type)
  int32 actor_count = 4;                    // >= 1
  profile.v1.Profile latest_actor = 5;       // cross-slice hydration (via Profile::Slice)
  google.protobuf.Timestamp latest_event_at = 6;
  google.protobuf.Timestamp read_at = 7;     // unset = unread
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

- `latest_actor` は `Profile::Slice["use_cases.get_profile"]` で hydration、社会 list 系と同じ pattern
- `target_resource_id` は string で送る (proto は uuid 型を持たないため bytes/string)、frontend で必要に応じて type 別 lookup
- pagination は cursor (base64 `latest_event_at,id`) の既存 pattern を踏襲

## Monolith notifications slice

- **schema migration**: `20260616240000_create_notifications_schema.rb` (新 schema + table + 2 index)
- **slice base**: `Notifications::DB::Repo`、`Notifications::DB::Relation`、container 構成は既存 social slice と同形
- **relations / repository**:
  - `Notifications::Relations::Notifications`
  - `Notifications::Repositories::NotificationRepository`:
    - `emit(recipient_id:, type:, target_resource_id:, actor_id:)` (idempotent upsert)
    - `list(recipient_id:, limit:, cursor:)`
    - `count_unread(recipient_id:)`
    - `mark_read(id:, recipient_id:)` (recipient 一致確認込み、cross-account 操作防止)
- **use_cases**:
  - `Notifications::UseCases::Emit` (suppression rules + repo.emit、fire-and-forget caller 想定で `rescue StandardError => e; log; nil`)
  - `Notifications::UseCases::ListNotifications` (hydration: profile.v1.Profile を `Profile::Slice` 経由で latest_actor に詰める + bundled unread_count)
  - `Notifications::UseCases::GetUnreadCount`
  - `Notifications::UseCases::MarkRead`
- **handler**: `Notifications::Grpc::Handler` (base) + `Notifications::Grpc::NotificationHandler` (3 RPC binding + method)
- **bin/grpc 登録** (S2b の hidden bug を踏まないよう plan に明示):
  - `require "notifications/v1/notification_service_services_pb"`
  - `require_relative "../slices/notifications/grpc/handler"`
  - `require_relative "../slices/notifications/grpc/notification_handler"`
- **cross-slice emit hooks** (本 spec で監修、実装は N3 plan で):
  - `Post::UseCases::Likes::LikePost` の正常完了後
  - `Post::UseCases::Comments::AddComment` の正常完了後 (parent_id 有無で type 振り分け)
  - `Social::UseCases::Follows::Follow` の正常完了後 (resulting status で type 振り分け)
  - `Social::UseCases::Follows::ApproveFollowRequest` の正常完了後

emit hook 配置原則: source use_case の return 直前で `Notifications::Slice["use_cases.emit"].call(...)` を呼ぶ、エラーは rescue で 飲み込み。source の transaction には参加させない (failure isolation)。

## Frontend

- **data 層** (`src/modules/notifications`):
  - `types.ts`: `NotificationType` literal union、`NotificationView`、`PaginatedNotificationsResponse`
  - `lib/mappers.ts`: proto → view 変換 (type enum → literal、profile → SocialAccountView 流用 or 同形)
  - `hooks/`:
    - `useNotifications()`: useSWRInfinite list + mark-read action + bundled unread_count
    - `useUnreadCount()`: useSWR `refreshInterval: 30000`
- **BFFs** (`src/app/api/notifications/`):
  - `GET /api/notifications?limit=20&cursor=...` → `ListNotifications`
  - `GET /api/notifications/unread-count` → `GetUnreadCount`
  - `POST /api/notifications/[id]/read` → `MarkRead`
- **UI**:
  - 新 page: `/notifications` (cursor list、行内 `actor_count` 集約表示、行 click で `/notifications/[id]/read` POST + 該当 target へ navigate)
  - 新 component: `NotificationBell` (count badge、`/u/[username]` で `viewer == owner` 時にのみ render、click で `/notifications` へ)
  - `/dev/ui` に mock セクション追加
- **stub**: `src/stub/notifications/v1/notification_service_pb.ts` (生成済、buf gen で社会同様 churn 0)
- **client**: `src/lib/grpc.ts` に `notificationClient` 追加

## Cross-slice contracts

```ruby
Notifications::Slice["use_cases.emit"]
  # call(recipient_id:, type:, target_resource_id:, actor_id:) → nil
  # fire-and-forget。caller 側で rescue 不要 (内部で rescue + log)
```

## Decomposition (N1〜N5、合計 5 PR)

- **N0** (本 spec、commit + self-review + user 確認)
- **N1**: proto `notifications.v1` + monolith slice scaffold (schema migration / relations / repository / `bin/grpc` 登録)。両 stub 生成 (social 同様 churn 0)。use_case 未実装でも build-green。
- **N2**: monolith use_cases (Emit / List / Count / MarkRead) + handler 実装。container smoke で 4 use_case + handler 解決、bin/grpc 起動確認。rspec baseline 維持。
- **N3**: cross-slice emit hook 追加 (Post::Likes / Post::Comments / Social::Follow / Social::ApproveFollowRequest)。実 DB に notification row が積まれることを smoke 確認。
- **N4**: frontend data 層 (types + mappers + 2 hook + 3 BFF route + `src/lib/grpc.ts` 追記)
- **N5**: frontend UI (`NotificationBell` + `/notifications` page + `/dev/ui` mock)

各 PR は build-green / additive / auto-merge 運用 (本セッションで定着)。

## Deferred / out of scope

- **mark all as read** → 別 PR
- **per-trigger mute / preferences (settings)** → 別 PR
- **digest メール / 週次サマリー** → 別ドメイン (email infra 込みで別 spec)
- **realtime streaming push (gRPC streaming + SSE)** → messaging slice 着手時にまとめて設計
- **shell rebuild (sidebar / nav)** → Phase 1b の継続作業、bell badge を nav へ移管するのはその後
- **mention 通知** → posts spec に @username parser 拡張が必要、別 PR
- **DM 通知** → messaging slice
- **karte 通知** → karte slice (法務 hard gate)
- **target_resource preview (post 本文 / comment 本文の埋め込み表示)** → list が重くなるため defer、frontend は target_resource_id から別 fetch

## Verification

- **N1 proto**: `buf lint proto` 致命傷無し / monolith `ruby -c stubs/notifications/v1/*.rb` / frontend `pnpm exec tsc --noEmit` + `pnpm build`
- **N2 monolith**: `bundle exec rspec spec/slices/{post,profile}` baseline 維持、container smoke で 4 use_case 解決、`bin/grpc` 起動で `Gruf.services` リストに `Notifications::Grpc::NotificationHandler` 登場
- **N3 cross-slice**: rspec baseline 維持、実 DB で `LikePost` → notification row insert を smoke 確認
- **N4 frontend data**: `pnpm exec tsc --noEmit` 緑、`pnpm build` 緑、`pnpm lint` baseline 同等、新 BFFs が route 一覧に登場
- **N5 frontend UI**: tsc/build/lint 緑 + `/dev/ui` 視覚確認 + 可能なら local e2e

全 PR additive / build-green / auto-merge 運用。
