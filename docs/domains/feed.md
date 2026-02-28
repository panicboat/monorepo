# Feed Domain

複数ドメインのデータを集約してフィードを生成するサービス。

## Responsibilities

- ゲスト向けフィード生成（全体、フォロー中、お気に入り）
- キャスト向けフィード生成（自分の投稿一覧）
- ブロックユーザーの除外
- カーソルベースのページネーション

## Database Tables

現時点では専用テーブルなし。将来的にキャッシュ用テーブルを追加予定。

## Why Separate?

フィード生成は複数ドメイン（Post、Relationship、Portfolio）のデータを集約する read-heavy な処理。専用のドメインとして分離することで、キャッシュ戦略の最適化や、将来的なタイムライン生成アルゴリズムの改善が容易になる。

## Feed Types

### Guest Feed (`ListGuestFeed`)

ゲストが閲覧するタイムラインフィード。

| Filter | Description |
|--------|-------------|
| `all` | 公開されている全キャストの投稿 |
| `following` | フォロー中のキャストの投稿のみ |
| `favorites` | お気に入りキャストの投稿のみ |

**除外条件:**
- ゲストがブロックしたキャストの投稿
- 非公開（private）で承認されていないキャストの投稿

### Cast Feed (`ListCastFeed`)

特定キャストの投稿一覧（プロフィールページ用）。

## Implementation

| Layer | Path |
|-------|------|
| Backend | `services/monolith/workspace/slices/feed/` |
| Frontend | `web/nyx/workspace/src/modules/feed/` (planned) |
| Proto | `proto/feed/v1/feed_service.proto` |

## Key APIs

### FeedService

- `ListGuestFeed` - ゲスト向けフィード取得
  - Parameters: `filter` (all/following/favorites), `limit`, `cursor`
  - ゲストの識別は認証コンテキストから取得
- `ListCastFeed` - キャストフィード取得
  - Parameters: `limit`, `cursor`
  - キャストの識別は認証コンテキストから取得

## Architecture

```
Feed Domain (Aggregator)
    │
    ├── Adapters
    │   ├── PostAdapter → Post Domain (投稿データ取得)
    │   ├── RelationshipAdapter → Relationship Domain (フォロー・ブロック情報)
    │   ├── CastAdapter → Portfolio Domain (キャスト情報)
    │   └── GuestAdapter → Portfolio Domain (ゲスト情報)
    │
    └── Use Cases
        ├── ListGuestFeed (ゲストフィード生成)
        └── ListCastFeed (キャストフィード生成)
```

## Status

**Backend 実装済み** - Frontend 統合は未着手

## Related Domains

- **Post** - 投稿データの取得
- **Relationship** - フォロー・ブロック・お気に入り情報
- **Portfolio** - キャスト・ゲスト情報

## Future Features

- フィードキャッシュ（Redis）
- リアルタイム更新（WebSocket）
- パーソナライズドフィード（推薦アルゴリズム）
