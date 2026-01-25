# Change: Cast Schedules Page Persistence

## Why
`/cast/schedule` ページは現在モックデータを使用しており、変更が永続化されない。`/cast/profile` と同様に、バックエンド API と連携した完全な CRUD 機能が必要。また、URL を `/cast/schedules`（複数形）に変更して他のルート（plans, pledges, reviews）と一貫性を持たせる。

## What Changes
- URL を `/cast/schedule` から `/cast/schedules` にリネーム
- `/api/cast/schedules` に GET エンドポイントを追加（既存の PUT と並行）
- `/cast/schedules` ページで API からデータを取得・表示
- 保存時に実際の API を呼び出してデータを永続化
- モックデータを削除
- **バックエンド修正**: スケジュール保存時に過去のデータを保持（今日以降のみ置換）

## Impact
- Affected specs: schedule
- Affected code:
  - `web/nyx/workspace/src/app/(cast)/cast/schedule/` → `schedules/` (rename)
  - `web/nyx/workspace/src/app/api/cast/schedules/route.ts` (新規)
  - 既存の `/api/cast/onboarding/schedules` を参考に実装
  - ナビゲーションリンクの更新（必要に応じて）
