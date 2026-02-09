## 1. Database Changes

- [ ] 1.1 casts テーブルに registered_at カラム追加
- [ ] 1.2 casts テーブルの visibility を public/private に変更
- [ ] 1.3 cast_follows テーブルに status カラム追加
- [ ] 1.4 既存データのマイグレーション

## 2. Backend Implementation

- [ ] 2.1 Cast エンティティ・Relation の更新
- [ ] 2.2 オンボーディング完了時に registered_at をセット
- [ ] 2.3 FollowRepository に approve/reject/list_pending 追加
- [ ] 2.4 Follow UseCase 作成（RequestFollow, ApproveFollow, RejectFollow）
- [ ] 2.5 gRPC ハンドラーの更新

## 3. Proto Definitions

- [ ] 3.1 CastVisibility enum を PUBLIC/PRIVATE に変更
- [ ] 3.2 FollowStatus enum 追加
- [ ] 3.3 新規 RPC 追加

## 4. Frontend

- [ ] 4.1 フォローボタンのロジック変更
- [x] 4.2 承認待ち一覧 UI
- [ ] 4.3 フォローステータス表示
- [ ] 4.4 private キャストの南京錠アイコン表示（検索結果、プロフィール）
- [x] 4.5 キャスト設定画面に visibility トグル追加

## 5. Testing

- [ ] 5.1 Unit tests
- [ ] 5.2 Integration tests
- [ ] 5.3 E2E tests
