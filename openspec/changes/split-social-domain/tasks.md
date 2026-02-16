# Tasks: split-social-domain

## Overview

Social ドメインを Media / Post / Relationship / Feed の 4 ドメインに分割する。

**Status**: Backend 完了 ✅ / Frontend 未着手
**Estimated Tasks**: 55
**Dependencies**: なし（既存機能の分割のため）

### Progress Summary

| Phase | Backend | Frontend |
|-------|---------|----------|
| Phase 0: DB Migration | ✅ Complete | N/A |
| Phase 1: Media | ✅ Complete | ⏳ Pending |
| Phase 2: Relationship | ✅ Complete | ⏳ Pending |
| Phase 3: Post | ✅ Complete | ⏳ Pending |
| Phase 4: Feed | ✅ Complete | ⏳ Pending |
| Phase 5: Cleanup | ✅ Complete | N/A |

### Commits

- `394242a` feat(social): split schema into media/post/relationship (Phase 0)
- `c702177` feat(media): add Media domain with unified media service (Phase 1)
- `67d5c3b` feat(relationship): add Relationship domain with follow/block/favorite services (Phase 2)
- `5eb362b` feat(post): add Post domain with post/like/comment services (Phase 3)
- `189fc1f` feat(feed): add Feed domain with guest/cast feed services (Phase 4)
- `3c63665` test: add tests for Post, Relationship, and Feed domains
- `dce2bae` refactor: remove Social slice, migrate to new domain structure (Phase 5)

---

## Phase 0: Database Schema Migration ✅

> **Note**: Simple Approach を採用。メディアテーブルの統合は Phase 1 で行う。

### 0.1 Schema Creation

- [x] `media` スキーマを作成
- [x] `post` スキーマを作成
- [x] `relationship` スキーマを作成
- [x] `feed` スキーマを作成（将来のキャッシュ用、現時点ではテーブルなし）

### 0.2 Media Schema Migration

- [ ] ~~`media.files` テーブルを作成（統一メディアテーブル）~~ → Phase 1 で実施
- [ ] ~~`public.cast_post_media` のデータを `media.files` にマイグレーション~~ → Phase 1 で実施
- [ ] ~~`public.comment_media` のデータを `media.files` にマイグレーション~~ → Phase 1 で実施
- [ ] ~~インデックスを作成~~ → Phase 1 で実施

### 0.3 Post Schema Migration

- [x] `social.cast_posts` → `post.posts` に移動・リネーム
- [x] `social.cast_post_hashtags` → `post.hashtags` に移動・リネーム
- [x] `social.post_likes` → `post.likes` に移動・リネーム
- [x] `social.post_comments` → `post.comments` に移動・リネーム
- [x] `social.cast_post_media` → `post.post_media` に移動・リネーム（構造維持）
- [x] `social.comment_media` → `post.comment_media` に移動（構造維持）
- [x] 外部キー制約は自動で更新される（PostgreSQL SET SCHEMA）
- [x] インデックスは自動で維持される

### 0.4 Relationship Schema Migration

- [x] `social.cast_follows` → `relationship.follows` に移動・リネーム
- [x] `social.blocks` → `relationship.blocks` に移動
- [x] `social.cast_favorites` → `relationship.favorites` に移動・リネーム
- [x] 外部キー制約は自動で更新される
- [x] インデックスは自動で維持される

### 0.5 Application Layer Update

- [x] ROM relations の `schema` 設定を更新（`post` スキーマ用）
- [x] ROM relations の `schema` 設定を更新（`relationship` スキーマ用）
- [x] シードデータのテーブル参照を更新
- [x] テストファイルのテーブル参照を更新
- [x] テストを実行して動作確認（540 examples, 0 failures）

---

## Phase 1: Media Domain Separation

### 1.1 Proto Creation (Media) ✅

- [x] `proto/media/v1/` ディレクトリを作成
- [x] `media_service.proto` を作成（GetUploadUrl, RegisterMedia, GetMedia, GetMediaBatch, DeleteMedia）
- [x] proto をビルドして生成コードを確認（Ruby + TypeScript）

### 1.2 Backend Implementation (Media) ✅

- [x] `slices/media/` ディレクトリ構造を作成
- [x] `media.files` テーブルのマイグレーションを作成
- [x] `slices/media/relations/files.rb` を作成
- [x] `slices/media/repositories/media_repository.rb` を作成
- [x] `slices/media/use_cases/get_upload_url.rb` を実装
- [x] `slices/media/use_cases/register_media.rb` を実装
- [x] `slices/media/use_cases/get_media.rb` を実装
- [x] `slices/media/use_cases/get_media_batch.rb` を実装
- [x] `slices/media/use_cases/delete_media.rb` を実装
- [x] `slices/media/grpc/handler.rb` を実装
- [x] `slices/media/presenters/media_presenter.rb` を作成
- [x] テストを作成・実行（548 examples, 0 failures）

### 1.3 Frontend Implementation (Media) 🚧

- [x] `modules/media/` ディレクトリを作成
- [x] `modules/media/types.ts` 型定義を作成
- [x] `modules/media/lib/mappers.ts` マッパーを作成
- [x] `modules/media/hooks/useMediaUpload.ts` を作成
- [x] `modules/media/hooks/useMedia.ts` を作成
- [x] `app/api/media/` API routes を作成
- [x] `lib/grpc.ts` に mediaClient を追加
- [ ] `MediaUploader` コンポーネントを作成
- [ ] `MediaPreview` コンポーネントを作成
- [ ] 既存の投稿・コメントフォームから Media API を利用するよう更新
- [ ] 動作確認

---

## Phase 2: Relationship Domain Separation

### 2.1 Proto Migration (Relationship) ✅

- [x] `proto/relationship/v1/` ディレクトリを作成
- [x] `follow_service.proto` を `relationship/v1/` にコピー（package を `relationship.v1` に変更）
- [x] `block_service.proto` を `relationship/v1/` にコピー
- [x] `favorite_service.proto` を `relationship/v1/` にコピー
- [x] proto をビルドして生成コードを確認

### 2.2 Backend Migration (Relationship) ✅

- [x] `slices/relationship/` ディレクトリ構造を作成
- [x] `slices/social/handlers/follow_service.rb` を移動
- [x] `slices/social/handlers/block_service.rb` を移動
- [x] `slices/social/handlers/favorite_service.rb` を移動
- [x] `slices/social/use_cases/follows/` を移動
- [x] `slices/social/use_cases/blocks/` を移動
- [x] `slices/social/use_cases/favorites/` を移動
- [x] `slices/social/repositories/follow_repository.rb` を移動
- [x] `slices/social/repositories/block_repository.rb` を移動
- [x] `slices/social/repositories/favorite_repository.rb` を移動
- [x] 関連する relations を移動
- [x] slice 設定ファイル（`config/slices/relationship.rb`）を作成
- [x] テストを実行して動作確認（548 examples, 0 failures）

### 2.3 Frontend Migration (Relationship)

> Note: Frontend は Phase 3 完了後に Relationship API への移行を実施

- [ ] `modules/relationship/` ディレクトリを作成
- [ ] `useFollow.ts` を移動
- [ ] `useBlock.ts` を移動
- [ ] `useFavorite.ts` を移動
- [ ] `useFollowRequests.ts` を移動
- [ ] import パスを更新
- [ ] 動作確認

---

## Phase 3: Post Domain Separation

### 3.1 Proto Migration (Post) ✅

- [x] `proto/post/v1/` ディレクトリを作成
- [x] `post_service.proto` を `post/v1/` にコピー（package を `post.v1` に変更）
- [x] `like_service.proto` を `post/v1/` にコピー
- [x] `comment_service.proto` を `post/v1/` にコピー
- [x] `ListCastPosts` に `exclude_cast_ids` パラメータを追加
- [x] proto をビルドして生成コードを確認

### 3.2 Backend Migration (Post) ✅

- [x] `slices/post/` ディレクトリ構造を作成
- [x] `slices/social/handlers/post_service.rb` を移動
- [x] `slices/social/handlers/like_service.rb` を移動
- [x] `slices/social/handlers/comment_service.rb` を移動
- [x] `slices/social/use_cases/posts/` を移動
- [x] `slices/social/use_cases/likes/` を移動
- [x] `slices/social/use_cases/comments/` を移動
- [x] 関連するリポジトリ・relations を移動
- [x] Post が Relationship ドメインを利用するよう更新（adapters/relationship_adapter.rb）
- [x] `ListCastPosts` に除外フィルタを実装（exclude_cast_ids）
- [x] slice 設定ファイル（Hanami 2.x 自動検出）
- [x] テストを実行して動作確認（548 examples, 0 failures）

### 3.3 Frontend Migration (Post)

> Note: Frontend は Phase 4 完了後に Post API への移行を実施

- [ ] `modules/post/` ディレクトリを作成
- [ ] `useCastPosts.ts` を移動
- [ ] `useLike.ts` を移動
- [ ] `useComments.ts` を移動
- [ ] コメント関連コンポーネントを移動
- [ ] import パスを更新
- [ ] 動作確認

---

## Phase 4: Feed Domain Creation

### 4.1 Proto Creation (Feed) ✅

- [x] `proto/feed/v1/feed_service.proto` を作成
- [x] `ListGuestFeed` RPC を定義（filter: all/following/favorites）
- [x] `ListCastFeed` RPC を定義
- [x] proto をビルドして生成コードを確認

### 4.2 Backend Implementation (Feed) ✅

- [x] `slices/feed/` ディレクトリ構造を作成
- [x] `adapters/post_adapter.rb` を作成（Post ドメインへの問い合わせ）
- [x] `adapters/relationship_adapter.rb` を作成（Relationship ドメインへの問い合わせ）
- [x] `adapters/cast_adapter.rb` を作成（Portfolio ドメインへの問い合わせ）
- [x] `adapters/guest_adapter.rb` を作成（Portfolio ドメインへの問い合わせ）
- [x] `use_cases/list_guest_feed.rb` を実装
- [x] `use_cases/list_cast_feed.rb` を実装
- [x] `grpc/handler.rb` を実装（FeedService）
- [x] `presenters/feed_presenter.rb` を作成
- [x] テストを実行して動作確認（548 examples, 0 failures）

### 4.3 Frontend Migration (Feed)

> Note: Frontend は Phase 5 (Cleanup) 完了後に Feed API への移行を実施

- [ ] `modules/feed/` ディレクトリを作成
- [ ] `useGuestFeed.ts` を作成（新規、Feed API を呼び出す）
- [ ] `useCastFeed.ts` を移動・更新
- [ ] `TimelineFeed` コンポーネントを移動
- [ ] API 呼び出しを Feed ドメインに切り替え
- [ ] 動作確認

---

## Phase 5: Cleanup ✅

### 5.1 Social Domain Removal ✅

- [x] `slices/social/` の残りファイルが空であることを確認
- [x] `slices/social/` を削除
- [x] `proto/social/v1/` を削除
- [x] `stubs/social/v1/` を削除（Ruby + TypeScript）
- [x] `spec/slices/social/` を削除
- [x] `bin/grpc` から Social service bindings を削除
- [x] `Portfolio::Adapters::SocialAdapter` を `Relationship::Slice` に更新
- [x] 旧 import を検索して残っていないことを確認

### 5.2 Documentation Update ✅

- [x] `services/handbooks/workspace/docs/domains/social.md` を削除
- [x] `services/handbooks/workspace/docs/domains/media.md` を作成
- [x] `services/handbooks/workspace/docs/domains/post.md` を作成
- [x] `services/handbooks/workspace/docs/domains/relationship.md` を作成
- [x] `services/handbooks/workspace/docs/domains/feed.md` を作成
- [x] `services/handbooks/workspace/docs/domains/README.md` を更新
- [x] `openspec/project.md` のドメイン一覧を更新

### 5.3 Final Verification ✅

- [x] 全テストがパスすることを確認（349 examples, 0 failures）
- [ ] メディアアップロード機能の動作確認（E2E）
- [ ] ゲストフィードの表示確認（E2E）
- [ ] キャストフィード管理の表示確認（E2E）
- [ ] フォロー・ブロック・お気に入り機能の動作確認（E2E）
- [ ] いいね・コメント機能の動作確認（E2E）

---

## Parallel Work Opportunities

以下のタスクは並列実行可能：

- Phase 1 (Media) 完了後、Phase 2 (Relationship) と Phase 3 (Post) は並列実行可能
- 各 Phase 内の Proto と Backend の準備作業
- Frontend Migration は Backend 完了後に実行

## Dependencies

```
Phase 0 → Phase 1, Phase 2, Phase 3（DB マイグレーションが先）
Phase 1 → Phase 3（Post が Media を利用）
Phase 2.1 → Phase 2.2 → Phase 2.3
Phase 3.1 → Phase 3.2 → Phase 3.3
Phase 2 + Phase 3 → Phase 4
Phase 4 → Phase 5
```

## Rollback Plan

各 Phase 完了後に動作確認を行い、問題があれば git revert で戻す。
Phase 間で独立したブランチを作成し、段階的にマージする。
