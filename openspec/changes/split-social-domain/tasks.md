# Tasks: split-social-domain

## Overview

Social ドメインを Media / Post / Relationship / Feed の 4 ドメインに分割する。

**Estimated Tasks**: 55
**Dependencies**: なし（既存機能の分割のため）

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

### 1.1 Proto Creation (Media)

- [ ] `proto/media/v1/` ディレクトリを作成
- [ ] `media_service.proto` を作成（UploadMedia, DeleteMedia, GetMedia, GetMediaBatch）
- [ ] proto をビルドして生成コードを確認

### 1.2 Backend Implementation (Media)

- [ ] `slices/media/` ディレクトリ構造を作成
- [ ] `slices/media/relations/files.rb` を作成
- [ ] `slices/media/repositories/media_repository.rb` を作成
- [ ] `slices/media/use_cases/upload_media.rb` を実装
- [ ] `slices/media/use_cases/delete_media.rb` を実装
- [ ] `slices/media/use_cases/get_media.rb` を実装
- [ ] `slices/media/handlers/media_service.rb` を実装
- [ ] slice 設定ファイル（`config/slices/media.rb`）を作成
- [ ] テストを作成・実行

### 1.3 Frontend Implementation (Media)

- [ ] `modules/media/` ディレクトリを作成
- [ ] `useMediaUpload.ts` を作成
- [ ] `useMedia.ts` を作成
- [ ] `MediaUploader` コンポーネントを作成
- [ ] `MediaPreview` コンポーネントを作成
- [ ] 既存の投稿・コメントフォームから Media API を利用するよう更新
- [ ] 動作確認

---

## Phase 2: Relationship Domain Separation

### 2.1 Proto Migration (Relationship)

- [ ] `proto/relationship/v1/` ディレクトリを作成
- [ ] `follow_service.proto` を `relationship/v1/` にコピー（package を `relationship.v1` に変更）
- [ ] `block_service.proto` を `relationship/v1/` にコピー
- [ ] `favorite_service.proto` を `relationship/v1/` にコピー
- [ ] proto をビルドして生成コードを確認

### 2.2 Backend Migration (Relationship)

- [ ] `slices/relationship/` ディレクトリ構造を作成
- [ ] `slices/social/handlers/follow_service.rb` を移動
- [ ] `slices/social/handlers/block_service.rb` を移動
- [ ] `slices/social/handlers/favorite_service.rb` を移動
- [ ] `slices/social/use_cases/follows/` を移動
- [ ] `slices/social/use_cases/blocks/` を移動
- [ ] `slices/social/use_cases/favorites/` を移動
- [ ] `slices/social/repositories/follow_repository.rb` を移動
- [ ] `slices/social/repositories/block_repository.rb` を移動
- [ ] `slices/social/repositories/favorite_repository.rb` を移動
- [ ] 関連する relations を移動
- [ ] slice 設定ファイル（`config/slices/relationship.rb`）を作成
- [ ] テストを実行して動作確認

### 2.3 Frontend Migration (Relationship)

- [ ] `modules/relationship/` ディレクトリを作成
- [ ] `useFollow.ts` を移動
- [ ] `useBlock.ts` を移動
- [ ] `useFavorite.ts` を移動
- [ ] `useFollowRequests.ts` を移動
- [ ] import パスを更新
- [ ] 動作確認

---

## Phase 3: Post Domain Separation

### 3.1 Proto Migration (Post)

- [ ] `proto/post/v1/` ディレクトリを作成
- [ ] `post_service.proto` を `post/v1/` にコピー（package を `post.v1` に変更）
- [ ] `like_service.proto` を `post/v1/` にコピー
- [ ] `comment_service.proto` を `post/v1/` にコピー
- [ ] `ListPublicPosts` に `exclude_user_ids` パラメータを追加
- [ ] proto をビルドして生成コードを確認

### 3.2 Backend Migration (Post)

- [ ] `slices/post/` ディレクトリ構造を作成
- [ ] `slices/social/handlers/post_service.rb` を移動
- [ ] `slices/social/handlers/like_service.rb` を移動
- [ ] `slices/social/handlers/comment_service.rb` を移動
- [ ] `slices/social/use_cases/posts/` を移動
- [ ] `slices/social/use_cases/likes/` を移動
- [ ] `slices/social/use_cases/comments/` を移動
- [ ] 関連するリポジトリ・relations を移動
- [ ] Post が Media ドメインを利用するよう更新
- [ ] `ListPublicPosts` に除外フィルタを実装
- [ ] slice 設定ファイル（`config/slices/post.rb`）を作成
- [ ] テストを実行して動作確認

### 3.3 Frontend Migration (Post)

- [ ] `modules/post/` ディレクトリを作成
- [ ] `useCastPosts.ts` を移動
- [ ] `useLike.ts` を移動
- [ ] `useComments.ts` を移動
- [ ] コメント関連コンポーネントを移動
- [ ] import パスを更新
- [ ] 動作確認

---

## Phase 4: Feed Domain Creation

### 4.1 Proto Creation (Feed)

- [ ] `proto/feed/v1/feed_service.proto` を作成
- [ ] `ListGuestFeed` RPC を定義（filter: all/following/favorites）
- [ ] `ListCastFeed` RPC を定義
- [ ] proto をビルドして生成コードを確認

### 4.2 Backend Implementation (Feed)

- [ ] `slices/feed/` ディレクトリ構造を作成
- [ ] `adapters/post_adapter.rb` を作成（Post ドメインへの問い合わせ）
- [ ] `adapters/relationship_adapter.rb` を作成（Relationship ドメインへの問い合わせ）
- [ ] `use_cases/list_guest_feed.rb` を実装
- [ ] `use_cases/list_cast_feed.rb` を実装
- [ ] `handlers/feed_service.rb` を実装
- [ ] slice 設定ファイル（`config/slices/feed.rb`）を作成
- [ ] テストを作成・実行

### 4.3 Frontend Migration (Feed)

- [ ] `modules/feed/` ディレクトリを作成
- [ ] `useGuestFeed.ts` を作成（新規、Feed API を呼び出す）
- [ ] `useCastFeed.ts` を移動・更新
- [ ] `TimelineFeed` コンポーネントを移動
- [ ] API 呼び出しを Feed ドメインに切り替え
- [ ] 動作確認

---

## Phase 5: Cleanup

### 5.1 Social Domain Removal

- [ ] `slices/social/` の残りファイルが空であることを確認
- [ ] `slices/social/` を削除
- [ ] `proto/social/v1/` を deprecated ディレクトリに移動（または削除）
- [ ] 旧 import を検索して残っていないことを確認

### 5.2 Documentation Update

- [ ] `services/handbooks/workspace/docs/domains/social.md` を削除
- [ ] `services/handbooks/workspace/docs/domains/media.md` を作成
- [ ] `services/handbooks/workspace/docs/domains/post.md` を作成
- [ ] `services/handbooks/workspace/docs/domains/relationship.md` を作成
- [ ] `services/handbooks/workspace/docs/domains/feed.md` を作成
- [ ] `services/handbooks/workspace/docs/domains/README.md` を更新
- [ ] `openspec/project.md` のドメイン一覧を更新

### 5.3 Final Verification

- [ ] 全テストがパスすることを確認
- [ ] メディアアップロード機能の動作確認
- [ ] ゲストフィードの表示確認（all/following/favorites）
- [ ] キャストフィード管理の表示確認
- [ ] フォロー・ブロック・お気に入り機能の動作確認
- [ ] いいね・コメント機能の動作確認

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
