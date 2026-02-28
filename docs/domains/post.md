# Post Domain

タイムライン投稿、いいね、コメント機能を管理するサービス。

## Responsibilities

- タイムライン投稿の CRUD
- いいね（Likes）機能
- コメント・返信機能
- ハッシュタグ管理
- 投稿のメディア添付

## Database Tables

| Table | Schema | Description |
|-------|--------|-------------|
| `posts` | `post` | 投稿本文 |
| `hashtags` | `post` | ハッシュタグ |
| `likes` | `post` | いいね |
| `comments` | `post` | コメント |
| `post_media` | `post` | 投稿メディア（中間テーブル） |
| `comment_media` | `post` | コメントメディア |

## Why Separate?

投稿・いいね・コメントは書き込みが多く、Relationship（フォロー関係）や Feed（フィード集約）とは異なるスケーリング特性を持つ。コンテンツ管理として独立させることで、将来的なキャッシュ戦略やモデレーション機能の追加が容易になる。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/post/` |
| Frontend | `web/nyx/workspace/src/modules/post/` (planned) |
| Proto | `proto/post/v1/post_service.proto` |
| Proto | `proto/post/v1/like_service.proto` |
| Proto | `proto/post/v1/comment_service.proto` |

## Key APIs

### PostService

- `ListCastPosts` - キャストの投稿一覧取得（cursor-based pagination）
- `GetPost` - 投稿取得
- `SavePost` - 投稿作成・更新
- `DeletePost` - 投稿削除

### LikeService

- `LikePost` - いいね
- `UnlikePost` - いいね解除
- `GetLikeStatus` - いいね状態確認

### CommentService

- `ListComments` - コメント一覧取得
- `ListReplies` - 返信一覧取得
- `AddComment` - コメント追加
- `DeleteComment` - コメント削除

## Status

**Backend 実装済み** - Frontend 統合は未着手

## Related Domains

- **Media** - 投稿・コメントへのメディア添付
- **Relationship** - ブロックユーザーの投稿除外
- **Feed** - フィード集約時に投稿データを提供
