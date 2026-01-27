## Context
タイムライン投稿機能を永続化するため、バックエンド（monolith）とフロントエンド（Next.js）の両方に実装が必要。

**Domain: Social**
Timeline 機能は Social ドメインに属する。将来的にいいね・コメント・フォローなどの社会的機能を含む前提で設計する。

- Backend: `services/monolith/workspace/slices/social/` (新規)
- Frontend: `web/nyx/workspace/src/modules/social/` (拡充)
- Proto: `proto/social/v1/service.proto` (新規)

## Goals / Non-Goals
- Goals:
  - 投稿の CRUD（Create, Read, Update, Delete）を実装
  - 画像・動画のメディア添付をサポート
  - 既存の proto/gRPC パターンに従う
- Non-Goals:
  - いいね・コメント機能（別提案で対応）
  - ゲスト向けフィード API（別提案で対応）

## Decisions

### Database Schema
```sql
CREATE TABLE cast_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cast_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE cast_post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES cast_posts(id) ON DELETE CASCADE,
  media_type VARCHAR(10) NOT NULL, -- 'image' or 'video'
  url TEXT NOT NULL,
  thumbnail_url TEXT, -- for videos
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cast_posts_cast_id ON cast_posts(cast_id);
CREATE INDEX idx_cast_posts_created_at ON cast_posts(created_at DESC);
CREATE INDEX idx_cast_post_media_post_id ON cast_post_media(post_id);
```

### Proto Messages
```protobuf
message CastPostAuthor {
  string id = 1;
  string name = 2;
  string image_url = 3;
}

message CastPost {
  string id = 1;
  string cast_id = 2;
  string content = 3;
  repeated CastPostMedia media = 4;
  string created_at = 5; // ISO8601
  CastPostAuthor author = 6; // JOINed from casts table
  int32 likes_count = 7;    // Always 0 (out of scope)
  int32 comments_count = 8; // Always 0 (out of scope)
}

message CastPostMedia {
  string id = 1;
  string media_type = 2; // "image" or "video"
  string url = 3;
  string thumbnail_url = 4;
}

rpc ListCastPosts(ListCastPostsRequest) returns (ListCastPostsResponse);
rpc SaveCastPost(SaveCastPostRequest) returns (SaveCastPostResponse);
rpc DeleteCastPost(DeleteCastPostRequest) returns (DeleteCastPostResponse);
```

### Alternatives Considered
1. **timeline 専用のドメインを作成** - 将来的には検討するが、現時点では portfolio に含める方がシンプル
2. **NoSQL (DynamoDB等) を使用** - 既存の PostgreSQL パターンに合わせる方が一貫性がある

## Risks / Trade-offs
- 大量の投稿によるパフォーマンス低下 → ページネーション実装で対応（limit/offset）
- メディアファイルの管理 → 既存の S3 アップロード機構を再利用

## Migration Plan
1. データベースマイグレーションを実行
2. バックエンド API をデプロイ
3. フロントエンドをデプロイ
4. 既存のモックデータは削除（移行不要）

## Open Questions
- (Resolved) ページネーション方式 → Cursor-based を採用

## Pagination Design
Cursor-based pagination を採用。`created_at` + `id` の複合カーソルを使用。

```
GET /api/cast/timeline?limit=20
GET /api/cast/timeline?limit=20&cursor={base64_encoded_cursor}
```

**Cursor format:**
```json
{"created_at": "2026-01-25T12:00:00Z", "id": "uuid"}
```

**Response:**
```json
{
  "posts": [...],
  "next_cursor": "base64...",
  "has_more": true
}
```

**Proto:**
```protobuf
message ListCastPostsRequest {
  int32 limit = 1;       // default: 20, max: 50
  string cursor = 2;     // optional, base64 encoded
}

message ListCastPostsResponse {
  repeated CastPost posts = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```
