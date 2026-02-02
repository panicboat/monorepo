# Tasks

## 1. Backend (gRPC)

バックエンドを修正して、認証なしで全公開投稿を取得できるように更新。

- [x] 1.1 `PostRepository` に `list_all_visible` メソッドを追加
- [x] 1.2 `ListPublicPosts` ユースケースを作成
- [x] 1.3 `GetPost` ユースケースを作成（単一投稿取得用）
- [x] 1.4 gRPC Handler を更新（認証不要、全投稿取得サポート）
- [x] 1.5 Proto に `GetCastPost` RPC を追加

## 2. Frontend API Routes

- [x] 2.1 `GET /api/guest/timeline` API Route 作成
  - 全キャストの公開投稿を取得（visible=true のみ）
  - Cursor-based pagination 対応
  - cast_id パラメータでフィルタリング可能
- [x] 2.2 `GET /api/guest/timeline/[id]` API Route 作成
  - 投稿詳細を取得

## 3. Frontend Hooks

- [x] 3.1 `useGuestTimeline` hook 作成
  - 投稿一覧の取得
  - 無限スクロール対応
  - cast_id によるフィルタリング
- [x] 3.2 `useGuestPost` hook 作成
  - 単一投稿の取得

## 4. Frontend Components

- [x] 4.1 `TimelineFeed.tsx` を API 接続に更新
  - モックデータを削除
  - useGuestTimeline を使用
  - ローディング・エラー状態の表示
- [x] 4.2 投稿詳細ページ（`/timeline/[id]`）を API 接続
- [x] 4.3 キャスト詳細ページ（`/casts/[id]`）にタイムラインセクションを追加
  - そのキャストの投稿のみ表示
  - List / Grid レイアウト切り替え

## 5. Testing

- [ ] 5.1 API Route のテスト
- [ ] 5.2 動作確認（シードデータを使用）
