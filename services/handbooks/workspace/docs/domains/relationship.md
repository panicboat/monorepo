---
sidebar_position: 50
---

# Relationship Domain

キャストとゲスト間の関係性（フォロー、ブロック、お気に入り）を管理するサービス。

## Responsibilities

- フォロー関係の管理
- フォロー承認制（Private キャスト対応）
- ブロック機能
- お気に入り機能

## Database Tables

| Table | Schema | Description |
|-------|--------|-------------|
| `follows` | `relationship` | フォロー関係 |
| `blocks` | `relationship` | ブロック関係 |
| `favorites` | `relationship` | お気に入り |

## Why Separate?

関係性データは Feed 集約やアクセス制御で頻繁に参照される。Post（コンテンツ）とは異なるアクセスパターンを持ち、キャッシュ戦略も異なる。将来的な推薦システムの基盤としても独立させる価値がある。

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
| Backend | `services/monolith/workspace/slices/relationship/` |
| Frontend | `web/nyx/workspace/src/modules/relationship/` (planned) |
| Proto | `proto/relationship/v1/follow_service.proto` |
| Proto | `proto/relationship/v1/block_service.proto` |
| Proto | `proto/relationship/v1/favorite_service.proto` |

## Key APIs

### FollowService

- `FollowCast` - フォロー
- `UnfollowCast` - フォロー解除
- `ListFollowing` - フォロー中一覧
- `ListFollowers` - フォロワー一覧
- `GetFollowStatus` - フォロー状態確認

### Follow Approval (Cast only)

- `ApproveFollow` - フォローリクエスト承認
- `RejectFollow` - フォローリクエスト却下
- `ListPendingFollowRequests` - 承認待ち一覧
- `GetPendingFollowCount` - 承認待ち数

### BlockService

- `BlockUser` - ブロック
- `UnblockUser` - ブロック解除
- `ListBlocked` - ブロック一覧
- `GetBlockStatus` - ブロック状態確認

### FavoriteService

- `AddFavorite` - お気に入り追加
- `RemoveFavorite` - お気に入り解除
- `ListFavorites` - お気に入り一覧
- `GetFavoriteStatus` - お気に入り状態確認

## Status

**Backend 実装済み** - Frontend 統合は未着手

## Related Domains

- **Portfolio** - キャストの visibility 設定を参照
- **Post** - ブロックユーザーのコンテンツ除外
- **Feed** - フォロー中・お気に入りのフィード生成
