# Multiple Default Schedules Design

## Overview

キャストのデフォルトスケジュールを単一時間帯から複数時間帯に拡張する。

## Requirements

- 1日に複数の時間帯をデフォルトとして設定可能 (MUST)
- 時間帯の数に制限なし (MUST)
- スケジュール新規追加時の初期値として使用 (MUST)
- プロフィール編集画面で設定 (MUST)

## Design Decisions

### Approach: JSONB Column

既存の2フィールド（`default_schedule_start`, `default_schedule_end`）を1つのJSONBカラム（`default_schedules`）に置き換える。

選定理由:
- 既存パターンと一貫性（`tags`, `social_links` もJSONB）
- マイグレーションがシンプル
- フロントエンドとの相性が良い

## Data Model

### Database Schema

```sql
-- castsテーブル
-- 削除: default_schedule_start text, default_schedule_end text
-- 追加:
default_schedules jsonb DEFAULT '[]'
```

### Data Structure

```json
[
  {"start": "12:00", "end": "15:00"},
  {"start": "18:00", "end": "23:00"}
]
```

### Validation Rules

- `start` / `end` は `HH:mm` 形式
- `start < end`（開始時間は終了時間より前）
- 時間帯の重複は許可（ユーザー責任）

### Migration Strategy

既存データを新形式に変換:

```ruby
# Before: default_schedule_start="18:00", default_schedule_end="23:00"
# After:  default_schedules=[{"start":"18:00","end":"23:00"}]
```

## Proto Definition

### portfolio/v1/cast_service.proto

```protobuf
message DefaultSchedule {
  string start = 1;  // HH:mm
  string end = 2;    // HH:mm
}

message CastProfile {
  // Field 9 changes from string to repeated DefaultSchedule
  repeated DefaultSchedule default_schedules = 9;
  // Field 10 (default_schedule_end) removed
}
```

## Backend Changes

| Layer | File | Changes |
|-------|------|---------|
| Handler | `cast_handler.rb` | Accept/save `default_schedules` array |
| Presenter | `profile_presenter.rb` | Convert JSONB → Proto array |

## Frontend Changes

### Type Definitions

```typescript
export interface DefaultSchedule {
  start: string;  // HH:mm
  end: string;    // HH:mm
}

export interface ProfileFormData {
  defaultSchedules: DefaultSchedule[];
  // Remove: defaultScheduleStart, defaultScheduleEnd
}
```

### UI Design

プロフィール編集画面の複数時間帯リスト:

```
┌─────────────────────────────────────┐
│ デフォルトスケジュール              │
├─────────────────────────────────────┤
│ ① 12:00 ～ 15:00          [削除]   │
│ ② 18:00 ～ 23:00          [削除]   │
│                                     │
│ [+ 時間帯を追加]                    │
└─────────────────────────────────────┘
```

### ScheduleEditor Integration

新規日追加時、`defaultSchedules` 配列の全時間帯を初期値として設定。

## Affected Files

| Area | File | Changes |
|------|------|---------|
| DB | Migration | Add column, migrate data, remove old columns |
| DB | Seed data | Update to `default_schedules` format |
| Proto | `cast_service.proto` | Add `DefaultSchedule` message, change field |
| Backend | `cast_handler.rb` | Array handling |
| Backend | `profile_presenter.rb` | JSONB → Proto conversion |
| Backend | Tests | Update Handler/Presenter tests |
| Frontend | `types.ts` | Type definition changes |
| Frontend | `mappers.ts` | Mapping function updates |
| Frontend | Profile edit UI | Multiple time slot list UI |
| Frontend | `ScheduleEditor.tsx` | Multiple default support |
| Frontend | `useCastProfile.ts` | Default value updates |
