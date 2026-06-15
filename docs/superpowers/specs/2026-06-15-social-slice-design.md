# Social Slice Design — symmetric account-based follow / block + account 鍵 follow-gate

Date: 2026-06-15
Status: Design spec (implementation-ready)
Scope: 旧 `relationship` slice (cast/guest split) を greenfield で **`social` スライス** として再構築する。symmetric account ↔ account の follow / block API + **account 鍵 (`profile.is_private`) follow-gate** (Q4/Q5 で deferred) を実装、frontend hooks / UI を新規追加する。

Related:
- `2026-05-31-domain-context-map-design.md` (keystone: `relationship` → `social` rename、`trust` → `karte` 等の ubiquitous language)
- `2026-06-02-profile-slice-design.md` (`profile.is_private` フィールド)
- `2026-06-07-posts-slice-design.md` (account 鍵 follow-gate は social の責務と defer)
- `2026-06-12-feed-slice-design.md` (同上、symmetric posts hydration への cross-slice 連携)

## Grounding

- 既存 relationship slice (main = `2d21cf02`): 14 RPCs (`FollowCast` / `UnfollowCast` / `BlockUser` / `ListBlocked` / `ListPendingFollowRequests` etc.)、proto `relationship.v1`、cast/guest 命名混在、DB `relationship.follows(cast_user_id, guest_user_id, status)` + `relationship.blocks(blocker_id, blocker_type, blocked_id, blocked_type)` (type フィールドで cast/guest split)。
- F3 (#663) で `BlockRepository#blocker_ids_of` / `FollowRepository#following_account_ids` を additive 追加済 (symmetric reads は一部既に動く)。
- `profile.is_private: Bool` は既存、frontend `PrivacySettings.tsx` で toggle UI 配備済 (Q4a/profile P5)。
- rx-sns 実物 (`.superpowers/rx-sns-render/{cast,guest}-oshi.png`): 「推し」(Oshi) page = following + followers タブ。

## Goal

旧 cast/guest split の follow/block を、**account ↔ account の対称モデル**に再構築する。`profile.is_private == true` のアカウント (鍵アカ) の post を未承認 follower から隠す follow-gate を posts/feed スライスに enforce する。`social` という新スライス・新 proto package・新 DB schema で greenfield に作り、旧 `relationship` は cleanup フェーズで一括 drop する (= destroy-and-recreate)。

## Ubiquitous language

| 旧 | 新 |
|---|---|
| `relationship` (slice / proto package) | **`social`** |
| `FollowCast` / `UnfollowCast` | **`Follow` / `Unfollow`** |
| `cast_user_id` (follow の followee) / `guest_user_id` (follower) | **`followee_id` / `follower_id`** (両 account_id) |
| `blocker_type` / `blocked_type` (cast/guest フィールド) | (drop、symmetric account_id のみ) |
| `BlockUser` / `UnblockUser` | **`Block` / `Unblock`** |
| `ListBlockedBy` (cast が blockしたguest一覧) | (drop、symmetric `ListBlocked` で十分) |
| `ApproveFollow(guestUserId)` | **`ApproveFollowRequest(requester_account_id)`** |

## Domain model (symmetric)

- **Follow**: `social.follows(follower_id, followee_id, status: 'pending'|'approved', created_at)`。account ↔ account。`UNIQUE(follower_id, followee_id)`。
  - `Follow(target)` 実行時: target の `profile.is_private` を参照し、true なら `pending` で挿入、false なら `approved` で挿入。
- **Block**: `social.blocks(blocker_id, blocked_id, created_at)`。account ↔ account。`UNIQUE(blocker_id, blocked_id)`。
- **bidirectional block**: `A.blocks B` の効果は A → B / B → A の両方に適用 (post / profile 表示で互いに非表示)。`Block` 内部 transaction で対応する `follows` レコードも DELETE (双方向 follow 解除)。
- **follow-gate**: viewer が `posts.author_id` を見える条件 =
  - `NOT (viewer ↔ author の bidirectional block)`
  - AND `(author の profile.is_private == false OR viewer ∈ author の approved followers)`
  - viewer == author 本人は常に見える (post 自身の visibility=private は posts spec 別件)

## API contract — `social.v1` (greenfield)

```proto
syntax = "proto3";
package social.v1;
import "profile/v1/service.proto";

// ---- Follow domain ----
service FollowService {
  rpc Follow(FollowRequest) returns (FollowResponse);
  rpc Unfollow(UnfollowRequest) returns (UnfollowResponse);
  rpc CancelFollowRequest(CancelFollowRequestRequest) returns (CancelFollowRequestResponse);
  rpc ApproveFollowRequest(ApproveFollowRequestRequest) returns (ApproveFollowRequestResponse);
  rpc RejectFollowRequest(RejectFollowRequestRequest) returns (RejectFollowRequestResponse);
  rpc ListFollowing(ListFollowingRequest) returns (ListFollowingResponse);
  rpc ListFollowers(ListFollowersRequest) returns (ListFollowersResponse);
  rpc ListPendingFollowRequests(ListPendingFollowRequestsRequest) returns (ListPendingFollowRequestsResponse);
  rpc GetFollowStatus(GetFollowStatusRequest) returns (GetFollowStatusResponse);
  rpc GetPendingFollowCount(GetPendingFollowCountRequest) returns (GetPendingFollowCountResponse);
}

// ---- Block domain ----
service BlockService {
  rpc Block(BlockRequest) returns (BlockResponse);
  rpc Unblock(UnblockRequest) returns (UnblockResponse);
  rpc ListBlocked(ListBlockedRequest) returns (ListBlockedResponse);
  rpc GetBlockStatus(GetBlockStatusRequest) returns (GetBlockStatusResponse);
}

enum FollowStatusValue {
  FOLLOW_STATUS_UNSPECIFIED = 0;
  FOLLOW_STATUS_NONE = 1;       // 未フォロー
  FOLLOW_STATUS_PENDING = 2;    // 承認待ち
  FOLLOW_STATUS_APPROVED = 3;   // 承認済み
}

// ---- Follow messages ----
message FollowRequest { string target_account_id = 1; }
message FollowResponse { FollowStatusValue status = 1; }

message UnfollowRequest { string target_account_id = 1; }
message UnfollowResponse {}

message CancelFollowRequestRequest { string target_account_id = 1; }
message CancelFollowRequestResponse {}

message ApproveFollowRequestRequest { string requester_account_id = 1; }
message ApproveFollowRequestResponse {}

message RejectFollowRequestRequest { string requester_account_id = 1; }
message RejectFollowRequestResponse {}

message ListFollowingRequest {
  string account_id = 1;   // 空文字 = viewer
  int32 limit = 2;         // default 20, max 50
  string cursor = 3;
}
message ListFollowingResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ListFollowersRequest {
  string account_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
message ListFollowersResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ListPendingFollowRequestsRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListPendingFollowRequestsResponse {
  repeated profile.v1.Profile profiles = 1;  // 申請者の profile
  string next_cursor = 2;
  bool has_more = 3;
}

message GetFollowStatusRequest { repeated string target_account_ids = 1; }
message GetFollowStatusResponse { map<string, FollowStatusValue> statuses = 1; }

message GetPendingFollowCountRequest {}
message GetPendingFollowCountResponse { int32 count = 1; }

// ---- Block messages ----
message BlockRequest { string target_account_id = 1; }
message BlockResponse {}

message UnblockRequest { string target_account_id = 1; }
message UnblockResponse {}

message ListBlockedRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListBlockedResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message GetBlockStatusRequest { repeated string target_account_ids = 1; }
message GetBlockStatusResponse { map<string, bool> blocked = 1; }
```

旧 `relationship.v1` proto は cleanup フェーズで drop。本 spec の社会的契約は完全に `social.v1`。

## Cross-slice contracts

Social slice は posts / feed に follow-gate を提供する 2 つの use_case を expose する:

```ruby
# 1. 単件チェック (GetPost handler 等で利用)
Social::Slice["use_cases.viewer_can_see_post"]
  # call(viewer_account_id:, post:) → Boolean
  # internal: bidirectional block check + post.author の is_private 取得 (cross-slice profile) +
  #          is_private なら viewer ∈ author の approved followers か

# 2. 一括フィルタ (ListPostsByIds, ListFeed で利用)
Social::Slice["use_cases.filter_visible_posts"]
  # call(viewer_account_id:, posts:) → Array<post>
  # 引数の posts 配列から viewer に見える物のみ返す (順序維持)
```

実装は profile_author_adapter と同じ cross-slice 経由 (`Profile::Slice["use_cases.get_profile"]` で is_private 取得、social repository で blocks/follows を読む)。

## Monolith social slice

- **schema**: 新 PostgreSQL schema `social`、テーブル:
  - `social.follows(id uuid pk, follower_id uuid, followee_id uuid, status text, created_at timestamptz, updated_at timestamptz)`、UNIQUE(follower_id, followee_id)、index on (follower_id), (followee_id), (followee_id, status)
  - `social.blocks(id uuid pk, blocker_id uuid, blocked_id uuid, created_at timestamptz)`、UNIQUE(blocker_id, blocked_id)、index on (blocker_id), (blocked_id)
- **migration**: `Sequel.migration` で schema 作成 + 2 table。`relationship` schema は drop しない (cleanup PR で行う)。
- **relations / repository**:
  - `Social::Relations::Follows` / `Social::Relations::Blocks`
  - `Social::Repositories::FollowRepository`:
    - `follow(follower_id:, followee_id:, status:)`, `unfollow(follower_id:, followee_id:)`, `update_status(follower_id:, followee_id:, status:)`
    - `find(follower_id:, followee_id:)`, `list_following(account_id:, status: 'approved', limit:, cursor:)`, `list_followers(account_id:, status: 'approved', limit:, cursor:)`
    - `list_pending_to(account_id:, limit:, cursor:)`, `count_pending_to(account_id:)`
    - `status_batch(viewer_account_id:, target_account_ids:)` → `{target_id => status}`
  - `Social::Repositories::BlockRepository`:
    - `block(blocker_id:, blocked_id:)` (transactional, follows 双方向 DELETE 含む)
    - `unblock(blocker_id:, blocked_id:)`
    - `blocked_ids(account_id:)` (outgoing), `blocker_ids(account_id:)` (incoming), `bidirectionally_blocked_ids(account_id:)` (union uniq)
    - `status_batch(viewer_account_id:, target_account_ids:)` → `{target_id => bool}`
- **use_cases**:
  - `Social::UseCases::Follows::Follow` (target の is_private 参照、status 決定 + insert)
  - `Social::UseCases::Follows::Unfollow`, `CancelFollowRequest`, `ApproveFollowRequest`, `RejectFollowRequest`
  - `Social::UseCases::Follows::ListFollowing`, `ListFollowers`, `ListPendingFollowRequests`, `GetFollowStatus`, `GetPendingFollowCount`
  - `Social::UseCases::Blocks::Block`, `Unblock`, `ListBlocked`, `GetBlockStatus`
  - `Social::UseCases::ViewerCanSeePost`, `Social::UseCases::FilterVisiblePosts` (cross-slice 公開用)
- **handler**: `Social::Grpc::FollowHandler` / `Social::Grpc::BlockHandler` (各 RPC を直列に実装、profile.v1.Profile の hydration は `Profile::Slice["use_cases.get_profile"]` 経由)
- **cross-slice 連携**:
  - `Post::UseCases::Posts::ListPostsByIds` (F2) を変更: hydration 後に `Social::Slice["use_cases.filter_visible_posts"]` で filter
  - `Post::Grpc::PostHandler#get_post` を変更: respond 前に `Social::Slice["use_cases.viewer_can_see_post"]` で check、false なら `NOT_FOUND`
  - `Feed::UseCases::ListFeed` (F3) を変更: post_ids 取得後 (hydration 前) に visible author の whitelist を効かせる、または hydration 後に filter (ListPostsByIds 経由なら自動適用)

## Frontend

- **data 層** (`src/modules/social`):
  - `types.ts`: `FollowStatusValue` literal union、`FollowingProfileView`、`UseFollowOptions`、等
  - `lib/mappers.ts`: proto → view 変換
  - `hooks/`:
    - `useFollow(targetAccountId)`: status state + follow / unfollow / cancel handler
    - `useBlock(targetAccountId)`: status + block / unblock
    - `useFollowRequests()`: pending list + approve / reject handler
    - `useFollowList(accountId)` / `useFollowerList(accountId)`: cursor pagination
    - `useFollowStatusBatch(targetAccountIds)` / `useBlockStatusBatch(...)`: batch check
- **BFF** (`src/app/api/social/*`):
  - `/api/social/follow` (POST = Follow / DELETE = Unfollow / DELETE with cancel = CancelFollowRequest)、または別 path
  - `/api/social/follow/requests/[requesterAccountId]/approve` (POST), `/reject` (POST)
  - `/api/social/follow/requests` (GET = ListPendingFollowRequests), `/count` (GET)
  - `/api/social/follow/status` (POST batch GET-like with body) — 既存 `/api/posts/likes/status` pattern
  - `/api/social/following` (GET)、`/api/social/followers` (GET)
  - `/api/social/blocks` (POST / DELETE / GET = ListBlocked), `/api/social/blocks/status` (POST batch)
- **UI**:
  - `FollowButton` component: 3 状態 (Follow / Pending / Following) を `useFollow` から描画
  - `/u/[username]` profile page に follow button + followers/following count + 「いいねを送る」等 (現状 P5e のページに追加)
  - `/oshi` page (新規): tabs `フォロー中` / `フォロワー`、cursor pagination で list 描画
  - `/settings/follow-requests` page (新規) or 設定 panel: pending list + approve/reject
  - sidebar/nav に pending count badge (`useFollowRequests` の count)
  - `/dev/ui` に mock セクション追加 (`FollowButton`、follow list 一覧、pending request UI)
- **stub**: `src/stub/social/v1/*` (S1 で生成)
- **client**: `src/lib/grpc.ts` に `followClient` / `blockClient` を追加 (S1 で追記)

## Decomposition (Q5 feed と同パターン)

- **S0** (本 spec、commit + 自レビュー後 user 確認)
- **S1**: proto `social.v1` 全 RPC + message + enum を additive 追加、両 stub (monolith Ruby / frontend TS) 再生成。旧 `relationship.v1` は無改変、build-green。
- **S2**: monolith — `slices/social/` 新規 (relations / repository / use_cases / handlers)、新 schema migration、container 登録。`bundle exec rspec spec/slices/social` を新規 spec で carrer (test infra は別 PR の defer に従い必要最小限)。**posts / feed slice は無改変**、cross-slice 公開は S3。
- **S3**: cross-slice follow-gate enforcement —
  - `Social::UseCases::ViewerCanSeePost` / `FilterVisiblePosts` を social に追加
  - `Post::UseCases::Posts::ListPostsByIds` を変更し hydration 後 filter
  - `Post::Grpc::PostHandler#get_post` で check
  - `Feed::UseCases::ListFeed` は ListPostsByIds 経由で自動適用 (handler 側のみ確認、可能なら明示 filter も追加)
- **S4**: frontend data 層 — types + mappers + hooks + BFF routes、`src/lib/grpc.ts` への client 追記
- **S5**: frontend UI — `FollowButton`、`/u/[username]` 拡張、`/oshi` page 新規、pending request UI、`/dev/ui` mock 追記
- **cleanup (S6-Sn)**: 旧 `relationship` 一括 drop。posts/feed cleanup と同じ多段 PR:
  - frontend hooks 旧 (`useFollow` 旧、`useBlockedBy`、`useFollowRequests` 旧) drop
  - 旧 BFFs (`/api/cast/{blocks,following}/*`, `/api/guest/following/*`) drop
  - 旧 monolith handler / use_cases / adapters drop
  - 旧 proto messages drop、stub 再生成
  - 旧 `relationship` schema + tables drop (migration)

## Deferred / out of scope

- **通知** (新しい follow request、approve 時の push) → notifications スライス
- **DM** (followers のみ messaging) → messaging スライス
- **Mute** (follow しつつ timeline 非表示) → 別 PR or 別スライス
- **Karte** (Cast 間 Guest 評価共有) → karte スライス (法務 hard gate)
- **Mentions** (post 内 `@username` の notification 発火) → notifications + posts 拡張
- **Follow reason / tagged follow** (rx-sns の カテゴリ別 follow) → 拡張、現状はフラットな関係のみ
- **Block の理由 / 期間 / public report** → 拡張
- **ListBlockedBy** (= 誰が私を block しているか): privacy 上の意図的非公開、API 非提供
- **post-level visibility=private の従来仕様**は posts spec 範囲、本 spec の follow-gate とは独立 (重複しても安全)

## Verification

- **S1 proto**: `buf lint proto` 致命傷無し / monolith `ruby -c stubs/social/v1/*.rb` / frontend `pnpm proto:gen` + `pnpm build`
- **S2 monolith**: `bundle exec rspec spec/slices/social` 新規追加分が緑、`spec/slices/{post,feed,profile,relationship}` baseline 維持、`hanami db migrate` 成功、container smoke で `Follow` 実行 + DB 確認
- **S3 cross-slice**: rspec baseline 維持、container smoke で is_private アカ post が viewer 視点で正しく filter (follower は見える / 非 follower は見えない)
- **S4 frontend data**: `pnpm exec tsc --noEmit` 緑、`pnpm build` 緑、`pnpm lint` baseline 同等、新 BFFs が route 一覧に登場
- **S5 frontend UI**: tsc/build/lint 緑 + `/dev/ui` puppeteer 視覚確認 + 任意で `[[local-e2e-run]]` 手順で実 backend と疎通

全 PR additive / build-green、auto-merge 運用 (本セッションで定着)。
