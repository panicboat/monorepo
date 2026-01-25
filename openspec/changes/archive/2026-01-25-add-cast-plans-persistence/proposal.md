# Change: Cast Plans Page Persistence

## Why
`/cast/plans` ページは現在モックデータを使用しており、変更が永続化されない。`/cast/profile` と同様に、バックエンド API と連携した完全な CRUD 機能が必要。

## What Changes
- `/api/cast/plans` に GET エンドポイントを追加（既存の PUT と並行）
- `/cast/plans` ページで API からデータを取得・表示
- 保存時に実際の API を呼び出してデータを永続化
- モックデータ（`MOCK_PLANS`）を削除

## Impact
- Affected specs: portfolio
- Affected code:
  - `web/nyx/workspace/src/app/(cast)/cast/plans/page.tsx`
  - `web/nyx/workspace/src/app/api/cast/plans/route.ts` (新規)
  - 既存の `/api/cast/onboarding/plans` を参考に実装
