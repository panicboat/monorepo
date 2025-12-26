# Proposal: Portfolio & Cast Details

## Why
ゲストがキャストの詳細情報を確認し、招待状（予約）をリクエストするための画面が必要。
`demo` アプリで検証された「高解像度なプロフィール表現（レーダーチャート、ボイスプレビュー）」を `shell` に移植する。

## What Changes
`web/apps/shell` に以下の機能を追加する：
1.  **Cast Detail Page (`/casts/[id]`)**:
    *   ヒーロー画像とグラデーションオーバーレイ。
    *   レーダーチャート（アニメーション付き）。
    *   ポートフォリオギャラリー。
    *   レビュー表示。
2.  **Floating Footer**:
    *   スクロール追従する「招待状リクエスト」ボタン。
3.  **Mock Data**:
    *   キャスト詳細情報 (`/api/casts/:id`) の MSW モック。

## Impact
- `web/apps/shell`: 新規ページ (`app/casts/[id]/page.tsx`) とコンポーネント。
