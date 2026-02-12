# Design: Decouple Schedule from Plan

## Current Architecture

```
CastPlan (1) <---- (N) CastSchedule
              plan_id (nullable)
```

Schedule は Plan を参照できる（オプショナル）。この設計は「特定の時間帯に特定のプランのみ提供」というユースケースを想定していたが、現状では活用されていない。

### Current Data Flow

```
Save Schedule Request
  → Contract validates (including optional plan_id)
  → Repository saves with plan_id
  → Response includes plan_id

Get Profile Response
  → Repository loads with combine(:cast_plans, :cast_schedules)
  → Presenter maps plan_id to response
  → Frontend uses plan_id for UI logic
```

## Proposed Architecture

```
CastPlan ──── (independent) ──── CastSchedule
```

Schedule と Plan は完全に独立。関連付けが必要な場合は将来的に予約（Reservation）エンティティが担う。

### New Data Flow

```
Save Schedule Request
  → Contract validates (no plan_id)
  → Repository saves without plan_id
  → Response without plan_id

Get Profile Response
  → Repository loads plans and schedules independently
  → Presenter maps without plan_id
  → Frontend displays plans and schedules separately
```

## Layer-by-Layer Changes

### 1. Protocol Buffers

```protobuf
// BEFORE
message CastSchedule {
  string date = 1;
  string start_time = 2;
  string end_time = 3;
  string plan_id = 4; // Optional
}

// AFTER
message CastSchedule {
  string date = 1;
  string start_time = 2;
  string end_time = 3;
  // plan_id removed
}
```

### 2. Database Schema

```sql
-- Migration: Remove plan_id from cast_schedules
ALTER TABLE portfolio__cast_schedules
  DROP CONSTRAINT portfolio__cast_schedules_plan_id_fkey,
  DROP COLUMN plan_id;
```

### 3. ORM Relations

```ruby
# BEFORE
class CastSchedules < Portfolio::DB::Relation
  schema do
    attribute :plan_id, Types::String
    associations do
      belongs_to :cast_plan, foreign_key: :plan_id
    end
  end
end

# AFTER
class CastSchedules < Portfolio::DB::Relation
  schema do
    # plan_id removed
    associations do
      # belongs_to :cast_plan removed
    end
  end
end
```

### 4. Frontend UI

現在の `CostAndSchedule` コンポーネントは `planId` を使って以下を実現している：

1. 選択日のスケジュールに対応するプランをハイライト
2. プランの活性/非活性を判定

分離後は：
- Schedule: 日付と時間帯のみ表示（稼働可能時間）
- Plan: 独立したリストとして表示（サービス内容と価格）

## Trade-offs

### Pros
- Schedule と Plan の責務が明確に分離
- データモデルがシンプルになる
- 将来の機能拡張が容易

### Cons
- 「時間帯別プラン」の表示が不可能になる（現状未使用）
- 既存の plan_id データが失われる（破壊的変更として許容）

## Migration Strategy

既存データへの配慮は不要（ユーザー要件）。マイグレーションで `plan_id` カラムを単純に削除する。
