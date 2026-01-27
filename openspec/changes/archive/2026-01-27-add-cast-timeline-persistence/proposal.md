# Change: Cast Timeline Posts Persistence

## Why
`/cast/timeline` ページは現在モックデータを使用しており、投稿が永続化されない。キャストが投稿したタイムラインコンテンツをバックエンドに保存し、ゲストに表示できるようにする必要がある。

## What Changes
- Proto に `CastPost` メッセージと関連 RPC を追加
- Monolith に投稿の CRUD 機能を実装（テーブル、リポジトリ、ユースケース）
- 投稿の作成・編集・削除をサポート
- フロントエンドで API 連携を実装

## Impact
- Affected specs: timeline
- Affected code:
  - `proto/social/v1/service.proto` (新規)
  - `services/monolith/workspace/slices/social/` (新規ドメイン)
  - `services/monolith/workspace/db/migrate/` (新規マイグレーション)
  - `web/nyx/workspace/src/modules/social/` (拡充)
  - `web/nyx/workspace/src/app/api/cast/timeline/route.ts` (新規)
  - `web/nyx/workspace/src/app/(cast)/cast/timeline/page.tsx`

## Domain Decision
Timeline 機能は **Social** ドメインに属する。将来的にいいね・コメント・フォローなどの社会的機能を含む前提。
