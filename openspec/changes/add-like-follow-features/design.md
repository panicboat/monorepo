# Design: Like and Follow Features

## Overview

Like と Follow 機能のバックエンド設計について説明する。

## Database Schema

### Like Table

```sql
CREATE TABLE social__post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social__cast_posts(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, guest_id)
);

CREATE INDEX idx_post_likes_post_id ON social__post_likes(post_id);
CREATE INDEX idx_post_likes_guest_id ON social__post_likes(guest_id);
```

### Follow Table

```sql
CREATE TABLE social__cast_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cast_id UUID NOT NULL,
  guest_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cast_id, guest_id)
);

CREATE INDEX idx_cast_follows_cast_id ON social__cast_follows(cast_id);
CREATE INDEX idx_cast_follows_guest_id ON social__cast_follows(guest_id);
```

## Proto Definitions

### Like RPCs

```protobuf
service SocialService {
  rpc LikeCastPost(LikeCastPostRequest) returns (LikeCastPostResponse);
  rpc UnlikeCastPost(UnlikeCastPostRequest) returns (UnlikeCastPostResponse);
  rpc GetPostLikeStatus(GetPostLikeStatusRequest) returns (GetPostLikeStatusResponse);
}

message LikeCastPostRequest {
  string post_id = 1;
}

message LikeCastPostResponse {
  int32 likes_count = 1;
}

message UnlikeCastPostRequest {
  string post_id = 1;
}

message UnlikeCastPostResponse {
  int32 likes_count = 1;
}

message GetPostLikeStatusRequest {
  repeated string post_ids = 1;
}

message GetPostLikeStatusResponse {
  map<string, bool> liked = 1; // post_id -> is_liked
}
```

### Follow RPCs

```protobuf
service SocialService {
  rpc FollowCast(FollowCastRequest) returns (FollowCastResponse);
  rpc UnfollowCast(UnfollowCastRequest) returns (UnfollowCastResponse);
  rpc ListFollowing(ListFollowingRequest) returns (ListFollowingResponse);
  rpc GetFollowStatus(GetFollowStatusRequest) returns (GetFollowStatusResponse);
}

message FollowCastRequest {
  string cast_id = 1;
}

message FollowCastResponse {
  bool success = 1;
}

message UnfollowCastRequest {
  string cast_id = 1;
}

message UnfollowCastResponse {
  bool success = 1;
}

message ListFollowingRequest {
  int32 limit = 1;
  string cursor = 2;
}

message ListFollowingResponse {
  repeated string cast_ids = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message GetFollowStatusRequest {
  repeated string cast_ids = 1;
}

message GetFollowStatusResponse {
  map<string, bool> following = 1; // cast_id -> is_following
}
```

## Architecture

### Backend Structure

```
slices/social/
├── repositories/
│   ├── like_repository.rb     # NEW
│   └── follow_repository.rb   # NEW
├── use_cases/
│   ├── likes/
│   │   ├── like_post.rb       # NEW
│   │   ├── unlike_post.rb     # NEW
│   │   └── get_like_status.rb # NEW
│   └── follows/
│       ├── follow_cast.rb     # NEW
│       ├── unfollow_cast.rb   # NEW
│       ├── list_following.rb  # NEW
│       └── get_follow_status.rb # NEW
├── relations/
│   ├── post_likes.rb          # NEW
│   └── cast_follows.rb        # NEW
└── grpc/
    └── social_handler.rb      # NEW (Like/Follow RPCs)
```

### Frontend API Routes

```
app/api/guest/
├── likes/
│   ├── route.ts              # POST (like), DELETE (unlike)
│   └── status/route.ts       # GET (batch status check)
└── following/
    ├── route.ts              # GET (list), POST (follow), DELETE (unfollow)
    └── status/route.ts       # GET (batch status check)
```

## Data Flow

### Like Flow

1. ゲストがいいねボタンをクリック
2. `POST /api/guest/likes` を呼び出し（post_id を送信）
3. gRPC `LikeCastPost` を実行
4. `social__post_likes` にレコード挿入（重複時は無視）
5. 最新の likes_count を返却
6. フロントエンドの状態を更新

### Follow Flow

1. ゲストがフォローボタンをクリック
2. `POST /api/guest/following` を呼び出し（cast_id を送信）
3. gRPC `FollowCast` を実行
4. `social__cast_follows` にレコード挿入（重複時は無視）
5. 成功フラグを返却
6. フロントエンドの状態を更新

### Following Filter Flow

1. タイムラインの Following タブを選択
2. `GET /api/guest/timeline?filter=following` を呼び出し
3. gRPC でフォロー中の cast_id リストを取得
4. cast_id でフィルタリングした投稿を返却

## Performance Considerations

### Likes Count

投稿一覧取得時に `likes_count` を毎回カウントするのは非効率なため、以下の方針をとる：

1. **Phase 1**: `COUNT(*)` でリアルタイム集計（シンプルだが N+1 問題）
2. **Phase 2 (将来)**: `cast_posts` テーブルに `likes_count` カラムを追加し、トリガーまたはアプリケーションで更新

現時点では Phase 1 で実装し、パフォーマンス問題が顕在化した場合に Phase 2 に移行する。

### Batch Status Check

投稿一覧表示時に各投稿のいいね状態を個別に取得すると N+1 問題が発生するため、`GetPostLikeStatus` RPC で一括取得する。
