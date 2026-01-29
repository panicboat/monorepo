# Change: Implement Trust (Reviews & Ratings) System

## Why
レビュー・評価システム（Trust）は現在モックのみ。完了した予約（Ritual）に対してゲストがレビューを投稿し、キャストが承認/非承認を選択できるフローを実装する。これにより TrustRadar やレーティングの表示が可能になる。

## What Changes
- Trust ドメインにレビュー機能を実装
- ゲストからキャストへのレビュー投稿機能
- キャストによるレビュー承認/非承認機能
- TrustRadar（5軸レーダーチャート）のスコア計算・表示
- キャスト詳細ページへのレビュー一覧表示

## Impact
- Affected specs: `trust`
- Affected code:
  - `services/monolith/workspace/slices/trust/` (新規ドメイン)
  - `proto/trust/v1/service.proto` (新規)
  - `web/nyx/workspace/src/app/(cast)/cast/reviews/page.tsx`
  - `web/nyx/workspace/src/app/(guest)/guest/casts/[id]/page.tsx` (レビュー表示追加)
  - `web/nyx/workspace/src/modules/trust/` (新規モジュール)
