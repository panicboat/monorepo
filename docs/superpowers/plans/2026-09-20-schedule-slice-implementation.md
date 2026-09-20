# Schedule Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a cast publish which dates/times they will be working ("出勤スケジュール"), as a new, independent `schedule` slice that guests can read on a cast's profile.

**Architecture:** A brand-new full-stack vertical slice, mirroring the existing `footprints` slice's shape exactly (proto service → Ruby `schedule` slice with its own schema/table → Next.js BFF API routes → `schedule` frontend module). One table holds only the days a cast is actually working; an absent row for a date means "off" and is rendered as `-` by the frontend, never persisted. No booking, no availability slots, no location/shop field — see the spec for why.

**Tech Stack:** Ruby/Hanami/ROM-SQL (monolith), Connect-RPC/protobuf via `buf`, Next.js API routes (BFF), React/SWR (frontend), RSpec (`type: :database`) and Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-09-19-schedule-slice-design.md` (also read `docs/superpowers/specs/2026-05-31-domain-context-map-design.md`'s "Amendment (2026-09-19)" for why this doesn't contradict the keystone's commerce-dimension drop)

## Global Constraints

- No booking/reservation semantics, no availability-slot field, no location/shop field on a schedule row (spec: "Dropped").
- One row per `(account_id, work_date)`; a missing row means the cast is off that day — never insert an explicit "off" row.
- `start_time`/`end_time` are free-form `"HH:MM"` strings (not SQL `time`), because shifts can cross midnight (e.g. `20:00`–`02:00`).
- `ListSchedules` requires only that the caller be an authenticated account (any role) — same as `Profile::V1::ProfileService#GetProfileByUsername`. `SaveSchedule`/`DeleteSchedule` act only on the authenticated caller's own `account_id` (never accept a target account_id in the request).
- New slice name is `schedule` (not `shift` or `attendance` — see spec's naming rationale).

---

## Task 1: Proto contract for `schedule.v1`

**Files:**
- Create: `proto/dystopia/schedule/v1/schedule_service.proto`
- Modify (generated, do not hand-edit further): `dystopia/monolith/stubs/schedule/v1/schedule_service_pb.rb`, `dystopia/monolith/stubs/schedule/v1/schedule_service_services_pb.rb`, `dystopia/frontend/src/stub/schedule/v1/schedule_service_pb.ts`

**Interfaces:**
- Produces: `Schedule::V1::Schedule` (Ruby) / `Schedule` (TS) with fields `account_id`, `work_date` ("YYYY-MM-DD"), `start_time` ("HH:MM"), `end_time` ("HH:MM"). `Schedule::V1::ScheduleService` (Ruby) / `ScheduleService` (TS) with RPCs `ListSchedules`, `SaveSchedule`, `DeleteSchedule`.

- [ ] **Step 1: Write the proto file**

Create `proto/dystopia/schedule/v1/schedule_service.proto`:

```proto
syntax = "proto3";

package schedule.v1;

// Cast self-published attendance, not a booking system — see docs/superpowers/specs/2026-09-19-schedule-slice-design.md
service ScheduleService {
  // Rows in [from_date, to_date] inclusive; a missing date means the cast is off
  rpc ListSchedules(ListSchedulesRequest) returns (ListSchedulesResponse);

  // Upserts the caller's own row; account_id comes from the authenticated caller, never the request
  rpc SaveSchedule(SaveScheduleRequest) returns (SaveScheduleResponse);

  // Deletes the caller's own row for work_date (= marks that day as off).
  rpc DeleteSchedule(DeleteScheduleRequest) returns (DeleteScheduleResponse);
}

message Schedule {
  string account_id = 1;
  string work_date = 2;   // "YYYY-MM-DD"
  string start_time = 3;  // "HH:MM"
  string end_time = 4;    // "HH:MM", may be earlier than start_time (crosses midnight)
}

message ListSchedulesRequest {
  string account_id = 1;
  string from_date = 2;  // "YYYY-MM-DD", inclusive
  string to_date = 3;    // "YYYY-MM-DD", inclusive
}

message ListSchedulesResponse {
  repeated Schedule schedules = 1;
}

message SaveScheduleRequest {
  string work_date = 1;
  string start_time = 2;
  string end_time = 3;
}

message SaveScheduleResponse {
  Schedule schedule = 1;
}

message DeleteScheduleRequest {
  string work_date = 1;
}

message DeleteScheduleResponse {}
```

- [ ] **Step 2: Lint the proto**

Run: `cd proto && buf lint dystopia/schedule/v1/schedule_service.proto`
Expected: no errors for this file (pre-existing "imported file does not exist" warnings on unrelated files are a known baseline issue — ignore them).

- [ ] **Step 3: Generate the Ruby stubs**

Run: `cd dystopia/monolith && ruby bin/codegen`
Expected: `✅ Done.` and `git status --short dystopia/monolith/stubs` shows only files under `dystopia/monolith/stubs/schedule/v1/` as new/changed.

- [ ] **Step 4: Generate the TypeScript stubs**

Run: `cd dystopia/frontend && pnpm proto:gen`

This regenerates every proto package's TS stub, not just `schedule` (a known side effect of `buf generate` on this workspace). Run `git status --short dystopia/frontend/src/stub` and revert every file except `dystopia/frontend/src/stub/schedule/v1/schedule_service_pb.ts` and any new `dystopia/frontend/src/stub/billing/v1/service_pb.ts` (delete that one if it appears untracked — it's unrelated codegen drift, not part of this change):

```bash
git status --short dystopia/frontend/src/stub | grep -v 'schedule/v1/schedule_service_pb.ts' | awk '{print $2}' | xargs -I{} git checkout -- {}
rm -f dystopia/frontend/src/stub/billing/v1/service_pb.ts
git status --short dystopia/frontend/src/stub
```

Expected: only `dystopia/frontend/src/stub/schedule/v1/schedule_service_pb.ts` shows as new (`??` or `A`).

- [ ] **Step 5: Commit**

```bash
git add proto/dystopia/schedule/v1/schedule_service.proto \
  dystopia/monolith/stubs/schedule/v1/ \
  dystopia/frontend/src/stub/schedule/v1/
git commit -s -m "feat(dystopia): add schedule.v1 proto contract"
```

---

## Task 2: Database migration

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20260920000000_create_schedule_schema.rb`

**Interfaces:**
- Produces: table `schedule.schedules` (id uuid PK, account_id uuid, work_date date, start_time varchar(5), end_time varchar(5), created_at/updated_at timestamptz), unique on `(account_id, work_date)`.

- [ ] **Step 1: Write the migration**

Create `dystopia/monolith/config/db/migrate/20260920000000_create_schedule_schema.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS schedule"

    create_table :"schedule__schedules" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :work_date, :date, null: false
      column :start_time, :varchar, size: 5, null: false
      column :end_time, :varchar, size: 5, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id, :work_date], name: :uq_schedule_schedules_account_date
    end
  end

  down do
    drop_table :"schedule__schedules"
    run "DROP SCHEMA IF EXISTS schedule CASCADE"
  end
end
```

- [ ] **Step 2: Apply it to the test database**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: `=> database monolith_test migrated in ...` with no errors.

- [ ] **Step 3: Verify the table shape**

Run: `psql -h localhost -p 5432 -U "$(whoami)" -d monolith_test -c "\d schedule.schedules"`
Expected: lists all 7 columns and the `uq_schedule_schedules_account_date` unique index.

- [ ] **Step 4: Commit**

```bash
git add dystopia/monolith/config/db/migrate/20260920000000_create_schedule_schema.rb dystopia/monolith/config/db/structure.sql
git commit -s -m "feat(dystopia): create schedule.schedules table"
```

---

## Task 3: `schedule` slice scaffolding + repository

**Files:**
- Create: `dystopia/monolith/slices/schedule/config/slice.rb`
- Create: `dystopia/monolith/slices/schedule/db/relation.rb`
- Create: `dystopia/monolith/slices/schedule/db/repo.rb`
- Create: `dystopia/monolith/slices/schedule/relations/schedule_records.rb`
- Create: `dystopia/monolith/slices/schedule/repositories/schedule_repository.rb`
- Test: `dystopia/monolith/spec/slices/schedule/repositories/schedule_repository_spec.rb`

**Interfaces:**
- Consumes: table `schedule.schedules` from Task 2.
- Produces: `Schedule::Repositories::ScheduleRepository` with `#list(account_id:, from_date:, to_date:) -> Array<ROM struct with .account_id/.work_date/.start_time/.end_time>`, `#upsert(account_id:, work_date:, start_time:, end_time:) -> Hash with :account_id/:work_date/:start_time/:end_time`, `#delete(account_id:, work_date:) -> void`. Available in the container as `Hanami.app.slices[:schedule]["repositories.schedule_repository"]`.

- [ ] **Step 1: Create the slice scaffolding files**

Create `dystopia/monolith/slices/schedule/config/slice.rb`:

```ruby
# frozen_string_literal: true

module Schedule
  class Slice < Hanami::Slice
  end
end
```

Create `dystopia/monolith/slices/schedule/db/relation.rb`:

```ruby
# frozen_string_literal: true

module Schedule
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

Create `dystopia/monolith/slices/schedule/db/repo.rb`:

```ruby
# frozen_string_literal: true

module Schedule
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

Create `dystopia/monolith/slices/schedule/relations/schedule_records.rb`:

```ruby
# frozen_string_literal: true

module Schedule
  module Relations
    class ScheduleRecords < Schedule::DB::Relation
      schema(:"schedule__schedules", as: :schedule_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :work_date, Types::Date
        attribute :start_time, Types::String
        attribute :end_time, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 2: Write the failing repository spec**

Create `dystopia/monolith/spec/slices/schedule/repositories/schedule_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::Repositories::ScheduleRepository", type: :database do
  let(:repo) { Hanami.app.slices[:schedule]["repositories.schedule_repository"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "creates a row on the first upsert for a date" do
    row = repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    expect(row[:account_id]).to eq(account_id)
    expect(row[:start_time]).to eq("20:00")
    expect(row[:end_time]).to eq("02:00")
  end

  it "overwrites the same row on a second upsert for the same date" do
    repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "21:00", end_time: "03:00")

    rows = repo.list(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows.size).to eq(1)
    expect(rows.first.start_time).to eq("21:00")
  end

  it "lists only rows within the given date range" do
    repo.upsert(account_id: account_id, work_date: "2026-09-18", start_time: "20:00", end_time: "02:00")
    repo.upsert(account_id: account_id, work_date: "2026-09-25", start_time: "20:00", end_time: "02:00")

    rows = repo.list(account_id: account_id, from_date: "2026-09-19", to_date: "2026-09-21")
    expect(rows).to be_empty
  end

  it "does not return another account's rows" do
    other_account_id = SecureRandom.uuid_v7
    repo.upsert(account_id: other_account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")

    rows = repo.list(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end

  it "deletes a row, making that date off again" do
    repo.upsert(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    repo.delete(account_id: account_id, work_date: "2026-09-20")

    rows = repo.list(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end
end
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/schedule/repositories/schedule_repository_spec.rb`
Expected: FAIL — `Hanami.app.slices[:schedule]` raises or `repositories.schedule_repository` is not registered, because `ScheduleRepository` does not exist yet.

- [ ] **Step 4: Write the repository**

Create `dystopia/monolith/slices/schedule/repositories/schedule_repository.rb`:

```ruby
# frozen_string_literal: true

module Schedule
  module Repositories
    class ScheduleRepository < Schedule::DB::Repo
      def list(account_id:, from_date:, to_date:)
        schedule_records
          .where(account_id: account_id)
          .where { (work_date >= from_date) & (work_date <= to_date) }
          .order { work_date.asc }
          .to_a
      end

      # Upserts by (account_id, work_date); returns a raw-SQL row hash, matching FootprintsRepository#upsert_visit
      def upsert(account_id:, work_date:, start_time:, end_time:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO schedule.schedules
            (id, account_id, work_date, start_time, end_time, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (account_id, work_date) DO UPDATE
            SET start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                updated_at = EXCLUDED.updated_at
          RETURNING id, account_id, work_date, start_time, end_time, created_at, updated_at
        SQL

        ds = schedule_records.dataset.db
        ds.fetch(sql, new_id, account_id, work_date, start_time, end_time, now, now).first
      end

      def delete(account_id:, work_date:)
        schedule_records.dataset.where(account_id: account_id, work_date: work_date).delete
      end
    end
  end
end
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/schedule/repositories/schedule_repository_spec.rb --format documentation`
Expected: `5 examples, 0 failures`

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/slices/schedule/config \
  dystopia/monolith/slices/schedule/db \
  dystopia/monolith/slices/schedule/relations \
  dystopia/monolith/slices/schedule/repositories \
  dystopia/monolith/spec/slices/schedule/repositories
git commit -s -m "feat(dystopia): scaffold schedule slice with ScheduleRepository"
```

---

## Task 4: Use cases

**Files:**
- Create: `dystopia/monolith/slices/schedule/use_cases/list_schedules.rb`
- Create: `dystopia/monolith/slices/schedule/use_cases/save_schedule.rb`
- Create: `dystopia/monolith/slices/schedule/use_cases/delete_schedule.rb`
- Test: `dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb`
- Test: `dystopia/monolith/spec/slices/schedule/use_cases/save_schedule_spec.rb`
- Test: `dystopia/monolith/spec/slices/schedule/use_cases/delete_schedule_spec.rb`

**Interfaces:**
- Consumes: `Schedule::Repositories::ScheduleRepository#list/#upsert/#delete` from Task 3.
- Produces: `Schedule::UseCases::ListSchedules#call(account_id:, from_date:, to_date:) -> Array` (same shape as repo `#list`), `Schedule::UseCases::SaveSchedule#call(account_id:, work_date:, start_time:, end_time:) -> Hash` (raises `Errors::ValidationError` on bad input), `Schedule::UseCases::DeleteSchedule#call(account_id:, work_date:) -> void`. Registered as `use_cases.list_schedules` / `use_cases.save_schedule` / `use_cases.delete_schedule`.

- [ ] **Step 1: Write the failing use case specs**

Create `dystopia/monolith/spec/slices/schedule/use_cases/save_schedule_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Schedule::UseCases::SaveSchedule", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "saves a valid schedule" do
    row = uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    expect(row[:start_time]).to eq("20:00")
    expect(row[:end_time]).to eq("02:00")
  end

  it "rejects a malformed start_time" do
    expect {
      uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "8pm", end_time: "02:00")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects a malformed work_date" do
    expect {
      uc.call(account_id: account_id, work_date: "Sept 20", start_time: "20:00", end_time: "02:00")
    }.to raise_error(Errors::ValidationError)
  end
end
```

Create `dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::UseCases::ListSchedules", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.list_schedules"] }
  let(:save_uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "returns rows within the date range" do
    save_uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")

    rows = uc.call(account_id: account_id, from_date: "2026-09-19", to_date: "2026-09-21")
    expect(rows.size).to eq(1)
    expect(rows.first.work_date.to_s).to eq("2026-09-20")
  end
end
```

Create `dystopia/monolith/spec/slices/schedule/use_cases/delete_schedule_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Schedule::UseCases::DeleteSchedule", type: :database do
  let(:uc) { Hanami.app.slices[:schedule]["use_cases.delete_schedule"] }
  let(:save_uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
  let(:list_uc) { Hanami.app.slices[:schedule]["use_cases.list_schedules"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "removes the row for that date" do
    save_uc.call(account_id: account_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
    uc.call(account_id: account_id, work_date: "2026-09-20")

    rows = list_uc.call(account_id: account_id, from_date: "2026-09-20", to_date: "2026-09-20")
    expect(rows).to be_empty
  end
end
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/schedule/use_cases/`
Expected: FAIL — `use_cases.save_schedule` / `use_cases.list_schedules` / `use_cases.delete_schedule` are not registered yet.

- [ ] **Step 3: Write the use cases**

Create `dystopia/monolith/slices/schedule/use_cases/list_schedules.rb`:

```ruby
# frozen_string_literal: true

module Schedule
  module UseCases
    class ListSchedules
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      def call(account_id:, from_date:, to_date:)
        schedule_repo.list(account_id: account_id, from_date: from_date, to_date: to_date)
      end
    end
  end
end
```

Create `dystopia/monolith/slices/schedule/use_cases/save_schedule.rb`:

```ruby
# frozen_string_literal: true

require "errors/validation_error"

module Schedule
  module UseCases
    class SaveSchedule
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/
      TIME_FORMAT = /\A([01]\d|2[0-3]):[0-5]\d\z/

      def call(account_id:, work_date:, start_time:, end_time:)
        validate_format!(work_date, DATE_FORMAT, "出勤日")
        validate_format!(start_time, TIME_FORMAT, "開始時刻")
        validate_format!(end_time, TIME_FORMAT, "終了時刻")

        schedule_repo.upsert(
          account_id: account_id,
          work_date: work_date,
          start_time: start_time,
          end_time: end_time
        )
      end

      private

      def validate_format!(value, format, label)
        unless value.is_a?(String) && value.match?(format)
          raise Errors::ValidationError, "#{label}の形式が正しくありません"
        end
      end
    end
  end
end
```

Create `dystopia/monolith/slices/schedule/use_cases/delete_schedule.rb`:

```ruby
# frozen_string_literal: true

module Schedule
  module UseCases
    class DeleteSchedule
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      def call(account_id:, work_date:)
        schedule_repo.delete(account_id: account_id, work_date: work_date)
      end
    end
  end
end
```

- [ ] **Step 4: Run the specs to verify they pass**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/schedule/`
Expected: `10 examples, 0 failures` (5 repository examples from Task 3 + 3 save_schedule + 1 list_schedules + 1 delete_schedule from this task)

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/schedule/use_cases dystopia/monolith/spec/slices/schedule/use_cases
git commit -s -m "feat(dystopia): add schedule use cases"
```

---

## Task 5: gRPC handler

**Files:**
- Create: `dystopia/monolith/slices/schedule/grpc/handler.rb`
- Create: `dystopia/monolith/slices/schedule/grpc/schedule_handler.rb`
- Modify: `dystopia/monolith/bin/grpc`

**Interfaces:**
- Consumes: `use_cases.list_schedules` / `use_cases.save_schedule` / `use_cases.delete_schedule` from Task 4; `authenticate_user!` / `current_user_id` from `Grpc::Authenticatable` (`dystopia/monolith/lib/grpc/authenticatable.rb`, already exists).
- Produces: `Schedule::Grpc::ScheduleHandler` bound to `schedule.v1.ScheduleService`.

- [ ] **Step 1: Write the handler base class**

Create `dystopia/monolith/slices/schedule/grpc/handler.rb`:

```ruby
# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Schedule
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
    end
  end
end
```

- [ ] **Step 2: Write the concrete handler**

Create `dystopia/monolith/slices/schedule/grpc/schedule_handler.rb`:

```ruby
# frozen_string_literal: true

require "schedule/v1/schedule_service_services_pb"
require_relative "handler"
require "errors/validation_error"

module Schedule
  module Grpc
    class ScheduleHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "schedule.v1.ScheduleService"

      bind ::Schedule::V1::ScheduleService::Service

      self.rpc_descs.clear

      rpc :ListSchedules, ::Schedule::V1::ListSchedulesRequest, ::Schedule::V1::ListSchedulesResponse
      rpc :SaveSchedule, ::Schedule::V1::SaveScheduleRequest, ::Schedule::V1::SaveScheduleResponse
      rpc :DeleteSchedule, ::Schedule::V1::DeleteScheduleRequest, ::Schedule::V1::DeleteScheduleResponse

      include Schedule::Deps[
        list_schedules_uc: "use_cases.list_schedules",
        save_schedule_uc: "use_cases.save_schedule",
        delete_schedule_uc: "use_cases.delete_schedule"
      ]

      def list_schedules
        authenticate_user!
        m = request.message
        rows = list_schedules_uc.call(account_id: m.account_id, from_date: m.from_date, to_date: m.to_date)

        ::Schedule::V1::ListSchedulesResponse.new(
          schedules: rows.map { |r|
            ::Schedule::V1::Schedule.new(
              account_id: r.account_id.to_s,
              work_date: r.work_date.to_s,
              start_time: r.start_time.to_s,
              end_time: r.end_time.to_s
            )
          }
        )
      end

      def save_schedule
        authenticate_user!
        m = request.message
        row = save_schedule_uc.call(
          account_id: current_user_id,
          work_date: m.work_date,
          start_time: m.start_time,
          end_time: m.end_time
        )

        ::Schedule::V1::SaveScheduleResponse.new(
          schedule: ::Schedule::V1::Schedule.new(
            account_id: row[:account_id].to_s,
            work_date: row[:work_date].to_s,
            start_time: row[:start_time],
            end_time: row[:end_time]
          )
        )
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def delete_schedule
        authenticate_user!
        delete_schedule_uc.call(account_id: current_user_id, work_date: request.message.work_date)
        ::Schedule::V1::DeleteScheduleResponse.new
      end
    end
  end
end
```

- [ ] **Step 3: Register the handler in the gRPC server boot script**

In `dystopia/monolith/bin/grpc`, find this line (near line 51):

```ruby
require "footprints/v1/footprints_service_services_pb"
```

Add immediately after it:

```ruby
require "schedule/v1/schedule_service_services_pb"
```

Then find this line (near line 109):

```ruby
require_relative "../slices/footprints/grpc/footprints_handler"
```

Add immediately after it:

```ruby
require_relative "../slices/schedule/grpc/handler"
require_relative "../slices/schedule/grpc/schedule_handler"
```

- [ ] **Step 4: Verify the whole monolith test suite still passes**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec`
Expected: all examples pass, 0 failures (this confirms the new handler files load without breaking Zeitwerk autoloading; RSpec loads the full app the same way `bin/grpc` does).

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/schedule/grpc dystopia/monolith/bin/grpc
git commit -s -m "feat(dystopia): add ScheduleHandler and register it in bin/grpc"
```

---

## Task 6: Frontend proto client, types, and mappers

**Files:**
- Modify: `dystopia/frontend/src/lib/grpc.ts`
- Create: `dystopia/frontend/src/modules/schedule/types.ts`
- Create: `dystopia/frontend/src/modules/schedule/lib/mappers.ts`
- Test: `dystopia/frontend/src/modules/schedule/lib/mappers.test.ts`

**Interfaces:**
- Consumes: `Schedule` / `ScheduleService` from `@/stub/schedule/v1/schedule_service_pb` (Task 1).
- Produces: `scheduleClient` (exported from `@/lib/grpc`), `ScheduleView { accountId, workDate, startTime, endTime }` (`@/modules/schedule/types`), `mapScheduleToView(proto: Schedule): ScheduleView` (`@/modules/schedule/lib/mappers`).

- [ ] **Step 1: Register the gRPC client**

In `dystopia/frontend/src/lib/grpc.ts`, add this import after the `FootprintsService` import (near line 18):

```ts
import { ScheduleService } from "@/stub/schedule/v1/schedule_service_pb";
```

Add this export at the end of the file:

```ts
// Schedule domain client (schedule.v1)
export const scheduleClient = createClient(ScheduleService, transport);
```

- [ ] **Step 2: Write the type**

Create `dystopia/frontend/src/modules/schedule/types.ts`:

```ts
export interface ScheduleView {
  accountId: string;
  workDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}
```

- [ ] **Step 3: Write the failing mapper test**

Create `dystopia/frontend/src/modules/schedule/lib/mappers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";
import { mapScheduleToView } from "./mappers";

describe("mapScheduleToView", () => {
  it("maps all fields from the proto", () => {
    const proto = create(ScheduleSchema, {
      accountId: "acc-1",
      workDate: "2026-09-20",
      startTime: "20:00",
      endTime: "02:00",
    });

    expect(mapScheduleToView(proto)).toEqual({
      accountId: "acc-1",
      workDate: "2026-09-20",
      startTime: "20:00",
      endTime: "02:00",
    });
  });

  it("defaults missing fields to empty strings", () => {
    const proto = create(ScheduleSchema, {});

    expect(mapScheduleToView(proto)).toEqual({
      accountId: "",
      workDate: "",
      startTime: "",
      endTime: "",
    });
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/schedule/lib/mappers.test.ts`
Expected: FAIL — `Cannot find module './mappers'`

- [ ] **Step 5: Write the mapper**

Create `dystopia/frontend/src/modules/schedule/lib/mappers.ts`:

```ts
import type { Schedule } from "@/stub/schedule/v1/schedule_service_pb";
import type { ScheduleView } from "@/modules/schedule/types";

export function mapScheduleToView(p: Schedule): ScheduleView {
  return {
    accountId: p.accountId || "",
    workDate: p.workDate || "",
    startTime: p.startTime || "",
    endTime: p.endTime || "",
  };
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/schedule/lib/mappers.test.ts`
Expected: `Tests  2 passed (2)`

- [ ] **Step 7: Commit**

```bash
git add dystopia/frontend/src/lib/grpc.ts dystopia/frontend/src/modules/schedule/types.ts dystopia/frontend/src/modules/schedule/lib/mappers.ts dystopia/frontend/src/modules/schedule/lib/mappers.test.ts
git commit -s -m "feat(dystopia): add schedule gRPC client and view mapper"
```

---

## Task 7: BFF API routes

**Files:**
- Create: `dystopia/frontend/src/app/api/schedule/list/route.ts`
- Create: `dystopia/frontend/src/app/api/schedule/save/route.ts`
- Create: `dystopia/frontend/src/app/api/schedule/delete/route.ts`

**Interfaces:**
- Consumes: `scheduleClient`, `mapScheduleToView` from Task 6; `requireAuth`, `handleApiError` from `@/lib/api-helpers`; `buildGrpcHeaders` from `@/lib/request`.
- Produces: `GET /api/schedule/list?accountId=&fromDate=&toDate=` → `{ schedules: ScheduleView[] }`; `POST /api/schedule/save` (body `{ workDate, startTime, endTime }`) → `{ schedule: ScheduleView }`; `POST /api/schedule/delete` (body `{ workDate }`) → `{}`.

- [ ] **Step 1: Write the list route**

Create `dystopia/frontend/src/app/api/schedule/list/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { scheduleClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapScheduleToView } from "@/modules/schedule/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const accountId = req.nextUrl.searchParams.get("accountId") || "";
    const fromDate = req.nextUrl.searchParams.get("fromDate") || "";
    const toDate = req.nextUrl.searchParams.get("toDate") || "";

    const res = await scheduleClient.listSchedules({ accountId, fromDate, toDate }, { headers });
    return NextResponse.json({ schedules: (res.schedules || []).map(mapScheduleToView) });
  } catch (error: unknown) {
    return handleApiError(error, "ListSchedules");
  }
}
```

- [ ] **Step 2: Write the save route**

Create `dystopia/frontend/src/app/api/schedule/save/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { scheduleClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapScheduleToView } from "@/modules/schedule/lib/mappers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    const res = await scheduleClient.saveSchedule(
      {
        workDate: body?.workDate || "",
        startTime: body?.startTime || "",
        endTime: body?.endTime || "",
      },
      { headers }
    );
    return NextResponse.json({ schedule: res.schedule ? mapScheduleToView(res.schedule) : null });
  } catch (error: unknown) {
    return handleApiError(error, "SaveSchedule");
  }
}
```

- [ ] **Step 3: Write the delete route**

Create `dystopia/frontend/src/app/api/schedule/delete/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { scheduleClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const body = await req.json();
    await scheduleClient.deleteSchedule({ workDate: body?.workDate || "" }, { headers });
    return NextResponse.json({});
  } catch (error: unknown) {
    return handleApiError(error, "DeleteSchedule");
  }
}
```

- [ ] **Step 4: Type-check**

Run: `cd dystopia/frontend && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/app/api/schedule
git commit -s -m "feat(dystopia): add schedule BFF API routes"
```

---

## Task 8: Frontend hooks and date helpers

**Files:**
- Create: `dystopia/frontend/src/modules/schedule/lib/dates.ts`
- Test: `dystopia/frontend/src/modules/schedule/lib/dates.test.ts`
- Create: `dystopia/frontend/src/modules/schedule/hooks/useSchedules.ts`
- Create: `dystopia/frontend/src/modules/schedule/hooks/useSaveSchedule.ts`
- Create: `dystopia/frontend/src/modules/schedule/hooks/useDeleteSchedule.ts`
- Create: `dystopia/frontend/src/modules/schedule/hooks/index.ts`

**Interfaces:**
- Consumes: `fetcher` from `@/lib/swr`; `authFetch` from `@/lib/auth/fetch`; `ScheduleView` from Task 6.
- Produces: `toDateKey(d: Date): string`, `formatDayLabel(dateKey: string): string`, `buildDateRange(start: Date, days: number): string[]` (`@/modules/schedule/lib/dates`); `useSchedules(accountId: string | null, fromDate: string, toDate: string) -> { schedules: ScheduleView[], loading: boolean, error: unknown, refresh: () => void }`; `useSaveSchedule() -> (workDate: string, startTime: string, endTime: string) => Promise<void>`; `useDeleteSchedule() -> (workDate: string) => Promise<void>` (all from `@/modules/schedule/hooks`).

- [ ] **Step 1: Write the failing date-helper tests**

Create `dystopia/frontend/src/modules/schedule/lib/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toDateKey, formatDayLabel, buildDateRange } from "./dates";

describe("toDateKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date(2026, 8, 20))).toBe("2026-09-20");
  });

  it("zero-pads single-digit month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatDayLabel", () => {
  it("formats a date key with its Japanese weekday", () => {
    // 2026-09-20 is a Sunday
    expect(formatDayLabel("2026-09-20")).toBe("9/20(日)");
  });
});

describe("buildDateRange", () => {
  it("returns consecutive date keys starting from the given date", () => {
    expect(buildDateRange(new Date(2026, 8, 18), 3)).toEqual([
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/schedule/lib/dates.test.ts`
Expected: FAIL — `Cannot find module './dates'`

- [ ] **Step 3: Write the date helpers**

Create `dystopia/frontend/src/modules/schedule/lib/dates.ts`:

```ts
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function buildDateRange(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) => toDateKey(new Date(start.getTime() + i * MS_PER_DAY)));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/schedule/lib/dates.test.ts`
Expected: `Tests  4 passed (4)`

- [ ] **Step 5: Write the hooks**

Create `dystopia/frontend/src/modules/schedule/hooks/useSchedules.ts`:

```ts
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { ScheduleView } from "@/modules/schedule/types";

interface ListSchedulesResponse {
  schedules: ScheduleView[];
}

export function useSchedules(accountId: string | null, fromDate: string, toDate: string) {
  const key = accountId
    ? `/api/schedule/list?accountId=${encodeURIComponent(accountId)}&fromDate=${fromDate}&toDate=${toDate}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ListSchedulesResponse>(key, fetcher);

  return {
    schedules: data?.schedules || [],
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

Create `dystopia/frontend/src/modules/schedule/hooks/useSaveSchedule.ts`:

```ts
"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useSaveSchedule() {
  return useCallback(async (workDate: string, startTime: string, endTime: string): Promise<void> => {
    await authFetch("/api/schedule/save", {
      method: "POST",
      body: { workDate, startTime, endTime },
    });
  }, []);
}
```

Create `dystopia/frontend/src/modules/schedule/hooks/useDeleteSchedule.ts`:

```ts
"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useDeleteSchedule() {
  return useCallback(async (workDate: string): Promise<void> => {
    await authFetch("/api/schedule/delete", {
      method: "POST",
      body: { workDate },
    });
  }, []);
}
```

Create `dystopia/frontend/src/modules/schedule/hooks/index.ts`:

```ts
export { useSchedules } from "./useSchedules";
export { useSaveSchedule } from "./useSaveSchedule";
export { useDeleteSchedule } from "./useDeleteSchedule";
```

- [ ] **Step 6: Type-check**

Run: `cd dystopia/frontend && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add dystopia/frontend/src/modules/schedule/lib/dates.ts dystopia/frontend/src/modules/schedule/lib/dates.test.ts dystopia/frontend/src/modules/schedule/hooks
git commit -s -m "feat(dystopia): add schedule hooks and date helpers"
```

---

## Task 9: `ScheduleSection` component and page wiring

**Files:**
- Create: `dystopia/frontend/src/modules/schedule/components/ScheduleSection.tsx`
- Create: `dystopia/frontend/src/modules/schedule/index.ts`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`
- Modify: `dystopia/frontend/src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `useSchedules`, `useSaveSchedule`, `useDeleteSchedule` from Task 8; `formatDayLabel`, `buildDateRange` from Task 8; `Button` from `@/components/ui/button`.
- Produces: `<ScheduleSection accountId={string} isOwner={boolean} />`.

This task has no new pure logic to TDD (it wires already-tested hooks/helpers into JSX); it follows this codebase's existing convention of not unit-testing presentational components (see `ProfileHeader.tsx`/`EditProfileModal.tsx`, which also have no direct tests). Verification is type-check + full test suite + manual read-through.

- [ ] **Step 1: Write the component**

Create `dystopia/frontend/src/modules/schedule/components/ScheduleSection.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSchedules, useSaveSchedule, useDeleteSchedule } from "@/modules/schedule/hooks";
import { formatDayLabel, buildDateRange } from "@/modules/schedule/lib/dates";

interface ScheduleSectionProps {
  accountId: string;
  isOwner: boolean;
}

const COLLAPSED_DAYS = 3;
const EXPANDED_DAYS = 14;

export function ScheduleSection({ accountId, isOwner }: ScheduleSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  const today = new Date();
  const days = buildDateRange(today, expanded ? EXPANDED_DAYS : COLLAPSED_DAYS);
  const fromDate = days[0];
  const toDate = days[days.length - 1];

  const { schedules, loading, refresh } = useSchedules(accountId || null, fromDate, toDate);
  const saveSchedule = useSaveSchedule();
  const deleteSchedule = useDeleteSchedule();

  if (loading) return null;

  const byDate = new Map(schedules.map((s) => [s.workDate, s]));

  const startEdit = (dateKey: string) => {
    const existing = byDate.get(dateKey);
    setEditingDate(dateKey);
    setStartInput(existing?.startTime || "");
    setEndInput(existing?.endTime || "");
  };

  const handleSave = async () => {
    if (!editingDate) return;
    await saveSchedule(editingDate, startInput, endInput);
    setEditingDate(null);
    refresh();
  };

  const handleClear = async () => {
    if (!editingDate) return;
    await deleteSchedule(editingDate);
    setEditingDate(null);
    refresh();
  };

  return (
    <div className="flex flex-col gap-2 border-t border-divider px-4 py-3">
      <h2 className="text-sm font-bold text-text-primary">出勤スケジュール</h2>
      <ul className="flex flex-col gap-1">
        {days.map((dateKey) => {
          const entry = byDate.get(dateKey);
          return (
            <li key={dateKey}>
              <button
                type="button"
                disabled={!isOwner}
                onClick={() => isOwner && startEdit(dateKey)}
                className="flex w-full items-center justify-between text-left text-sm disabled:cursor-default"
              >
                <span className="text-text-secondary">{formatDayLabel(dateKey)}</span>
                <span className={entry ? "text-text-primary" : "text-text-secondary"}>
                  {entry ? `${entry.startTime} - ${entry.endTime}` : "-"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-accent hover:underline"
        >
          もっと見る
        </button>
      )}
      {editingDate && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
          <p className="text-sm text-text-secondary">{formatDayLabel(editingDate)} の出勤予定</p>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="rounded border border-border bg-bg px-2 py-1 text-sm text-text-primary"
            />
            <span className="text-text-secondary">-</span>
            <input
              type="time"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="rounded border border-border bg-bg px-2 py-1 text-sm text-text-primary"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave}>
              保存
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClear}>
              休みにする
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingDate(null)}>
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export it from the module barrel**

Create `dystopia/frontend/src/modules/schedule/index.ts`:

```ts
export { ScheduleSection } from "./components/ScheduleSection";
export type { ScheduleView } from "./types";
```

- [ ] **Step 3: Wire it into the public profile page**

In `dystopia/frontend/src/app/u/[username]/page.tsx`, add this import after the `GuestKarteTab` import (near line 13):

```tsx
import { ScheduleSection } from "@/modules/schedule";
```

Then insert the section between the follow-counts `<div>` (ending `</div>` before `<ProfileContentTabs`) and `<ProfileContentTabs`:

```tsx
      {role === "cast" && <ScheduleSection accountId={profile.accountId} isOwner={viewerId === profile.accountId} />}
      <ProfileContentTabs
```

- [ ] **Step 4: Wire it into the own-profile page**

In `dystopia/frontend/src/app/profile/page.tsx`, add this import after the `ProfileContentTabs` import (near line 8):

```tsx
import { ScheduleSection } from "@/modules/schedule";
```

Then insert the section between `<ProfileHeader .../>` and `<ProfileContentTabs`:

```tsx
      <ProfileHeader profile={profile} role={role} onEdit={() => setEditing(true)} />
      {role === "cast" && <ScheduleSection accountId={profile.accountId} isOwner />}
      <ProfileContentTabs accountId={profile.accountId} />
```

- [ ] **Step 5: Type-check and run the full frontend test suite**

Run: `cd dystopia/frontend && pnpm tsc --noEmit && pnpm test`
Expected: no type errors; all existing tests plus the new `mappers.test.ts`/`dates.test.ts` pass.

- [ ] **Step 6: Manual smoke check**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec` (full suite, confirms Task 5's handler registration didn't regress anything at the end of the full implementation).
Expected: all examples pass, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add dystopia/frontend/src/modules/schedule/components dystopia/frontend/src/modules/schedule/index.ts dystopia/frontend/src/app/u/\[username\]/page.tsx dystopia/frontend/src/app/profile/page.tsx
git commit -s -m "feat(dystopia): show schedule section on cast profiles"
```

---

## After all tasks

- Push and update the stacked PR: `git push` (branch `feat/dystopia-schedule-slice` already tracks its remote via `gh stack`), then `gh stack submit --auto` to sync the PR description/base.
- Known gap carried over from the profile-enrichment PR: `pnpm lint` is broken repo-wide on this branch's toolchain (ESLint 10 incompatibility, pre-existing, unrelated to this change) — do not attempt to fix it here.
- Live-browser verification of `ScheduleSection` hits the same auth-gate limitation documented on the earlier PR (`/dev/ui` and any real page require a real login session); rely on the automated test suites above and flag manual verification as a follow-up for whoever reviews with a real account.
