# Change: Guest Profile Registration

## Why

現在、ゲストユーザーは登録後にプロフィール情報（名前、アバター）を設定する機能がない。これにより以下の問題が発生している：

1. **キャストとのコミュニケーション**: チャットや予約時にゲストの識別情報がなく、キャストが顧客を認識できない
2. **CRM機能**: キャストが顧客管理を行う際、電話番号以外の識別手段がない
3. **UX**: ゲストが自身をパーソナライズする手段がない

## What Changes

### Backend

- **新規**: `proto/portfolio/v1/guest.proto` - GuestService 定義（CastService とは分離）
- **新規**: `portfolio__guests` テーブル（`casts` と同様のスキーマパターン）
- **新規**: `slices/portfolio/grpc/guest_handler.rb` - gRPC ハンドラ
- **新規**: `slices/portfolio/use_cases/guest/` - UseCase 層
- **新規**: `slices/portfolio/repositories/guest_repository.rb` - Repository

### Frontend

- **新規**: `/onboarding` - ゲストオンボーディングページ
- **新規**: `components/shared/SingleMediaUploader.tsx` - 汎用メディアアップローダー
- **新規**: `lib/hooks/useMediaUpload.ts` - 汎用アップロードフック
- **新規**: `modules/portfolio/hooks/useGuestData.ts` - ゲストプロフィールフック
- **新規**: `/api/guest/` - BFF エンドポイント群
- **変更**: キャストのアバター部分を `SingleMediaUploader` に置き換え

### **BREAKING** Changes

なし（新規機能の追加のみ）

## Impact

- Affected specs: `guest-profile` (新規)
- Affected code:
  - Backend: `slices/portfolio/` に Guest 関連追加
  - Frontend: `modules/portfolio/` にゲスト関連追加、共通コンポーネント追加
  - Proto: `proto/portfolio/v1/guest.proto` 新規作成
  - Database: `portfolio__guests` テーブル追加
