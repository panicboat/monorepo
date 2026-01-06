# Change: Implement Full Mock Application

## Why
Nyx.placeのユーザー体験（特に「Ritual」）を、バックエンド実装を待たずに検証するため。
`hime-channel.com` の機能密度をベンチマークとし、店舗なし（No Shop）モデルでのUXフローを確立する必要がある。

## What Changes
- **Identity**: ログイン、SMS認証(Mock)、マイページ機能の実装。
- **Discovery**: キャスト一覧、ランキング、タイムライン、イベント、詳細検索の実装。
- **Portfolio**: キャスト詳細（Living Portfolio）、写真ギャラリー、料金プラン、スケジュールの実装。
- **Concierge**: チャットルーム、スマート招待状の実装。
- **Trust**: レビュー投稿、レーダーチャート表示の実装。

## Impact
- `apps/shell`: Next.js App Router 上に全画面のモックを実装。
- Mock Data: フロントエンド内で完結するJSONデータ/State管理を追加。
