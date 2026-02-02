# Tasks

## 1. Database Schema

- [ ] 1.1 `social__post_likes` テーブルのマイグレーション作成
- [ ] 1.2 `social__cast_follows` テーブルのマイグレーション作成
- [ ] 1.3 マイグレーション実行・動作確認

## 2. Backend - Like Feature

- [ ] 2.1 Proto 定義追加（`LikeCastPost`, `UnlikeCastPost`, `GetPostLikeStatus`）
- [ ] 2.2 `post_likes` relation 作成
- [ ] 2.3 `LikeRepository` 作成
- [ ] 2.4 `LikePost` use case 作成
- [ ] 2.5 `UnlikePost` use case 作成
- [ ] 2.6 `GetLikeStatus` use case 作成
- [ ] 2.7 gRPC Handler に Like 関連 RPC 追加
- [ ] 2.8 `PostPresenter` を更新（likes_count をリアルタイム取得）
- [ ] 2.9 RSpec テスト作成

## 3. Backend - Follow Feature

- [ ] 3.1 Proto 定義追加（`FollowCast`, `UnfollowCast`, `ListFollowing`, `GetFollowStatus`）
- [ ] 3.2 `cast_follows` relation 作成
- [ ] 3.3 `FollowRepository` 作成
- [ ] 3.4 `FollowCast` use case 作成
- [ ] 3.5 `UnfollowCast` use case 作成
- [ ] 3.6 `ListFollowing` use case 作成
- [ ] 3.7 `GetFollowStatus` use case 作成
- [ ] 3.8 gRPC Handler に Follow 関連 RPC 追加
- [ ] 3.9 RSpec テスト作成

## 4. Frontend - Like Feature

- [ ] 4.1 `POST /api/guest/likes` API Route 作成
- [ ] 4.2 `DELETE /api/guest/likes` API Route 作成
- [ ] 4.3 `GET /api/guest/likes/status` API Route 作成
- [ ] 4.4 `useLike` hook 作成
- [ ] 4.5 `TimelineFeed` のいいねボタンを API 連携に更新
- [ ] 4.6 `CastTimeline` のいいねボタンを API 連携に更新
- [ ] 4.7 投稿詳細ページのいいねボタンを API 連携に更新

## 5. Frontend - Follow Feature

- [ ] 5.1 `GET /api/guest/following` API Route 作成
- [ ] 5.2 `POST /api/guest/following` API Route 作成
- [ ] 5.3 `DELETE /api/guest/following` API Route 作成
- [ ] 5.4 `GET /api/guest/following/status` API Route 作成
- [ ] 5.5 `useFollow` hook 作成
- [ ] 5.6 `socialStore` を API 連携に更新
- [ ] 5.7 localStorage からの移行処理実装
- [ ] 5.8 キャスト詳細ページのフォローボタンを API 連携に更新
- [ ] 5.9 Following タブのフィルタリングをサーバーサイドに移行

## 6. Integration Testing

- [ ] 6.1 Like 機能の E2E 動作確認
- [ ] 6.2 Follow 機能の E2E 動作確認
- [ ] 6.3 localStorage 移行の動作確認
