## 1. Proto Definition

- [x] 1.1 `proto/portfolio/v1/guest.proto` を新規作成
  - `GuestProfile` メッセージ定義（user_id, name, avatar_path, avatar_url）
  - `GetGuestProfileRequest/Response`
  - `SaveGuestProfileRequest/Response`
  - `GetUploadUrlRequest/Response`（CastService と同じメッセージを再利用）
  - `GuestService` サービス定義
- [x] 1.2 Proto をビルドして TypeScript/Ruby コードを生成

## 2. Database Schema

- [x] 2.1 `portfolio__guests` テーブルのマイグレーション作成
  ```ruby
  create_table :portfolio__guests do
    column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
    column :user_id, :uuid, null: false
    column :name, String, null: false        # キャストと同じフィールド名
    column :avatar_path, String
    column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
    column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP

    index :user_id, unique: true
  end
  ```
- [x] 2.2 マイグレーション実行

## 3. Backend Implementation

### 3.A Handler リファクタリング Phase 1（本変更スコープ）

- [x] 3.A.1 `slices/portfolio/grpc/handler.rb` を基底クラスとして再構成
  - 共通処理のみ残す（`handle_upload_url(prefix:)` 等）
  - `include ::Grpc::Authenticatable`
  - UseCase を `use_cases.images.get_upload_url` に移動（共通化）
- [x] 3.A.2 `slices/portfolio/grpc/cast_handler.rb` 新規作成
  - `class CastHandler < Handler`
  - 既存 handler.rb の CastService 固有ロジックを移動
  - 独自の `authenticate_user!` を削除
  - `get_upload_url` → `handle_upload_url(prefix: "casts")`
- [x] 3.A.3 テストファイル分離（`handler_spec.rb` → `cast_handler_spec.rb`）

> **Phase 2（将来、cast_handler が500行超になったら）:**
> アクションをモジュールに切り出し（`cast/profile_actions.rb` 等）。
> 本変更のスコープ外。

### 3.B Guest 実装

- [x] 3.B.1 `slices/portfolio/relations/guests.rb` リレーション作成
- [x] 3.B.2 `slices/portfolio/repositories/guest_repository.rb` リポジトリ作成
  - `find_by_user_id(user_id)`
  - `create(attrs)`
  - `update(id, attrs)`
- [x] 3.B.3 `slices/portfolio/use_cases/guest/get_profile.rb` 作成
- [x] 3.B.4 `slices/portfolio/use_cases/guest/save_profile.rb` 作成（upsert パターン）
- [x] 3.B.5 `slices/portfolio/presenters/guest/profile_presenter.rb` 作成
- [x] 3.B.6 `slices/portfolio/grpc/guest_handler.rb` gRPC ハンドラ作成
  - `class GuestHandler < Handler`（継承パターン）
  - `get_guest_profile` - プロフィール取得
  - `save_guest_profile` - プロフィール保存（upsert）
  - `get_upload_url` → `handle_upload_url(prefix: "guests")`
- [x] 3.B.7 バリデーション実装（name: 1-20文字）

## 4. Frontend - Media Uploader Components

- [x] 4.1 `components/shared/MediaUploader.tsx` 作成（共通基盤）
  - ドラッグ&ドロップ、ファイル選択の共通ロジック
  - `BottomNavBar` パターンと同様の構成
- [x] 4.2 `components/shared/AvatarUploader.tsx` 作成（単一メディア用）
  - Props: `mediaUrl`, `onUpload`, `onClear`, `accept`, `size`, `label`
  - キャストの既存アバター実装（`cast/profile/page.tsx:172-213`）を参考に抽出
- [x] 4.3 `components/shared/GalleryUploader.tsx` 作成（複数メディア用）
  - 既存 `PhotoUploader.tsx` を移動・リネーム
  - `MediaUploader` を内部で利用するようリファクタリング
- [x] 4.4 デフォルト画像の追加（`public/images/default-avatar.png`）
- [x] 4.5 キャストのプロフィール編集ページを共通コンポーネントに置き換え
  - アバター部分 → `AvatarUploader`
  - ギャラリー部分 → `GalleryUploader`（パス変更のみ）

## 5. Frontend - Shared Media Upload Hook

- [x] 5.1 `lib/hooks/useMediaUpload.ts` 作成
  - Props: `uploadUrlPath`, `getToken`
  - Returns: `uploading`, `error`, `uploadMedia(file)`
  - useCastData の uploadImage ロジックを汎用化

## 6. Frontend - Guest Data Hook

- [x] 6.1 `modules/portfolio/hooks/useGuestData.ts` 作成
  - `useCastData` パターンを踏襲
  - SWR でデータ取得、ローカル更新、サーバー保存を提供
  - Returns: `profile`, `avatarUrl`, `loading`, `error`, `updateProfile`, `saveProfile`, `uploadAvatar`

## 7. Frontend - BFF Endpoints

- [x] 7.1 `/api/guest/profile/route.ts` 作成
  - GET: `guestClient.getGuestProfile()`
  - PUT: `guestClient.saveGuestProfile()`
- [x] 7.2 `/api/guest/upload-url/route.ts` 作成
  - POST: `guestClient.getUploadUrl()`

## 8. Frontend - Guest Onboarding

- [x] 8.1 `/onboarding` ルート作成（ゲスト用）
- [x] 8.2 `modules/portfolio/components/guest/GuestOnboarding.tsx` 作成
  - 名前入力フォーム（1-20文字）
  - 共通 `AvatarUploader` 使用
- [x] 8.3 オンボーディング未完了時のリダイレクト実装
  - 新規登録時に `/onboarding` へリダイレクト

## 9. Frontend - MyPage Integration

- [x] 9.1 ゲスト用マイページにプロフィールセクション追加
- [x] 9.2 `modules/portfolio/components/guest/GuestProfileEdit.tsx` 作成
- [x] 9.3 プロフィール編集画面へのナビゲーション追加

## 10. Testing

- [x] 10.1 Backend: GuestService RPC の RSpec テスト
- [x] 10.2 Backend: UseCase のユニットテスト
- [ ] 10.3 Frontend: オンボーディングフローの E2E テスト（任意）

## 11. Documentation

- [x] 11.1 `handbooks/docs/domains/portfolio.md` にゲストプロフィールのセクション追加
