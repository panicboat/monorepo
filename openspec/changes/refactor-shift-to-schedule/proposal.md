# Change: Refactor Shift to Schedule

## Why

キャストのスケジュール機能において「シフト (shift)」という文言が混在している。
ドメイン用語として「スケジュール (schedule)」に統一し、コードの可読性と一貫性を向上させる。

## What Changes

- **BREAKING**: proto の field 名を変更 (`default_shift_start` → `default_schedule_start`)
- **BREAKING**: DB カラム名を変更 (`default_shift_start` → `default_schedule_start`)
- コード内の変数名・関数名を変更
- UI のラベル・テキストを変更
- コンポーネント名を変更 (`WeeklyShiftInput` → `WeeklyScheduleInput`)

## Impact

- Affected specs: `schedule`, `profile`, `portfolio`
- Affected code:
  - `proto/portfolio/v1/service.proto`
  - `services/monolith/workspace/config/db/migrate/` (新規マイグレーション)
  - `services/monolith/workspace/slices/portfolio/` (relations, contracts, use_cases, presenters)
  - `web/nyx/workspace/src/modules/ritual/components/cast/WeeklyShiftInput.tsx`
  - `web/nyx/workspace/src/modules/portfolio/components/cast/StyleInputs.tsx`
  - `web/nyx/workspace/src/stores/onboarding.ts`
  - `web/nyx/workspace/src/modules/portfolio/types.ts`
  - 関連する API routes とページコンポーネント
