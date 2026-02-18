# Tasks: unify-media-service

## Phase 1: Post Domain (Post/Comment) ✅

### 1.1 Database Schema
- [x] `post__post_media` に `media_id` カラム追加（nullable、移行後に NOT NULL）
- [x] `post__comment_media` に `media_id` カラム追加（nullable、移行後に NOT NULL）
- [x] `url` カラムを nullable に変更（移行後に削除予定）
- [x] インデックス追加

### 1.2 Backend (Relations/Repository)
- [x] `post_media.rb` に `media_id` 属性追加
- [x] `comment_media.rb` に `media_id` 属性追加
- [x] Repository は汎用的なので変更不要（media_id を含むデータを受け入れ可能）

### 1.3 Backend (Presenter)
- [x] `post_presenter.rb` で `media_files` ハッシュから URL 取得
- [x] `comment_presenter.rb` で同様の実装
- [x] `feed_presenter.rb` で同様の実装

### 1.4 Proto + Handler
- [x] `CastPostMedia` に `media_id` フィールド追加
- [x] `CommentMedia` に `media_id` フィールド追加
- [x] `FeedMedia` に `media_id` フィールド追加
- [x] `PostHandler` で `media_id` を使用して保存
- [x] `CommentHandler` で `media_id` を使用して保存
- [x] `MediaAdapter` 作成（Post/Feed スライス用）

### 1.5 Tests (必須)
- [x] `post_repository_spec.rb` - media_id 保存テスト
- [x] `post_presenter_spec.rb` - media_files から URL 取得テスト
- [x] `feed_presenter_spec.rb` - media_files から URL 取得テスト

---

## Phase 2: Portfolio Cast Domain

### 2.1 Database Schema
- [ ] `portfolio__casts` に `profile_media_id`, `avatar_media_id` カラム追加（NOT NULL）
- [ ] `portfolio__cast_gallery_media` テーブル作成
- [ ] 旧カラム `image_path`, `avatar_path`, `images` を削除
- [ ] インデックス追加

### 2.2 Backend (Relations/Repository)
- [ ] `casts.rb` を `profile_media_id`, `avatar_media_id` のみに変更
- [ ] `cast_gallery_media.rb` リレーション作成
- [ ] `cast_repository.rb` の `save_images` を `media_id` ベースに更新

### 2.3 Backend (Handler/UseCase)
- [ ] `cast_handler.rb` で `media_id` を受け取るよう更新
- [ ] `save_images.rb` を media_id ベースに更新
- [ ] `get_upload_url.rb` を削除

### 2.4 Backend (Presenter)
- [ ] `profile_presenter.rb` で Media 参照から URL 取得

### 2.5 Proto
- [ ] `SaveCastImagesRequest` を media_id ベースに変更
- [ ] `CastService.GetUploadUrl` を削除

### 2.6 Frontend
- [ ] `/api/cast/onboarding/upload-url` を削除
- [ ] `/api/media/upload-url` を使用するよう変更
- [ ] `SaveCastImages` API 呼び出しで media_id を送信

### 2.7 Tests (必須)
- [ ] `casts_spec.rb` - media_id カラムテスト
- [ ] `cast_gallery_media_spec.rb` - リレーションテスト
- [ ] `cast_repository_spec.rb` - save_images テスト
- [ ] `profile_presenter_spec.rb` - URL 生成テスト
- [ ] `cast_handler_spec.rb` - SaveCastImages テスト

---

## Phase 3: Portfolio Guest Domain

### 3.1 Database Schema
- [ ] `portfolio__guests` に `avatar_media_id` カラム追加（NOT NULL）
- [ ] 旧カラム `avatar_path` を削除

### 3.2 Backend
- [ ] `guests.rb` を `avatar_media_id` のみに変更
- [ ] `guest_handler.rb` で media_id を受け取るよう更新
- [ ] `profile_presenter.rb` (guest) で Media 参照から URL 取得
- [ ] `get_upload_url` を削除

### 3.3 Proto
- [ ] `SaveGuestProfileRequest` を avatar_media_id ベースに変更
- [ ] `GuestService.GetUploadUrl` を削除

### 3.4 Frontend
- [ ] `/api/guest/upload-url` を削除
- [ ] `/api/media/upload-url` を使用するよう変更

### 3.5 Tests (必須)
- [ ] `guests_spec.rb` - avatar_media_id カラムテスト
- [ ] `guest_profile_presenter_spec.rb` - URL 生成テスト
- [ ] `guest_handler_spec.rb` - プロフィール保存テスト

---

## Phase 4: Data Migration

### 4.1 Migration Script
- [ ] post_media.url → media__files 移行 + media_id 設定
- [ ] comment_media.url → 同上
- [ ] casts.image_path/avatar_path/images → 同上
- [ ] guests.avatar_path → 同上

### 4.2 Migration Tests (必須)
- [ ] マイグレーションスクリプトのユニットテスト
- [ ] データ整合性チェックテスト
- [ ] URL 生成結果の一致確認テスト

### 4.3 Execution
- [ ] テスト環境でマイグレーション実行・検証
- [ ] 本番環境でマイグレーション実行
- [ ] 動作確認

---

## Phase 5: Cleanup

### 5.1 Delete Legacy Code
- [ ] `Portfolio::UseCases::Images::GetUploadUrl` 削除
- [ ] `Portfolio::UseCases::Cast::Images::GetUploadUrl` 削除
- [ ] Frontend の旧 API ルート削除

### 5.2 Delete Legacy Columns (マイグレーション後)
- [ ] `post_media.url`, `post_media.thumbnail_url` 削除
- [ ] `comment_media.url`, `comment_media.thumbnail_url` 削除
- [ ] `casts.image_path`, `casts.avatar_path`, `casts.images` 削除
- [ ] `guests.avatar_path` 削除
