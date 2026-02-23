# Multiple Default Schedules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** キャストのデフォルトスケジュールを単一時間帯から複数時間帯（JSONB）に拡張する

**Architecture:** Portfolio Domain の casts テーブルに `default_schedules` JSONB カラムを追加し、既存の `default_schedule_start` / `default_schedule_end` フィールドを置き換える。Proto定義、バックエンド（Handler/Presenter/Contract/UseCase）、フロントエンド（型定義/マッパー/UI）を一貫して更新する。

**Tech Stack:** Ruby/Hanami (Backend), PostgreSQL JSONB, Protocol Buffers, Next.js/React (Frontend), TypeScript

---

## Task 1: Database Migration

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/YYYYMMDD000000_add_default_schedules_to_casts.rb`

**Step 1: Create migration file**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  change do
    # Add new JSONB column
    alter_table :portfolio__casts do
      add_column :default_schedules, :jsonb, default: Sequel.lit("'[]'::jsonb")
    end

    # Migrate existing data
    run <<~SQL
      UPDATE portfolio.casts
      SET default_schedules = CASE
        WHEN default_schedule_start IS NOT NULL AND default_schedule_end IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object('start', default_schedule_start, 'end', default_schedule_end))
        ELSE '[]'::jsonb
      END
    SQL

    # Drop old columns
    alter_table :portfolio__casts do
      drop_column :default_schedule_start
      drop_column :default_schedule_end
    end
  end
end
```

**Step 2: Run migration**

Run: `cd services/monolith/workspace && bundle exec hanami db migrate`
Expected: Migration completes successfully

**Step 3: Verify schema**

Run: `cd services/monolith/workspace && bundle exec hanami db structure dump && grep -A5 "default_schedules" config/db/structure.sql`
Expected: `default_schedules jsonb DEFAULT '[]'::jsonb` in output

**Step 4: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/*_add_default_schedules_to_casts.rb services/monolith/workspace/config/db/structure.sql
git commit -m "feat(portfolio): migrate default_schedule to default_schedules JSONB"
```

---

## Task 2: Update Proto Definition

**Files:**
- Modify: `proto/portfolio/v1/cast_service.proto:52-80` (CastProfile message)
- Modify: `proto/portfolio/v1/cast_service.proto:99-113` (CreateCastProfileRequest)
- Modify: `proto/portfolio/v1/cast_service.proto:119-136` (SaveCastProfileRequest)

**Step 1: Add DefaultSchedule message and update CastProfile**

Add before `CastProfile` message:

```protobuf
message DefaultSchedule {
  string start = 1;  // HH:mm
  string end = 2;    // HH:mm
}
```

Update `CastProfile`:

```protobuf
message CastProfile {
  string user_id = 1;
  string name = 2;
  string bio = 3;
  string image_url = 4;
  CastVisibility visibility = 5;
  repeated string images = 6;
  reserved 7;
  string tagline = 8;
  repeated DefaultSchedule default_schedules = 9;  // Changed from string default_schedule_start
  reserved 10;  // was default_schedule_end
  // ... rest unchanged
}
```

**Step 2: Update CreateCastProfileRequest**

```protobuf
message CreateCastProfileRequest {
  string name = 1;
  string bio = 2;
  reserved 3;
  string tagline = 4;
  repeated DefaultSchedule default_schedules = 5;  // Changed from default_schedule_start
  reserved 6;  // was default_schedule_end
  // ... rest unchanged
}
```

**Step 3: Update SaveCastProfileRequest**

```protobuf
message SaveCastProfileRequest {
  string name = 1;
  string bio = 2;
  reserved 3;
  string tagline = 4;
  repeated DefaultSchedule default_schedules = 5;  // Changed from default_schedule_start
  reserved 6;  // was default_schedule_end
  // ... rest unchanged
}
```

**Step 4: Generate Proto files**

Run: `cd proto && buf generate`
Expected: Proto files generated without errors

**Step 5: Commit**

```bash
git add proto/portfolio/v1/cast_service.proto
git commit -m "feat(proto): change default_schedule to repeated default_schedules"
```

---

## Task 3: Update Backend - Relations

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/relations/casts.rb`

**Step 1: Verify casts relation file**

Read the file to understand current structure.

**Step 2: Update if needed**

Ensure the relation includes the new `default_schedules` column (ROM should auto-detect JSONB).

**Step 3: Commit if changes needed**

```bash
git add services/monolith/workspace/slices/portfolio/relations/casts.rb
git commit -m "feat(portfolio): update casts relation for default_schedules"
```

---

## Task 4: Update Backend - Contract

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/contracts/cast/save_profile_contract.rb:22-24,63-75`

**Step 1: Update params schema**

Replace:

```ruby
optional(:default_schedule_start).maybe(:string)
optional(:default_schedule_end).maybe(:string)
```

With:

```ruby
optional(:default_schedules).maybe(:array)
```

**Step 2: Update validation rule**

Replace the `rule(:default_schedule_start, :default_schedule_end)` block with:

```ruby
rule(:default_schedules) do
  next unless key? && value

  value.each_with_index do |schedule, idx|
    unless schedule.is_a?(Hash) && schedule[:start] && schedule[:end]
      key.failure("の#{idx + 1}番目は start と end が必要です")
      next
    end

    start_time = schedule[:start].to_s
    end_time = schedule[:end].to_s

    unless start_time.match?(/\A([01]?[0-9]|2[0-3]):[0-5][0-9]\z/)
      key.failure("の#{idx + 1}番目の開始時刻は有効な時刻形式（HH:MM）で入力してください")
    end
    unless end_time.match?(/\A([01]?[0-9]|2[0-3]):[0-5][0-9]\z/)
      key.failure("の#{idx + 1}番目の終了時刻は有効な時刻形式（HH:MM）で入力してください")
    end
    if start_time >= end_time
      key.failure("の#{idx + 1}番目の開始時刻は終了時刻より前である必要があります")
    end
  end
end
```

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/portfolio/contracts/cast/save_profile_contract.rb
git commit -m "feat(portfolio): update save_profile_contract for default_schedules array"
```

---

## Task 5: Update Backend - UseCase

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/use_cases/cast/profile/save_profile.rb:24,26-39,53-66`

**Step 1: Update method signature**

Replace `default_schedule_start: nil, default_schedule_end: nil` with `default_schedules: nil`.

**Step 2: Update params hash**

Replace:

```ruby
default_schedule_start: default_schedule_start,
default_schedule_end: default_schedule_end,
```

With:

```ruby
default_schedules: default_schedules,
```

**Step 3: Update attrs hash**

Replace:

```ruby
default_schedule_start: default_schedule_start,
default_schedule_end: default_schedule_end,
```

With:

```ruby
default_schedules: default_schedules ? Sequel.pg_jsonb(default_schedules) : nil,
```

**Step 4: Commit**

```bash
git add services/monolith/workspace/slices/portfolio/use_cases/cast/profile/save_profile.rb
git commit -m "feat(portfolio): update save_profile use case for default_schedules"
```

---

## Task 6: Update Backend - Handler

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb:137-166,168-205`

**Step 1: Add helper method for converting proto to hash**

Add in private section:

```ruby
def default_schedules_from_proto(proto_schedules)
  return nil if proto_schedules.nil? || proto_schedules.empty?

  proto_schedules.map do |s|
    { start: s.start, end: s.end }
  end
end
```

**Step 2: Update create_cast_profile**

Replace:

```ruby
default_schedule_start: request.message.default_schedule_start,
default_schedule_end: request.message.default_schedule_end,
```

With:

```ruby
default_schedules: default_schedules_from_proto(request.message.default_schedules),
```

**Step 3: Update save_cast_profile**

Replace:

```ruby
default_schedule_start: request.message.default_schedule_start,
default_schedule_end: request.message.default_schedule_end,
```

With:

```ruby
default_schedules: default_schedules_from_proto(request.message.default_schedules),
```

**Step 4: Commit**

```bash
git add services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb
git commit -m "feat(portfolio): update cast_handler for default_schedules"
```

---

## Task 7: Update Backend - Presenter

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/presenters/cast/profile_presenter.rb:23-49`

**Step 1: Add helper method for converting JSONB to proto**

Add class method:

```ruby
def self.default_schedules_to_proto(schedules)
  return [] unless schedules

  schedules.map do |s|
    ::Portfolio::V1::DefaultSchedule.new(
      start: s["start"] || "",
      end: s["end"] || ""
    )
  end
end
```

**Step 2: Update to_proto method**

Replace:

```ruby
default_schedule_start: cast.default_schedule_start,
default_schedule_end: cast.default_schedule_end,
```

With:

```ruby
default_schedules: default_schedules_to_proto(cast.default_schedules),
```

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/portfolio/presenters/cast/profile_presenter.rb
git commit -m "feat(portfolio): update profile_presenter for default_schedules"
```

---

## Task 8: Update Backend Tests - Handler Spec

**Files:**
- Modify: `services/monolith/workspace/spec/slices/portfolio/grpc/cast_handler_spec.rb:46-68`

**Step 1: Update mock_cast_entity**

Replace:

```ruby
default_schedule_start: "10:00",
default_schedule_end: "20:00",
```

With:

```ruby
default_schedules: [{ "start" => "10:00", "end" => "15:00" }, { "start" => "18:00", "end" => "23:00" }],
```

**Step 2: Run tests**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/grpc/cast_handler_spec.rb`
Expected: All tests pass

**Step 3: Commit**

```bash
git add services/monolith/workspace/spec/slices/portfolio/grpc/cast_handler_spec.rb
git commit -m "test(portfolio): update cast_handler_spec for default_schedules"
```

---

## Task 9: Update Backend Tests - Presenter Spec

**Files:**
- Modify: `services/monolith/workspace/spec/slices/portfolio/presenters/cast/profile_presenter_spec.rb:57-86,137-159`

**Step 1: Update cast double**

Replace:

```ruby
default_schedule_start: "18:00",
default_schedule_end: "23:00",
```

With:

```ruby
default_schedules: [{ "start" => "12:00", "end" => "15:00" }, { "start" => "18:00", "end" => "23:00" }],
```

**Step 2: Update cast_with_nils double**

Replace:

```ruby
default_schedule_start: nil,
default_schedule_end: nil,
```

With:

```ruby
default_schedules: nil,
```

**Step 3: Add test for default_schedules_to_proto**

```ruby
describe ".default_schedules_to_proto" do
  it "returns empty array when schedules is nil" do
    expect(described_class.default_schedules_to_proto(nil)).to eq([])
  end

  it "converts hash array to proto array" do
    schedules = [
      { "start" => "12:00", "end" => "15:00" },
      { "start" => "18:00", "end" => "23:00" }
    ]
    protos = described_class.default_schedules_to_proto(schedules)

    expect(protos.size).to eq(2)
    expect(protos[0]).to be_a(::Portfolio::V1::DefaultSchedule)
    expect(protos[0].start).to eq("12:00")
    expect(protos[0].end).to eq("15:00")
    expect(protos[1].start).to eq("18:00")
    expect(protos[1].end).to eq("23:00")
  end
end
```

**Step 4: Run tests**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/presenters/cast/profile_presenter_spec.rb`
Expected: All tests pass

**Step 5: Commit**

```bash
git add services/monolith/workspace/spec/slices/portfolio/presenters/cast/profile_presenter_spec.rb
git commit -m "test(portfolio): update profile_presenter_spec for default_schedules"
```

---

## Task 10: Update Seed Data

**Files:**
- Modify: `services/monolith/workspace/config/db/seeds.rb:196-239`

**Step 1: Add default_schedules to cast_data**

Update each cast entry to include:

```ruby
default_schedules: [
  { start: "12:00", end: "15:00" },
  { start: "18:00", end: "23:00" }
].to_json,
```

Example for Yuna:

```ruby
{
  name: "Yuna",
  slug: "yuna",
  # ... other fields ...
  default_schedules: [
    { start: "12:00", end: "15:00" },
    { start: "18:00", end: "23:00" }
  ].to_json,
},
```

**Step 2: Run seed**

Run: `cd services/monolith/workspace && bundle exec hanami db seed`
Expected: Seed completes without errors

**Step 3: Commit**

```bash
git add services/monolith/workspace/config/db/seeds.rb
git commit -m "feat(seeds): add default_schedules to cast seed data"
```

---

## Task 11: Update Frontend Types

**Files:**
- Modify: `web/nyx/workspace/src/modules/portfolio/types.ts:104-136`

**Step 1: Add DefaultSchedule interface**

Add before `ProfileFormData`:

```typescript
export interface DefaultSchedule {
  start: string;  // HH:mm
  end: string;    // HH:mm
}
```

**Step 2: Update ProfileFormData**

Replace:

```typescript
defaultScheduleStart: string; // HH:mm
defaultScheduleEnd: string; // HH:mm
```

With:

```typescript
defaultSchedules: DefaultSchedule[];
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/portfolio/types.ts
git commit -m "feat(frontend): update ProfileFormData for defaultSchedules array"
```

---

## Task 12: Update Frontend Mappers

**Files:**
- Modify: `web/nyx/workspace/src/modules/portfolio/lib/cast/mappers.ts:1-80`

**Step 1: Update mapApiToProfileForm**

Replace:

```typescript
defaultScheduleStart: apiProfile.defaultScheduleStart || "10:00",
defaultScheduleEnd: apiProfile.defaultScheduleEnd || "22:00",
```

With:

```typescript
defaultSchedules: mapApiToDefaultSchedules(apiProfile.defaultSchedules),
```

**Step 2: Add mapApiToDefaultSchedules helper**

```typescript
/**
 * Map API default schedules to DefaultSchedule array
 */
export function mapApiToDefaultSchedules(apiSchedules: any[]): DefaultSchedule[] {
  if (!apiSchedules || apiSchedules.length === 0) {
    return [{ start: "18:00", end: "23:00" }];  // Default fallback
  }
  return apiSchedules.map((s) => ({
    start: s.start || "",
    end: s.end || "",
  }));
}
```

**Step 3: Update mapProfileFormToApi**

Replace:

```typescript
defaultScheduleStart: form.defaultScheduleStart,
defaultScheduleEnd: form.defaultScheduleEnd,
```

With:

```typescript
defaultSchedules: form.defaultSchedules.map((s) => ({
  start: s.start,
  end: s.end,
})),
```

**Step 4: Update import**

Add `DefaultSchedule` to imports from types.

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/modules/portfolio/lib/cast/mappers.ts
git commit -m "feat(frontend): update mappers for defaultSchedules"
```

---

## Task 13: Update Schedules Page

**Files:**
- Modify: `web/nyx/workspace/src/app/(cast)/cast/schedules/page.tsx:17-18,70-75`

**Step 1: Update default schedule extraction**

Replace:

```typescript
const defaultScheduleStart = rawData?.profile?.defaultScheduleStart || "18:00";
const defaultScheduleEnd = rawData?.profile?.defaultScheduleEnd || "23:00";
```

With:

```typescript
const defaultSchedules = rawData?.profile?.defaultSchedules || [{ start: "18:00", end: "23:00" }];
```

**Step 2: Update ScheduleEditor props**

Replace:

```tsx
<ScheduleEditor
  schedules={schedules}
  onChange={updateSchedules}
  defaultStart={defaultScheduleStart}
  defaultEnd={defaultScheduleEnd}
/>
```

With:

```tsx
<ScheduleEditor
  schedules={schedules}
  onChange={updateSchedules}
  defaultSchedules={defaultSchedules}
/>
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/app/(cast)/cast/schedules/page.tsx
git commit -m "feat(frontend): update schedules page for multiple defaults"
```

---

## Task 14: Update ScheduleEditor Component

**Files:**
- Modify: `web/nyx/workspace/src/modules/portfolio/components/cast/ScheduleEditor.tsx:14-28,45-51`

**Step 1: Update props interface**

Replace:

```typescript
interface ScheduleEditorProps {
  schedules: WeeklySchedule[];
  onChange: (schedules: WeeklySchedule[]) => void;
  defaultStart?: string;
  defaultEnd?: string;
}
```

With:

```typescript
import { DefaultSchedule } from "@/modules/portfolio/types";

interface ScheduleEditorProps {
  schedules: WeeklySchedule[];
  onChange: (schedules: WeeklySchedule[]) => void;
  defaultSchedules?: DefaultSchedule[];
}
```

**Step 2: Update component signature**

Replace:

```typescript
export const ScheduleEditor = ({
  schedules,
  onChange,
  defaultStart = "18:00",
  defaultEnd = "23:00",
}: ScheduleEditorProps) => {
```

With:

```typescript
export const ScheduleEditor = ({
  schedules,
  onChange,
  defaultSchedules = [{ start: "18:00", end: "23:00" }],
}: ScheduleEditorProps) => {
```

**Step 3: Update addSchedule function**

Replace:

```typescript
const addSchedule = (dateStr: string) => {
  const newSchedule: WeeklySchedule = {
    date: dateStr,
    start: defaultStart,
    end: defaultEnd,
  };
  onChange([...schedules, newSchedule]);
};
```

With:

```typescript
const addSchedule = (dateStr: string) => {
  const newSchedules: WeeklySchedule[] = defaultSchedules.map((ds) => ({
    date: dateStr,
    start: ds.start,
    end: ds.end,
  }));
  onChange([...schedules, ...newSchedules]);
};
```

**Step 4: Commit**

```bash
git add web/nyx/workspace/src/modules/portfolio/components/cast/ScheduleEditor.tsx
git commit -m "feat(frontend): update ScheduleEditor for multiple default schedules"
```

---

## Task 15: Create DefaultSchedulesEditor Component

**Files:**
- Create: `web/nyx/workspace/src/modules/portfolio/components/cast/DefaultSchedulesEditor.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { Plus, Trash2, Clock } from "lucide-react";
import { DefaultSchedule } from "@/modules/portfolio/types";

interface DefaultSchedulesEditorProps {
  schedules: DefaultSchedule[];
  onChange: (schedules: DefaultSchedule[]) => void;
}

export const DefaultSchedulesEditor = ({
  schedules,
  onChange,
}: DefaultSchedulesEditorProps) => {
  const addSchedule = () => {
    onChange([...schedules, { start: "18:00", end: "23:00" }]);
  };

  const updateSchedule = (index: number, field: keyof DefaultSchedule, value: string) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    onChange(newSchedules);
  };

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) return; // Keep at least one
    onChange(schedules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">
          デフォルトスケジュール
        </label>
        <button
          type="button"
          onClick={addSchedule}
          className="flex items-center gap-1 rounded-lg bg-role-cast-lighter px-3 py-1.5 text-xs font-bold text-role-cast transition-colors hover:bg-role-cast-light border border-role-cast-light"
        >
          <Plus size={14} />
          <span>追加</span>
        </button>
      </div>

      <div className="space-y-2">
        {schedules.map((schedule, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-lg bg-surface border border-border p-3"
          >
            <Clock size={16} className="text-text-muted shrink-0" />
            <span className="text-sm text-text-muted w-6">{index + 1}.</span>
            <input
              type="time"
              value={schedule.start}
              onChange={(e) => updateSchedule(index, "start", e.target.value)}
              className="bg-surface-secondary font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-role-cast text-sm border border-border rounded px-2 py-1.5 w-28"
            />
            <span className="text-text-muted">〜</span>
            <input
              type="time"
              value={schedule.end}
              onChange={(e) => updateSchedule(index, "end", e.target.value)}
              className="bg-surface-secondary font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-role-cast text-sm border border-border rounded px-2 py-1.5 w-28"
            />
            {schedules.length > 1 && (
              <button
                type="button"
                onClick={() => removeSchedule(index)}
                className="ml-auto rounded-lg p-1.5 text-text-muted hover:bg-error-lighter hover:text-error transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        新規スケジュール追加時にこの時間帯がデフォルトとして設定されます
      </p>
    </div>
  );
};
```

**Step 2: Export from index**

Add to `web/nyx/workspace/src/modules/portfolio/components/cast/index.ts`:

```typescript
export { DefaultSchedulesEditor } from "./DefaultSchedulesEditor";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/portfolio/components/cast/DefaultSchedulesEditor.tsx
git add web/nyx/workspace/src/modules/portfolio/components/cast/index.ts
git commit -m "feat(frontend): add DefaultSchedulesEditor component"
```

---

## Task 16: Integrate DefaultSchedulesEditor into Profile Edit

**Files:**
- Modify: Profile edit form component (find the file that uses `defaultScheduleStart`/`defaultScheduleEnd`)

**Step 1: Find and update the profile edit form**

Search for the component that renders profile editing form and uses `defaultScheduleStart`.

**Step 2: Replace time inputs with DefaultSchedulesEditor**

```tsx
import { DefaultSchedulesEditor } from "@/modules/portfolio/components/cast";

// In the form:
<DefaultSchedulesEditor
  schedules={formData.defaultSchedules}
  onChange={(schedules) => setFormData({ ...formData, defaultSchedules: schedules })}
/>
```

**Step 3: Commit**

```bash
git add <profile-edit-form-file>
git commit -m "feat(frontend): integrate DefaultSchedulesEditor into profile edit"
```

---

## Task 17: Update useCastProfile Hook

**Files:**
- Modify: `web/nyx/workspace/src/modules/portfolio/hooks/useCastProfile.ts`

**Step 1: Update default form data**

Find where default `ProfileFormData` is created and update:

Replace:

```typescript
defaultScheduleStart: "10:00",
defaultScheduleEnd: "22:00",
```

With:

```typescript
defaultSchedules: [{ start: "18:00", end: "23:00" }],
```

**Step 2: Commit**

```bash
git add web/nyx/workspace/src/modules/portfolio/hooks/useCastProfile.ts
git commit -m "feat(frontend): update useCastProfile default for defaultSchedules"
```

---

## Task 18: Run Full Test Suite

**Files:**
- None (verification only)

**Step 1: Run backend tests**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/`
Expected: All tests pass

**Step 2: Run frontend type check**

Run: `cd web/nyx/workspace && pnpm tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Run frontend lint**

Run: `cd web/nyx/workspace && pnpm lint`
Expected: No lint errors

**Step 4: Manual test**

1. Login as cast (09011111111 / 0000)
2. Go to profile edit page
3. Verify DefaultSchedulesEditor shows
4. Add/remove time slots
5. Save and verify data persists
6. Go to schedules page
7. Add new day - verify all default time slots are added

---

## Task 19: Final Commit

**Step 1: Create summary commit if needed**

If there are any uncommitted changes:

```bash
git add -A
git commit -m "feat(portfolio): complete multiple default schedules feature"
```

**Step 2: Verify all commits**

Run: `git log --oneline -15`
Expected: All feature commits present
