# Tasks: split-social-domain

## Overview

Social ドメインを Post / Relationship / Feed の 3 ドメインに分割する。

**Estimated Tasks**: 45
**Dependencies**: なし（既存機能の分割のため）

---

## Phase 0: Database Schema Migration

### 0.1 Schema Creation

- [ ] `post` スキーマを作成
- [ ] `relationship` スキーマを作成
- [ ] `feed` スキーマを作成（将来のキャッシュ用、現時点ではテーブルなし）

### 0.2 Post Schema Migration

- [ ] `public.cast_posts` → `post.posts` に移動・リネーム
- [ ] `public.cast_post_media` → `post.media` に移動・リネーム
- [ ] `public.cast_post_hashtags` → `post.hashtags` に移動・リネーム
- [ ] `public.post_likes` → `post.likes` に移動・リネーム
- [ ] `public.post_comments` → `post.comments` に移動・リネーム
- [ ] `public.comment_media` → `post.comment_media` に移動・リネーム
- [ ] 外部キー制約を更新
- [ ] インデックスを再作成

### 0.3 Relationship Schema Migration

- [ ] `public.cast_follows` → `relationship.follows` に移動・リネーム
- [ ] `public.blocks` → `relationship.blocks` に移動・リネーム
- [ ] `public.cast_favorites` → `relationship.favorites` に移動・リネーム
- [ ] 外部キー制約を更新
- [ ] インデックスを再作成

### 0.4 Application Layer Update

- [ ] ROM relations の `schema` 設定を更新（`post` スキーマ用）
- [ ] ROM relations の `schema` 設定を更新（`relationship` スキーマ用）
- [ ] シードデータのテーブル参照を更新
- [ ] テストを実行して動作確認

---

## Phase 1: Relationship Domain Separation

### 1.1 Proto Migration (Relationship)

- [ ] `proto/relationship/v1/` ディレクトリを作成
- [ ] `follow_service.proto` を `relationship/v1/` にコピー（package を `relationship.v1` に変更）
- [ ] `block_service.proto` を `relationship/v1/` にコピー
- [ ] `favorite_service.proto` を `relationship/v1/` にコピー
- [ ] proto をビルドして生成コードを確認

### 1.2 Backend Migration (Relationship)

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

### 1.3 Frontend Migration (Relationship)

- [ ] `modules/relationship/` ディレクトリを作成
- [ ] `useFollow.ts` を移動
- [ ] `useBlock.ts` を移動
- [ ] `useFavorite.ts` を移動
- [ ] `useFollowRequests.ts` を移動
- [ ] import パスを更新
- [ ] 動作確認

---

## Phase 2: Post Domain Separation

### 2.1 Proto Migration (Post)

- [ ] `proto/post/v1/` ディレクトリを作成
- [ ] `post_service.proto` を `post/v1/` にコピー（package を `post.v1` に変更）
- [ ] `like_service.proto` を `post/v1/` にコピー
- [ ] `comment_service.proto` を `post/v1/` にコピー
- [ ] `ListPublicPosts` に `exclude_user_ids` パラメータを追加
- [ ] proto をビルドして生成コードを確認

### 2.2 Backend Migration (Post)

- [ ] `slices/post/` ディレクトリ構造を作成
- [ ] `slices/social/handlers/post_service.rb` を移動
- [ ] `slices/social/handlers/like_service.rb` を移動
- [ ] `slices/social/handlers/comment_service.rb` を移動
- [ ] `slices/social/use_cases/posts/` を移動
- [ ] `slices/social/use_cases/likes/` を移動
- [ ] `slices/social/use_cases/comments/` を移動
- [ ] 関連するリポジトリ・relations を移動
- [ ] `ListPublicPosts` に除外フィルタを実装
- [ ] slice 設定ファイル（`config/slices/post.rb`）を作成
- [ ] テストを実行して動作確認

### 2.3 Frontend Migration (Post)

- [ ] `modules/post/` ディレクトリを作成
- [ ] `useCastPosts.ts` を移動
- [ ] `useLike.ts` を移動
- [ ] `useComments.ts` を移動
- [ ] コメント関連コンポーネントを移動
- [ ] import パスを更新
- [ ] 動作確認

---

## Phase 3: Feed Domain Creation

### 3.1 Proto Creation (Feed)

- [ ] `proto/feed/v1/feed_service.proto` を作成
- [ ] `ListGuestFeed` RPC を定義（filter: all/following/favorites）
- [ ] `ListCastFeed` RPC を定義
- [ ] proto をビルドして生成コードを確認

### 3.2 Backend Implementation (Feed)

- [ ] `slices/feed/` ディレクトリ構造を作成
- [ ] `adapters/post_adapter.rb` を作成（Post ドメインへの問い合わせ）
- [ ] `adapters/relationship_adapter.rb` を作成（Relationship ドメインへの問い合わせ）
- [ ] `use_cases/list_guest_feed.rb` を実装
- [ ] `use_cases/list_cast_feed.rb` を実装
- [ ] `handlers/feed_service.rb` を実装
- [ ] slice 設定ファイル（`config/slices/feed.rb`）を作成
- [ ] テストを作成・実行

### 3.3 Frontend Migration (Feed)

- [ ] `modules/feed/` ディレクトリを作成
- [ ] `useGuestFeed.ts` を作成（新規、Feed API を呼び出す）
- [ ] `useCastFeed.ts` を移動・更新
- [ ] `TimelineFeed` コンポーネントを移動
- [ ] API 呼び出しを Feed ドメインに切り替え
- [ ] 動作確認

---

## Phase 4: Cleanup

### 4.1 Social Domain Removal

- [ ] `slices/social/` の残りファイルが空であることを確認
- [ ] `slices/social/` を削除
- [ ] `proto/social/v1/` を deprecated ディレクトリに移動（または削除）
- [ ] 旧 import を検索して残っていないことを確認

### 4.2 Documentation Update

- [ ] `services/handbooks/workspace/docs/domains/social.md` を削除
- [ ] `services/handbooks/workspace/docs/domains/post.md` を作成
- [ ] `services/handbooks/workspace/docs/domains/relationship.md` を作成
- [ ] `services/handbooks/workspace/docs/domains/feed.md` を作成
- [ ] `services/handbooks/workspace/docs/domains/README.md` を更新
- [ ] `openspec/project.md` のドメイン一覧を更新

### 4.3 Final Verification

- [ ] 全テストがパスすることを確認
- [ ] ゲストフィードの表示確認（all/following/favorites）
- [ ] キャストフィード管理の表示確認
- [ ] フォロー・ブロック・お気に入り機能の動作確認
- [ ] いいね・コメント機能の動作確認

---

## Parallel Work Opportunities

以下のタスクは並列実行可能：

- Phase 1.1 (Proto) と Phase 1.2 (Backend) の準備作業
- Phase 2.1 (Proto) と Phase 2.2 (Backend) の準備作業
- Phase 1.3 (Frontend) と Phase 2.2 (Backend) は独立

## Dependencies

```
Phase 0 → Phase 1, Phase 2（DB マイグレーションが先）
Phase 1.1 → Phase 1.2 → Phase 1.3
Phase 2.1 → Phase 2.2 → Phase 2.3
Phase 1 + Phase 2 → Phase 3
Phase 3 → Phase 4
```

## Rollback Plan

各 Phase 完了後に動作確認を行い、問題があれば git revert で戻す。
Phase 間で独立したブランチを作成し、段階的にマージする。
