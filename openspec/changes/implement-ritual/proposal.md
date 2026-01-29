# Change: Implement Ritual (Reservation) System

## Why
予約システム（Ritual）はビジネスの中核機能だが、現在モックのみ。Concierge から招待状を送り、ゲストが予約を確定し、履歴として記録される一連のフローを実装する。これにより Cast の home/mypage の収益・予約データも表示可能になる。

## What Changes
- Ritual ドメインに予約管理機能を実装
- 招待状の作成・送信・受諾フロー
- 予約ステータス管理（招待中→誓約→完了/キャンセル）
- Cast の履歴ページ・収益統計の実データ化
- Cast の home ダッシュボードの予約表示

## Impact
- Affected specs: `ritual`, `home`
- Affected code:
  - `services/monolith/workspace/slices/ritual/` (新規ドメイン)
  - `proto/ritual/v1/service.proto` (新規)
  - `web/nyx/workspace/src/app/(cast)/cast/history/page.tsx`
  - `web/nyx/workspace/src/app/(cast)/cast/home/page.tsx`
  - `web/nyx/workspace/src/app/api/cast/stats/route.ts` (新規)
  - `web/nyx/workspace/src/app/api/cast/upcoming-reservations/route.ts` (新規)
