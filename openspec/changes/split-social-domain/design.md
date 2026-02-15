# Design: split-social-domain

## Architecture Overview

### Current State

```
services/monolith/workspace/slices/social/
├── handlers/
│   ├── post_service.rb
│   ├── like_service.rb
│   ├── comment_service.rb
│   ├── follow_service.rb
│   ├── block_service.rb
│   └── favorite_service.rb
├── use_cases/
│   ├── posts/
│   ├── likes/
│   ├── comments/
│   ├── follows/
│   ├── blocks/
│   └── favorites/
└── repositories/
    └── (共有リポジトリ)

proto/social/v1/
├── post_service.proto
├── like_service.proto
├── comment_service.proto
├── follow_service.proto
├── block_service.proto
└── favorite_service.proto
```

### Target State

```
services/monolith/workspace/slices/
├── post/                       # Post ドメイン
│   ├── handlers/
│   │   ├── post_service.rb
│   │   ├── like_service.rb
│   │   └── comment_service.rb
│   ├── use_cases/
│   │   ├── posts/
│   │   ├── likes/
│   │   └── comments/
│   └── repositories/
│       ├── post_repository.rb
│       ├── like_repository.rb
│       └── comment_repository.rb
│
├── relationship/               # Relationship ドメイン
│   ├── handlers/
│   │   ├── follow_service.rb
│   │   ├── block_service.rb
│   │   └── favorite_service.rb
│   ├── use_cases/
│   │   ├── follows/
│   │   ├── blocks/
│   │   └── favorites/
│   └── repositories/
│       ├── follow_repository.rb
│       ├── block_repository.rb
│       └── favorite_repository.rb
│
└── feed/                       # Feed ドメイン（Query 専用）
    ├── handlers/
    │   └── feed_service.rb
    ├── use_cases/
    │   ├── list_guest_feed.rb
    │   └── list_cast_feed.rb
    └── adapters/
        ├── post_adapter.rb         # Post ドメインへの問い合わせ
        └── relationship_adapter.rb # Relationship ドメインへの問い合わせ

proto/
├── post/v1/
│   ├── post_service.proto
│   ├── like_service.proto
│   └── comment_service.proto
│
├── relationship/v1/
│   ├── follow_service.proto
│   ├── block_service.proto
│   └── favorite_service.proto
│
└── feed/v1/
    └── feed_service.proto
```

## Database Migration

### Strategy: Schema Separation + Table Rename

ドメイン分割に伴い、PostgreSQL スキーマを分離し、テーブル名から冗長なプレフィックスを削除する。

### Schema Structure

```
PostgreSQL
├── post スキーマ
│   ├── posts           (旧: public.cast_posts)
│   ├── media           (旧: public.cast_post_media)
│   ├── hashtags        (旧: public.cast_post_hashtags)
│   ├── likes           (旧: public.post_likes)
│   ├── comments        (旧: public.post_comments)
│   └── comment_media   (旧: public.comment_media)
│
├── relationship スキーマ
│   ├── follows         (旧: public.cast_follows)
│   ├── blocks          (旧: public.blocks)
│   └── favorites       (旧: public.cast_favorites)
│
└── feed スキーマ
    └── (テーブルなし - 他スキーマを参照)
```

### Table Mapping

| Current (public.) | New | Schema |
|-------------------|-----|--------|
| `cast_posts` | `posts` | post |
| `cast_post_media` | `media` | post |
| `cast_post_hashtags` | `hashtags` | post |
| `post_likes` | `likes` | post |
| `post_comments` | `comments` | post |
| `comment_media` | `comment_media` | post |
| `cast_follows` | `follows` | relationship |
| `blocks` | `blocks` | relationship |
| `cast_favorites` | `favorites` | relationship |

### Migration Approach

1. **新スキーマを作成** - `CREATE SCHEMA post; CREATE SCHEMA relationship;`
2. **テーブルを移動・リネーム** - `ALTER TABLE public.cast_posts SET SCHEMA post; ALTER TABLE post.cast_posts RENAME TO posts;`
3. **アプリケーション層を更新** - ROM relations の `schema` 設定を更新
4. **旧テーブル参照を削除** - 全ての参照が新スキーマを向いていることを確認

### ROM Configuration Example

```ruby
# slices/post/relations/posts.rb
module Post
  module Relations
    class Posts < ROM::Relation[:sql]
      schema(:posts, infer: true) do
        attribute :id, Types::UUID
        # ...
      end

      dataset do
        # スキーマを明示的に指定
        db.from(Sequel[:post][:posts])
      end
    end
  end
end
```

## Domain Boundaries

### Post Domain

**責務**: 投稿とそれに対するアクションの管理

| Entity | Description |
|--------|-------------|
| Post | タイムライン投稿（本文、メディア、ハッシュタグ） |
| Like | 投稿へのいいね |
| Comment | 投稿へのコメント・リプライ |

**Database Tables** (`post` スキーマ):
- `post.posts`
- `post.media`
- `post.hashtags`
- `post.likes`
- `post.comments`
- `post.comment_media`

**公開 API**:
- `ListCastPosts(cast_id, cursor)` - キャストの投稿一覧
- `ListPublicPosts(cursor, exclude_user_ids)` - 公開投稿一覧（ブロック除外用引数付き）
- `GetPost(post_id)` - 投稿詳細
- `SavePost(...)` - 投稿保存
- `DeletePost(post_id)` - 投稿削除
- Like/Comment 関連 API（既存通り）

### Relationship Domain

**責務**: ユーザー間の関係性管理

| Entity | Description |
|--------|-------------|
| Follow | フォロー関係（pending/approved） |
| Block | ブロック関係 |
| Favorite | お気に入り登録 |

**Database Tables** (`relationship` スキーマ):
- `relationship.follows`
- `relationship.blocks`
- `relationship.favorites`

**公開 API**:
- `ListFollowing(guest_id)` - フォロー中キャスト一覧
- `ListFollowers(cast_id)` - フォロワー一覧
- `ListBlocked(user_id)` - ブロック中ユーザー一覧
- `ListFavorites(guest_id)` - お気に入りキャスト一覧
- Follow/Block/Favorite の CRUD API（既存通り）

### Feed Domain

**責務**: 複数ドメインからのデータ集約（読み取り専用）

**Database Tables**: なし（`post` と `relationship` スキーマを参照）

**公開 API**:
- `ListGuestFeed(guest_id, filter, cursor)` - ゲスト向けフィード
- `ListCastFeed(cast_id, cursor)` - キャスト向けフィード（自分の投稿管理）

**内部フロー**:

```
ListGuestFeed(guest_id, filter="following")
│
├── 1. Relationship.ListFollowing(guest_id) → following_cast_ids
├── 2. Relationship.ListBlocked(guest_id) → blocked_user_ids
└── 3. Post.ListPublicPosts(
│       cast_ids: following_cast_ids,
│       exclude_user_ids: blocked_user_ids
│   ) → posts
│
└── Return aggregated feed
```

## Migration Strategy

### Phase 1: Relationship ドメイン分離

Follow, Block, Favorite を新しい `relationship` slice に移動。

1. `slices/relationship/` を作成
2. 関連ファイルを移動
3. proto を `proto/relationship/v1/` に移動
4. 既存の `social` からの参照を更新
5. テスト実行・動作確認

### Phase 2: Post ドメイン分離

Post, Like, Comment を新しい `post` slice に移動。

1. `slices/post/` を作成
2. 関連ファイルを移動
3. proto を `proto/post/v1/` に移動
4. テスト実行・動作確認

### Phase 3: Feed ドメイン作成

集約ロジックを Feed ドメインに実装。

1. `slices/feed/` を作成
2. Adapter を実装（Post, Relationship への問い合わせ）
3. `ListGuestFeed`, `ListCastFeed` を実装
4. proto を `proto/feed/v1/` に作成
5. フロントエンドの API 呼び出しを Feed に切り替え

### Phase 4: Social ドメイン削除

1. `slices/social/` を削除
2. `proto/social/v1/` を削除（または deprecated に）
3. 関連ドキュメント更新

## Proto Migration

### Option A: New Packages (Recommended)

新しい proto パッケージを作成し、段階的に移行。

```protobuf
// proto/post/v1/post_service.proto
package post.v1;

// proto/relationship/v1/follow_service.proto
package relationship.v1;

// proto/feed/v1/feed_service.proto
package feed.v1;
```

**Pros**: 破壊的変更なし、段階的移行可能
**Cons**: 一時的に 2 つの proto が共存

### Option B: In-place Rename

既存の proto を直接リネーム。

**Pros**: シンプル
**Cons**: 破壊的変更、一括移行が必要

**決定**: Option A を採用

## Frontend Impact

### Current Structure

```
web/nyx/workspace/src/modules/social/
├── hooks/
│   ├── useFollow.ts
│   ├── useLike.ts
│   ├── useComments.ts
│   └── ...
└── components/
    ├── feed/
    └── comments/
```

### Target Structure

```
web/nyx/workspace/src/modules/
├── post/
│   ├── hooks/
│   │   ├── usePosts.ts
│   │   ├── useLike.ts
│   │   └── useComments.ts
│   └── components/
│       └── comments/
│
├── relationship/
│   ├── hooks/
│   │   ├── useFollow.ts
│   │   ├── useBlock.ts
│   │   └── useFavorite.ts
│   └── components/
│       └── (relationship UI)
│
└── feed/
    ├── hooks/
    │   ├── useGuestFeed.ts
    │   └── useCastFeed.ts
    └── components/
        └── feed/
```

## Future: BFF Migration Path

Feed ドメインは将来的に BFF（Next.js API Routes）へ移行可能。

```
現在:
Browser → API Routes → Feed Domain → Post/Relationship

将来:
Browser → API Routes (BFF) → Post/Relationship
                ↑
        集約ロジックを BFF に移動
        Feed Domain を削除
```

Feed ドメインを読み取り専用に制限することで、BFF 移行時の影響を最小化。

## Trade-offs

| Decision | Pros | Cons |
|----------|------|------|
| 3 ドメイン分割 | 責務明確、修正容易 | 初期コスト、ドメイン間通信のオーバーヘッド |
| Feed を別ドメインに | BFF 移行容易、CQRS パターン | 一時的なコード重複 |
| 新しい proto パッケージ | 段階的移行可能 | 一時的に 2 つの proto が共存 |

## Open Questions

1. **Feed ドメインのキャッシュ戦略** - 必要に応じて Phase 3 以降で検討
2. **proto パッケージのバージョニング** - 現状は v1 を維持、必要に応じて v2 を検討
