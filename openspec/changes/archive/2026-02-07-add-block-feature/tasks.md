# Tasks: Add User Block Feature

## 1. Database

- [x] 1.1 `blocks` テーブルの migration 作成
  - `id` (UUID, PK)
  - `blocker_id` (UUID, FK → users)
  - `blocker_type` ("guest" | "cast")
  - `blocked_id` (UUID, FK → users)
  - `blocked_type` ("guest" | "cast")
  - `created_at` (timestamp)
  - unique constraint: (`blocker_id`, `blocked_id`)
- [x] 1.2 シードデータ作成（開発用サンプルブロック）

## 2. Proto Definition

- [x] 2.1 `proto/social/v1/service.proto` に Block RPC 追加
  - `BlockUser(BlockUserRequest) returns (BlockUserResponse)`
  - `UnblockUser(UnblockUserRequest) returns (UnblockUserResponse)`
  - `ListBlocked(ListBlockedRequest) returns (ListBlockedResponse)`
  - `GetBlockStatus(GetBlockStatusRequest) returns (GetBlockStatusResponse)`
- [x] 2.2 Proto 再生成 (`buf generate`)

## 3. Backend Implementation

- [x] 3.1 `slices/social/relations/blocks.rb` 作成
- [x] 3.2 `slices/social/repositories/block_repository.rb` 作成
  - `block(blocker_id:, blocker_type:, blocked_id:, blocked_type:)`
  - `unblock(blocker_id:, blocked_id:)`
  - `list_blocked(blocker_id:, limit:, cursor:)`
  - `blocked?(blocker_id:, blocked_id:)`
  - `blocked_user_ids(blocker_id:)` (フィルタリング用)
- [x] 3.3 `slices/social/use_cases/blocks/` 作成
  - `block_user.rb`
  - `unblock_user.rb`
  - `list_blocked.rb`
  - `get_block_status.rb`
- [x] 3.4 `slices/social/grpc/handler.rb` に Block RPC ハンドラ追加
- [x] 3.5 `list_public_posts.rb` を更新してブロックユーザーの投稿を除外
- [x] 3.6 `list_comments.rb` を更新してブロックユーザーのコメントを除外

## 4. Frontend API Routes

- [x] 4.1 `POST /api/guest/blocks` - ブロック追加
- [x] 4.2 `DELETE /api/guest/blocks` - ブロック解除
- [x] 4.3 `GET /api/guest/blocks` - ブロックリスト取得
- [x] 4.4 `GET /api/guest/blocks/status` - ブロック状態一括取得
- [x] 4.5 キャスト側 API Routes も同様に作成

## 5. Frontend UI

- [x] 5.1 `useSocial` hook にブロック機能追加（既存）
- [x] 5.2 キャスト詳細ページにブロックボタン追加
- [x] 5.3 設定画面にブロック管理ページ追加
- [x] 5.4 タイムラインでブロックユーザーの投稿を非表示に（Backend 側でフィルタリング実装済み）

## 6. Testing

- [x] 6.1 Backend UseCase テスト作成
- [x] 6.2 Backend Repository テスト作成
- [ ] 6.3 API Route テスト作成（フロントエンドテスト環境未設定のためスキップ）
- [ ] 6.4 E2E テスト（フロントエンドテスト環境未設定のためスキップ）
