---
sidebar_position: 30
---

# Social Domain

キャストとゲスト間のソーシャルインタラクションを管理するサービス。

## Responsibilities

- タイムライン投稿の CRUD
- いいね（Likes）機能
- コメント機能
- フォロー関係の管理
- 通知

## Database Tables

- `cast_posts` - タイムライン投稿
- `cast_post_media` - 投稿メディア（画像/動画）
- `likes` - いいね（予定）
- `comments` - コメント（予定）
- `follows` - フォロー関係（予定）

## Why Separate?

ソーシャル機能は Portfolio（プロフィール表示）とは異なるスケーリング特性を持つ。投稿・いいね・コメントは書き込みが多く、フィード生成にはキャッシュ戦略が重要。

## Living Portfolio

静的なプロフィールではなく、タイムラインを通じて「今夜空いているか (Tonight)」「即レス可能か (Online)」というリアルタイムな生命感を表現する。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/social/` |
| Frontend | `web/nyx/workspace/src/modules/social/` |
| Proto | `proto/social/v1/service.proto` |

## Status

**実装予定** - `add-cast-timeline-persistence` で投稿機能を実装中

## Key APIs (Planned)

- `ListCastPosts` - 投稿一覧取得（cursor-based pagination）
- `CreateCastPost` - 投稿作成
- `DeleteCastPost` - 投稿削除

## Related Specs

- `openspec/specs/timeline/`

## Future Features

- いいね・コメント機能（別提案で対応予定）
- フォロー・フォロワー管理
- 通知システム
