# Tasks

## 1. Backend (gRPC)

既存の `ListCastPosts` RPC は cast_id によるフィルタリングをサポートしているため、バックエンドの変更は不要。

- [x] 1.1 既存の `ListCastPosts` が cast_id なしで全投稿を返せることを確認

## 2. Frontend API Routes

- [ ] 2.1 `GET /api/guest/timeline` API Route 作成
  - 全キャストの公開投稿を取得（visible=true のみ）
  - Cursor-based pagination 対応
  - cast_id パラメータでフィルタリング可能
- [ ] 2.2 `GET /api/guest/timeline/[id]` API Route 作成
  - 投稿詳細を取得

## 3. Frontend Hooks

- [ ] 3.1 `useGuestTimeline` hook 作成
  - 投稿一覧の取得
  - 無限スクロール対応
  - cast_id によるフィルタリング
- [ ] 3.2 `useGuestPost` hook 作成
  - 単一投稿の取得

## 4. Frontend Components

- [ ] 4.1 `TimelineFeed.tsx` を API 接続に更新
  - モックデータを削除
  - useGuestTimeline を使用
  - ローディング・エラー状態の表示
- [ ] 4.2 投稿詳細ページ（`/timeline/[id]`）を API 接続
- [ ] 4.3 キャスト詳細ページ（`/casts/[id]`）にタイムラインタブを追加
  - そのキャストの投稿のみ表示
  - All / Media Only / Liked フィルタ（Liked は将来実装）

## 5. Testing

- [ ] 5.1 API Route のテスト
- [ ] 5.2 動作確認（シードデータを使用）
