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
- `cast_follows` - フォロー関係
- `likes` - いいね
- `comments` - コメント


## Why Separate?

ソーシャル機能は Portfolio（プロフィール表示）とは異なるスケーリング特性を持つ。投稿・いいね・コメントは書き込みが多く、フィード生成にはキャッシュ戦略が重要。

## Cast Visibility

キャストは自身のプロフィールを `public`（公開）または `private`（非公開）に設定できる。

### Public キャスト

- 誰でも即座にフォローできる
- 投稿は全てのゲストが閲覧可能
- 検索結果に表示される

### Private キャスト

- フォローには**キャストの承認が必要**
- 承認されたフォロワーのみが投稿を閲覧可能
- 検索結果には表示されるが、詳細は制限される

### 設定変更時の挙動

- `private` → `public`: 承認待ちのリクエストは全て自動承認
- `public` → `private`: 既存フォロワーはそのまま維持

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/social/` |
| Frontend | `web/nyx/workspace/src/modules/social/` |
| Proto | `proto/social/v1/service.proto` |

## Status

**実装済み** - タイムライン、いいね、コメント、フォロー承認制

## Key APIs

### Timeline

- `ListCastPosts` - 投稿一覧取得（cursor-based pagination）
- `CreateCastPost` - 投稿作成
- `DeleteCastPost` - 投稿削除

### Follow

- `FollowCast` - フォロー
- `UnfollowCast` - フォロー解除
- `ListFollowing` - フォロー中一覧
- `GetFollowStatus` - フォロー状態確認

### Follow Approval (Cast only)

- `ApproveFollow` - フォローリクエスト承認
- `RejectFollow` - フォローリクエスト却下
- `ListPendingFollowRequests` - 承認待ち一覧
- `GetPendingFollowCount` - 承認待ち数

## Related Specs

- `openspec/specs/timeline/`

## Implemented Features

- タイムライン投稿（CRUD）
- いいね機能
- コメント機能
- フォロー・フォロワー管理
- フォロー承認制（Private キャスト対応）

## Future Features

- 通知システム
- リアルタイム更新（WebSocket）
