# user_id 統一 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** profile_id (cast_id/guest_id) を廃止し、全層で user_id に統一する

**Architecture:** cast/guest テーブルの PK を user_id に変更し、全 FK カラムを `cast_user_id`/`guest_user_id` にリネーム。Proto、バックエンド、フロントエンドを全て更新する。

**Tech Stack:** PostgreSQL migrations, Ruby/Hanami ROM, Protocol Buffers, Next.js/React

**Design doc:** `docs/plans/2026-02-26-unify-user-id-design.md`

---

## Task 1: DB マイグレーション作成

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260227000001_unify_user_id.rb`

**Step 1: マイグレーションファイルを作成**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # ============================================================
    # Phase 1: portfolio__casts の FK カラムをデータ移行 + リネーム
    # ============================================================

    # 1a. portfolio__cast_areas: cast_id → cast_user_id
    alter_table :portfolio__cast_areas do
      drop_constraint :portfolio__cast_areas_cast_id_fkey, if_exists: true
    end
    run <<~SQL
      ALTER TABLE portfolio.cast_areas
      ADD COLUMN cast_user_id UUID;
    SQL
    run <<~SQL
      UPDATE portfolio.cast_areas ca
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE ca.cast_id = c.id;
    SQL
    run <<~SQL
      ALTER TABLE portfolio.cast_areas
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL
    alter_table :portfolio__cast_areas do
      drop_constraint :portfolio__cast_areas_pkey
      drop_column :cast_id
    end
    alter_table :portfolio__cast_areas do
      add_primary_key [:cast_user_id, :area_id]
    end

    # 1b. portfolio__cast_genres: cast_id → cast_user_id
    alter_table :portfolio__cast_genres do
      drop_constraint :portfolio__cast_genres_cast_id_fkey, if_exists: true
    end
    run <<~SQL
      ALTER TABLE portfolio.cast_genres
      ADD COLUMN cast_user_id UUID;
    SQL
    run <<~SQL
      UPDATE portfolio.cast_genres cg
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE cg.cast_id = c.id;
    SQL
    run <<~SQL
      ALTER TABLE portfolio.cast_genres
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL
    alter_table :portfolio__cast_genres do
      drop_index :cast_id, name: :portfolio_cast_genres_cast_id_index, if_exists: true
      drop_column :cast_id
      add_index :cast_user_id
      add_unique_constraint [:cast_user_id, :genre_id]
    end

    # 1c. portfolio__cast_gallery_media: cast_id → cast_user_id
    alter_table :portfolio__cast_gallery_media do
      drop_constraint :portfolio__cast_gallery_media_cast_id_fkey, if_exists: true
    end
    run <<~SQL
      ALTER TABLE portfolio.cast_gallery_media
      ADD COLUMN cast_user_id UUID;
    SQL
    run <<~SQL
      UPDATE portfolio.cast_gallery_media cgm
      SET cast_user_id = c.user_id
      FROM portfolio.casts c
      WHERE cgm.cast_id = c.id;
    SQL
    run <<~SQL
      ALTER TABLE portfolio.cast_gallery_media
      ALTER COLUMN cast_user_id SET NOT NULL;
    SQL
    alter_table :portfolio__cast_gallery_media do
      drop_index :cast_id, name: :portfolio_cast_gallery_media_cast_id_index, if_exists: true
      drop_index [:cast_id, :position], name: :portfolio_cast_gallery_media_cast_id_position_index, if_exists: true
      drop_column :cast_id
      add_index :cast_user_id
      add_index [:cast_user_id, :position]
    end

    # ============================================================
    # Phase 2: クロススキーマ FK カラムのデータ移行 + リネーム
    # ============================================================

    # 2a. offer__plans: cast_id → cast_user_id
    run <<~SQL
      ALTER TABLE offer.plans ADD COLUMN cast_user_id UUID;
      UPDATE offer.plans p SET cast_user_id = c.user_id FROM portfolio.casts c WHERE p.cast_id = c.id;
      ALTER TABLE offer.plans ALTER COLUMN cast_user_id SET NOT NULL;
      ALTER TABLE offer.plans DROP COLUMN cast_id;
    SQL
    alter_table :offer__plans do
      add_index :cast_user_id
    end

    # 2b. offer__schedules: cast_id → cast_user_id
    run <<~SQL
      ALTER TABLE offer.schedules ADD COLUMN cast_user_id UUID;
      UPDATE offer.schedules s SET cast_user_id = c.user_id FROM portfolio.casts c WHERE s.cast_id = c.id;
      ALTER TABLE offer.schedules ALTER COLUMN cast_user_id SET NOT NULL;
      ALTER TABLE offer.schedules DROP COLUMN cast_id;
    SQL
    alter_table :offer__schedules do
      add_index :cast_user_id
    end

    # 2c. post__posts: cast_id → cast_user_id
    run <<~SQL
      ALTER TABLE post.posts ADD COLUMN cast_user_id UUID;
      UPDATE post.posts p SET cast_user_id = c.user_id FROM portfolio.casts c WHERE p.cast_id = c.id;
      ALTER TABLE post.posts ALTER COLUMN cast_user_id SET NOT NULL;
      ALTER TABLE post.posts DROP COLUMN cast_id;
    SQL
    alter_table :post__posts do
      add_index :cast_user_id
    end

    # 2d. post__likes: guest_id → guest_user_id
    run <<~SQL
      ALTER TABLE post.likes ADD COLUMN guest_user_id UUID;
      UPDATE post.likes l SET guest_user_id = g.user_id FROM portfolio.guests g WHERE l.guest_id = g.id;
      ALTER TABLE post.likes ALTER COLUMN guest_user_id SET NOT NULL;
    SQL
    alter_table :post__likes do
      drop_constraint :post__likes_post_id_guest_id_key, if_exists: true
      drop_index :guest_id, if_exists: true
      drop_column :guest_id
      add_index :guest_user_id
      add_unique_constraint [:post_id, :guest_user_id]
    end

    # 2e. relationship__follows: cast_id → cast_user_id, guest_id → guest_user_id
    run <<~SQL
      ALTER TABLE relationship.follows ADD COLUMN cast_user_id UUID;
      ALTER TABLE relationship.follows ADD COLUMN guest_user_id UUID;
      UPDATE relationship.follows f
        SET cast_user_id = c.user_id
        FROM portfolio.casts c WHERE f.cast_id = c.id;
      UPDATE relationship.follows f
        SET guest_user_id = g.user_id
        FROM portfolio.guests g WHERE f.guest_id = g.id;
      ALTER TABLE relationship.follows ALTER COLUMN cast_user_id SET NOT NULL;
      ALTER TABLE relationship.follows ALTER COLUMN guest_user_id SET NOT NULL;
    SQL
    alter_table :relationship__follows do
      drop_constraint :relationship__follows_cast_id_guest_id_key, if_exists: true
      drop_index :cast_id, if_exists: true
      drop_index :guest_id, if_exists: true
      drop_column :cast_id
      drop_column :guest_id
      add_index :cast_user_id
      add_index :guest_user_id
      add_unique_constraint [:cast_user_id, :guest_user_id]
    end

    # 2f. relationship__favorites: cast_id → cast_user_id, guest_id → guest_user_id
    run <<~SQL
      ALTER TABLE relationship.favorites ADD COLUMN cast_user_id UUID;
      ALTER TABLE relationship.favorites ADD COLUMN guest_user_id UUID;
      UPDATE relationship.favorites f
        SET cast_user_id = c.user_id
        FROM portfolio.casts c WHERE f.cast_id = c.id;
      UPDATE relationship.favorites f
        SET guest_user_id = g.user_id
        FROM portfolio.guests g WHERE f.guest_id = g.id;
      ALTER TABLE relationship.favorites ALTER COLUMN cast_user_id SET NOT NULL;
      ALTER TABLE relationship.favorites ALTER COLUMN guest_user_id SET NOT NULL;
    SQL
    alter_table :relationship__favorites do
      drop_constraint :relationship__favorites_cast_id_guest_id_key, if_exists: true
      drop_index :cast_id, if_exists: true
      drop_index :guest_id, if_exists: true
      drop_column :cast_id
      drop_column :guest_id
      add_index :cast_user_id
      add_index :guest_user_id
      add_unique_constraint [:cast_user_id, :guest_user_id]
    end

    # ============================================================
    # Phase 3: portfolio__casts, portfolio__guests の PK 変更
    # ============================================================

    # 3a. casts: id を廃止、user_id を PK に
    alter_table :portfolio__casts do
      drop_constraint :casts_pkey
    end
    alter_table :portfolio__casts do
      drop_column :id
      add_primary_key [:user_id]
    end

    # FK を再設定（cast_user_id → casts.user_id）
    run <<~SQL
      ALTER TABLE portfolio.cast_areas
        ADD CONSTRAINT cast_areas_cast_user_id_fkey
        FOREIGN KEY (cast_user_id) REFERENCES portfolio.casts(user_id) ON DELETE CASCADE;
      ALTER TABLE portfolio.cast_genres
        ADD CONSTRAINT cast_genres_cast_user_id_fkey
        FOREIGN KEY (cast_user_id) REFERENCES portfolio.casts(user_id) ON DELETE CASCADE;
      ALTER TABLE portfolio.cast_gallery_media
        ADD CONSTRAINT cast_gallery_media_cast_user_id_fkey
        FOREIGN KEY (cast_user_id) REFERENCES portfolio.casts(user_id) ON DELETE CASCADE;
    SQL

    # 3b. guests: id を廃止、user_id を PK に
    alter_table :portfolio__guests do
      drop_constraint :guests_pkey
    end
    alter_table :portfolio__guests do
      drop_column :id
      add_primary_key [:user_id]
    end
  end

  down do
    raise ROM::SQL::Migration::Rollback, "This migration is not reversible. Restore from backup."
  end
end
```

**Step 2: マイグレーションを実行**

Run: `cd services/monolith/workspace && bundle exec rake db:migrate`

**Step 3: structure.sql を再生成して確認**

Run: `cd services/monolith/workspace && bundle exec rake db:structure:dump`

**Step 4: コミット**

```bash
git add services/monolith/workspace/config/db/migrate/20260227000001_unify_user_id.rb services/monolith/workspace/config/db/structure.sql
git commit -m "feat: add migration to unify user_id as PK for cast/guest tables"
```

---

## Task 2: ROM リレーション更新

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/relations/casts.rb`
- Modify: `services/monolith/workspace/slices/portfolio/relations/guests.rb`
- Modify: `services/monolith/workspace/slices/portfolio/relations/cast_areas.rb`
- Modify: `services/monolith/workspace/slices/portfolio/relations/cast_gallery_media.rb`
- Modify: `services/monolith/workspace/slices/portfolio/relations/cast_genres.rb`
- Modify: `services/monolith/workspace/slices/offer/relations/plans.rb`
- Modify: `services/monolith/workspace/slices/offer/relations/schedules.rb`
- Modify: `services/monolith/workspace/slices/post/relations/posts.rb`
- Modify: `services/monolith/workspace/slices/post/relations/likes.rb`
- Modify: `services/monolith/workspace/slices/relationship/relations/follows.rb`
- Modify: `services/monolith/workspace/slices/relationship/relations/favorites.rb`

**Step 1: Portfolio リレーション更新**

`casts.rb` の変更:
- `attribute :id` を削除
- `primary_key :id` → `primary_key :user_id`
- `has_many :plans, foreign_key: :cast_id` → `has_many :plans, foreign_key: :cast_user_id`
- `has_many :cast_areas, foreign_key: :cast_id` → `has_many :cast_areas, foreign_key: :cast_user_id`
- `has_many :cast_gallery_media, foreign_key: :cast_id` → `has_many :cast_gallery_media, foreign_key: :cast_user_id`

`guests.rb` の変更:
- `attribute :id` を削除
- `primary_key :id` → `primary_key :user_id`

`cast_areas.rb` の変更:
- `attribute :cast_id` → `attribute :cast_user_id`
- `belongs_to :cast, foreign_key: :cast_id` → `belongs_to :cast, foreign_key: :cast_user_id`

`cast_gallery_media.rb` の変更:
- `attribute :cast_id` → `attribute :cast_user_id`
- `belongs_to :casts, foreign_key: :cast_id` → `belongs_to :casts, foreign_key: :cast_user_id`

`cast_genres.rb` の変更:
- `attribute :cast_id` → `attribute :cast_user_id`
- `belongs_to :cast, foreign_key: :cast_id` → `belongs_to :cast, foreign_key: :cast_user_id`

**Step 2: Offer リレーション更新**

`plans.rb`: `attribute :cast_id` → `attribute :cast_user_id`
`schedules.rb`: `attribute :cast_id` → `attribute :cast_user_id`

**Step 3: Post リレーション更新**

`posts.rb`: `attribute :cast_id` → `attribute :cast_user_id`
`likes.rb`: `attribute :guest_id` → `attribute :guest_user_id`

**Step 4: Relationship リレーション更新**

`follows.rb`: `attribute :cast_id` → `attribute :cast_user_id`, `attribute :guest_id` → `attribute :guest_user_id`
`favorites.rb`: 同上

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/*/relations/*.rb
git commit -m "refactor: update ROM relations for user_id unification"
```

---

## Task 3: バックエンド リポジトリ更新

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/repositories/cast_repository.rb`
- Modify: `services/monolith/workspace/slices/portfolio/repositories/guest_repository.rb`
- Modify: `services/monolith/workspace/slices/offer/repositories/plan_repository.rb`
- Modify: `services/monolith/workspace/slices/offer/repositories/schedule_repository.rb`
- Modify: `services/monolith/workspace/slices/post/repositories/post_repository.rb`
- Modify: `services/monolith/workspace/slices/post/repositories/like_repository.rb`
- Modify: `services/monolith/workspace/slices/relationship/repositories/follow_repository.rb`
- Modify: `services/monolith/workspace/slices/relationship/repositories/favorite_repository.rb`

**Step 1: Portfolio リポジトリ更新**

`cast_repository.rb`:
- `find_by_id(id)` → `find(user_id)` (PK が user_id になったため `by_pk` で直接検索可能)
- `find_by_user_id(user_id)` → `find(user_id)` に統合
- `find_by_user_ids(user_ids)` → `find_many(user_ids)` に統合
- `by_pk(id)` → `by_pk(user_id)` に変更
- 全ての `.id` 参照を `.user_id` に変更

`guest_repository.rb`:
- 同様に `find_by_user_id` / `find_by_id` を `find` に統合
- `by_pk(id)` → `by_pk(user_id)` に変更

**Step 2: Offer リポジトリ更新**

`plan_repository.rb`: 全ての `cast_id` → `cast_user_id`
`schedule_repository.rb`: 全ての `cast_id` → `cast_user_id`

**Step 3: Post リポジトリ更新**

`post_repository.rb`: 全ての `cast_id` → `cast_user_id`
`like_repository.rb`: 全ての `guest_id` → `guest_user_id`

**Step 4: Relationship リポジトリ更新**

`follow_repository.rb`: `cast_id` → `cast_user_id`, `guest_id` → `guest_user_id`
`favorite_repository.rb`: 同上

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/*/repositories/*.rb
git commit -m "refactor: update repositories for user_id unification"
```

---

## Task 4: バックエンド Use Cases・Adapters・Presenters 更新

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/use_cases/` 配下全ファイル
- Modify: `services/monolith/workspace/slices/portfolio/presenters/` 配下全ファイル
- Modify: `services/monolith/workspace/slices/offer/use_cases/` 配下全ファイル
- Modify: `services/monolith/workspace/slices/post/use_cases/` 配下全ファイル
- Modify: `services/monolith/workspace/slices/relationship/use_cases/` 配下全ファイル
- Modify: `services/monolith/workspace/slices/feed/adapters/` 配下全ファイル
- Modify: `services/monolith/workspace/slices/feed/use_cases/` 配下全ファイル

**Step 1: 全 use_cases をグローバル検索して cast_id → cast_user_id, guest_id → guest_user_id に更新**

検索コマンド:
```bash
grep -rn "cast_id\|guest_id\|\.id\b" services/monolith/workspace/slices/*/use_cases/ --include="*.rb"
```

**Step 2: Feed adapters 更新**

`cast_adapter.rb`:
- `find_by_user_id` → user_id が PK なので `by_pk` で直接検索
- `get_user_ids_by_cast_ids` メソッドは不要（cast_id = user_id になるため）→ 削除

`guest_adapter.rb`:
- 同様に `get_user_ids_by_guest_ids` は不要 → 削除

**Step 3: Presenters 更新**

`cast/profile_presenter.rb`:
- `id` フィールドの出力を削除（user_id のみ）
- gallery_media の `cast_id` → `cast_user_id`

**Step 4: コミット**

```bash
git add services/monolith/workspace/slices/
git commit -m "refactor: update use cases, adapters, presenters for user_id unification"
```

---

## Task 5: バックエンド gRPC ハンドラー更新

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb`
- Modify: `services/monolith/workspace/slices/portfolio/grpc/guest_handler.rb`
- Modify: `services/monolith/workspace/slices/trust/grpc/trust_handler.rb`
- Modify: `services/monolith/workspace/slices/post/grpc/post_handler.rb`
- Modify: `services/monolith/workspace/slices/post/grpc/like_handler.rb`
- Modify: `services/monolith/workspace/slices/post/grpc/comment_handler.rb`
- Modify: `services/monolith/workspace/slices/relationship/grpc/follow_handler.rb`
- Modify: `services/monolith/workspace/slices/relationship/grpc/favorite_handler.rb`
- Modify: `services/monolith/workspace/slices/relationship/grpc/block_handler.rb`
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb`
- Modify: `services/monolith/workspace/slices/offer/grpc/offer_handler.rb`

**Step 1: 各ハンドラーの `my_cast.id` → `my_cast.user_id` を更新**

主な変更パターン:
- `cast.id` → `cast.user_id` (PK アクセス)
- `guest.id` → `guest.user_id` (PK アクセス)
- `find_my_cast!` の戻り値が `.user_id` を PK として持つようになる

**Step 2: Feed handler の簡素化**

`feed/grpc/handler.rb`:
- `get_blocked_user_ids` メソッド内の `cast_adapter.get_user_ids_by_cast_ids` / `guest_adapter.get_user_ids_by_guest_ids` が不要に
- ブロック ID がそのまま user_id になるため直接使用可能

**Step 3: Offer handler 更新**

`offer/grpc/offer_handler.rb`:
- `resolve_cast_id` → `resolve_cast_user_id` にリネーム
- `cast.id` → `cast.user_id`

**Step 4: Trust handler の簡素化**

`trust/grpc/trust_handler.rb`:
- `reviewer_profile_id` 関連のロジックを削除（guest.id が不要になるため）
- `guest_adapter.find_by_user_ids` のマッピングを簡素化

**Step 5: コミット**

```bash
git add services/monolith/workspace/slices/*/grpc/*.rb
git commit -m "refactor: update gRPC handlers for user_id unification"
```

---

## Task 6: Proto 定義更新

**Files:**
- Modify: `proto/portfolio/v1/cast_service.proto`
- Modify: `proto/portfolio/v1/guest_service.proto`
- Modify: `proto/offer/v1/service.proto`
- Modify: `proto/post/v1/service.proto`
- Modify: `proto/relationship/v1/follow_service.proto`
- Modify: `proto/relationship/v1/block_service.proto`
- Modify: `proto/relationship/v1/favorite_service.proto`
- Modify: `proto/feed/v1/feed_service.proto`
- Modify: `proto/trust/v1/service.proto`

**Step 1: Portfolio proto 更新**

`cast_service.proto`:
- `CastProfile.id` (field 23) を `reserved 23;` に変更
- `user_id` (field 1) が唯一の識別子

`guest_service.proto`:
- `GuestDetailProfile.id` (field 1) を削除
- `GetGuestProfileByIdRequest.guest_id` → `user_id` にリネーム

**Step 2: Trust proto 更新**

`trust/v1/service.proto`:
- `Review.reviewer_profile_id` (field 10) を `reserved 10;` に変更
- reviewer_id (user_id) で直接リンク可能に

**Step 3: Relationship proto 更新**

`follow_service.proto`:
- `FollowCastRequest.cast_id` → `cast_user_id`
- `FollowRequestItem.guest_id` → `guest_user_id`
- `FollowerItem.guest_id` → `guest_user_id`

`favorite_service.proto`:
- `AddFavoriteRequest.cast_id` → `cast_user_id`
- `GetFavoriteStatusRequest.cast_ids` → `cast_user_ids`

**Step 4: Other proto 更新**

`offer/v1/service.proto`: `GetPlansRequest.cast_id` → `cast_user_id`
`feed/v1/feed_service.proto`: `FeedPost.cast_id` → `cast_user_id`, `FeedAuthor.id` → `user_id`

**Step 5: Proto スタブ再生成**

Run (backend): `cd services/monolith/workspace && bundle exec rake proto:generate`
Run (frontend): `cd web/nyx/workspace && npm run proto:generate`

**Step 6: コミット**

```bash
git add proto/ services/monolith/workspace/lib/protos/ web/nyx/workspace/src/lib/gen/
git commit -m "refactor: update proto definitions for user_id unification"
```

---

## Task 7: フロントエンド型定義・API マッパー更新

**Files:**
- Modify: `web/nyx/workspace/src/modules/portfolio/types.ts`
- Modify: `web/nyx/workspace/src/modules/trust/types.ts`
- Modify: `web/nyx/workspace/src/modules/trust/lib/api-mappers.ts`

**Step 1: Portfolio types 更新**

`portfolio/types.ts`:
- `CastProfile.id` を削除、`userId` が PK
- `ApiProfile.id` を削除

**Step 2: Trust types 更新**

`trust/types.ts`:
- `Review.reviewerProfileId` を削除
- `reviewerId` (= user_id) でリンクを生成

`trust/lib/api-mappers.ts`:
- `reviewerProfileId` マッピングを削除

**Step 3: コミット**

```bash
git add web/nyx/workspace/src/modules/*/types.ts web/nyx/workspace/src/modules/trust/lib/
git commit -m "refactor: update frontend types for user_id unification"
```

---

## Task 8: フロントエンド Hooks 更新

**Files:**
- Modify: `web/nyx/workspace/src/modules/portfolio/hooks/useCastProfile.ts`
- Modify: `web/nyx/workspace/src/modules/trust/hooks/useInfiniteReviews.ts`
- Modify: `web/nyx/workspace/src/modules/trust/hooks/useReviewStats.ts`
- Modify: 他の trust/portfolio hooks

**Step 1: useCastProfile 更新**

- `profileId` プロパティを削除
- `userId` のみ返す（これが唯一の識別子）

**Step 2: Trust hooks 確認**

- `useInfiniteReviews` は既に `revieweeId` を使用（user_id ベース）→ 変更なし
- `useReviewStats` も同様

**Step 3: コミット**

```bash
git add web/nyx/workspace/src/modules/*/hooks/*.ts
git commit -m "refactor: update frontend hooks for user_id unification"
```

---

## Task 9: フロントエンド ページ・コンポーネント更新

**Files:**
- Modify: `web/nyx/workspace/src/app/(cast)/cast/guests/[id]/page.tsx` → `[userId]/page.tsx` にリネーム
- Modify: `web/nyx/workspace/src/app/(guest)/casts/[id]/page.tsx` → `[userId]/page.tsx` にリネーム
- Modify: `web/nyx/workspace/src/modules/trust/components/ReviewCard.tsx`
- Modify: `web/nyx/workspace/src/modules/trust/components/CastReviewsPage.tsx`
- Modify: `web/nyx/workspace/src/modules/trust/components/WriteTrustModal.tsx`

**Step 1: URL ルーティングのリネーム**

```bash
# ディレクトリ名変更
mv web/nyx/workspace/src/app/\(cast\)/cast/guests/\[id\] web/nyx/workspace/src/app/\(cast\)/cast/guests/\[userId\]
mv web/nyx/workspace/src/app/\(guest\)/casts/\[id\] web/nyx/workspace/src/app/\(guest\)/casts/\[userId\]
```

**Step 2: ページコンポーネント内のパラメータ名更新**

`cast/guests/[userId]/page.tsx`:
- `params.id` → `params.userId`
- `data.id` (profile ID) 参照を `data.userId` に統一
- ブロック操作も `data.userId` を使用

`(guest)/casts/[userId]/page.tsx`:
- `params.id` → `params.userId`
- `data.profile.id` 参照を `data.profile.userId` に統一

**Step 3: ReviewCard 更新**

`ReviewCard.tsx`:
- `review.reviewerProfileId` → `review.reviewerId` でリンク生成
- `/cast/guests/${review.reviewerProfileId}` → `/cast/guests/${review.reviewerId}`

**Step 4: CastReviewsPage 確認**

- `castId` prop は実際には user_id を受け取る（呼び出し元を更新）
- prop 名を `castUserId` にリネームすることを検討

**Step 5: コミット**

```bash
git add web/nyx/workspace/src/app/ web/nyx/workspace/src/modules/trust/components/
git commit -m "refactor: update frontend pages and components for user_id unification"
```

---

## Task 10: フロントエンド API ルート更新

**Files:**
- Modify: `web/nyx/workspace/src/app/api/cast/guests/[id]/route.ts` → `[userId]/route.ts` にリネーム
- Modify: 他の API ルートで `cast_id`/`guest_id` を使用しているもの

**Step 1: API ルートのリネーム**

```bash
mv web/nyx/workspace/src/app/api/cast/guests/\[id\] web/nyx/workspace/src/app/api/cast/guests/\[userId\]
```

**Step 2: ルート内のパラメータ参照更新**

`api/cast/guests/[userId]/route.ts`:
- `params.id` → `params.userId`
- gRPC リクエストの `guestId` → `userId` に変更

**Step 3: 他の API ルートでプロフィール ID を使っている箇所を全検索**

```bash
grep -rn "profileId\|profile_id\|\.id" web/nyx/workspace/src/app/api/ --include="*.ts"
```

**Step 4: コミット**

```bash
git add web/nyx/workspace/src/app/api/
git commit -m "refactor: update API routes for user_id unification"
```

---

## Task 11: フロントエンド全体リンク更新

**Files:**
- 全コンポーネントで `/cast/guests/[profileId]` → `/cast/guests/[userId]` のリンクを更新
- 全コンポーネントで `/casts/[profileId]` → `/casts/[userId]` のリンクを更新

**Step 1: グローバル検索でリンク更新箇所を特定**

```bash
grep -rn "cast/guests/" web/nyx/workspace/src/ --include="*.tsx" --include="*.ts"
grep -rn "/casts/" web/nyx/workspace/src/ --include="*.tsx" --include="*.ts"
```

**Step 2: 各リンクの ID ソースを user_id に変更**

**Step 3: コミット**

```bash
git add web/nyx/workspace/src/
git commit -m "refactor: update all profile links to use user_id"
```

---

## Task 12: シードデータ更新

**Files:**
- Modify: `services/monolith/workspace/config/db/seeds/bulk/generators/cast_generator.rb`
- Modify: `services/monolith/workspace/config/db/seeds/bulk/generators/guest_generator.rb`
- Modify: `services/monolith/workspace/config/db/seeds/bulk/generators/relationship_generator.rb`
- Modify: `services/monolith/workspace/config/db/seeds/bulk/generators/post_generator.rb`
- Modify: `services/monolith/workspace/config/db/seeds/bulk/generators/activity_generator.rb`
- Modify: `services/monolith/workspace/config/db/seeds/trust_reviews.rb`
- Modify: 他のシードファイル

**Step 1: cast_generator.rb 更新**

- `cast_ids` を返す際、profile_id ではなく user_id を返すように変更
- `assign_genres`, `assign_areas` 等で `cast_id:` → `cast_user_id:` に変更
- `create_plans`, `create_schedules` でも同様

**Step 2: guest_generator.rb 更新**

- `guest_ids` を返す際、user_id を返すように変更

**Step 3: relationship_generator.rb 更新**

- `cast_id:` → `cast_user_id:`, `guest_id:` → `guest_user_id:` に変更
- `build_cast_user_map` / `build_guest_user_map` は不要に（ID が統一されるため）

**Step 4: activity_generator.rb 更新**

- `build_cast_user_map` / `build_guest_user_map` を削除
- `cast_ids` / `guest_ids` がそのまま user_id なので直接使用
- `guest_id:` → `guest_user_id:` (likes)

**Step 5: シードを再生成して検証**

Run: `cd services/monolith/workspace && bundle exec rake db:seed:bulk`

**Step 6: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/
git commit -m "refactor: update seed data for user_id unification"
```

---

## Task 13: ドキュメント更新

**Files:**
- Modify: `services/handbooks/workspace/docs/domains/portfolio.md`
- Modify: `services/handbooks/workspace/docs/domains/identity.md`
- Modify: `services/handbooks/workspace/docs/domains/trust.md`
- Modify: `services/handbooks/workspace/docs/domains/relationship.md`
- Modify: `services/handbooks/workspace/docs/domains/post.md`
- Modify: `services/handbooks/workspace/docs/domains/feed.md`

**Step 1: Portfolio ドメインドキュメントに ID 統一の説明を追加**

```markdown
## ID Convention

cast/guest テーブルは `user_id` を PK として使用。
`identity__users.id` = `portfolio__casts.user_id`(PK) = `portfolio__guests.user_id`(PK)

全ての FK カラムは `cast_user_id` / `guest_user_id` で統一。
```

**Step 2: 各ドメインのテーブル定義を更新**

**Step 3: コミット**

```bash
git add services/handbooks/
git commit -m "docs: update domain documentation for user_id unification"
```

---

## Task 14: 最終検証

**Step 1: バックエンドのテスト実行**

Run: `cd services/monolith/workspace && bundle exec rspec`

**Step 2: フロントエンドのビルド確認**

Run: `cd web/nyx/workspace && npm run build`

**Step 3: Proto の整合性確認**

Run: `cd services/monolith/workspace && bundle exec rake proto:generate`
Run: `cd web/nyx/workspace && npm run proto:generate`

**Step 4: シードデータの再生成テスト**

Run: `cd services/monolith/workspace && bundle exec rake db:reset && bundle exec rake db:seed:bulk`

**Step 5: 最終コミット（あれば）**

```bash
git add -A
git commit -m "fix: address remaining issues from user_id unification"
```
