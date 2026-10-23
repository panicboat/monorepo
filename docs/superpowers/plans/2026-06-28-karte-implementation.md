# Karte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the karte slice (Cast-only Guest review with paywall gate and silent-to-Guest visibility) and destroy the legacy trust slice in the same sub-project.

**Architecture:** Greenfield gRPC slice in the Hanami monolith, new proto `karte/v1`, new schema `karte` with 3 tables, frontend module + 7 BFFs riding on the H8 cookie-mediation helper. Trust slice (the opposite-direction public guest→cast review) is destroyed in T1–T4 once karte is live. Pre-prod, so DB DROP is included.

**Tech Stack:** Ruby 3.4 + Hanami + dry-rb + ROM-SQL + Gruf, PostgreSQL, buf + protoc-gen-es, Next.js 15 App Router (BFF) + SWR, @connectrpc/connect-node for gRPC transport.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-karte-design.md`. Every Decision in that spec is binding.
- Worktree: `.claude/worktrees/feat-karte`, branch `feat/karte`, base = `origin/main` (= `e894f36c`).
- Git: commit with `-s` signoff, NO `Co-Authored-By` line, English commit messages, PR title in English (conventional), `gh pr create --draft` for new PRs.
- After a sub-project segment lands, open a Draft PR via `gh pr create --draft` and switch the remote to ssh if push hits HTTPS auth: `git -C <worktree> remote set-url origin git@github.com:panicboat/monorepo.git`.
- Migration timestamp prefix `20260628_______` (one minute apart per task); structure.sql is NOT regenerated (pg_dump version mismatch is expected and ignored — verify via `bundle exec rspec`).
- Bare `grep`/`find` are shadowed; use `/usr/bin/grep` / `/usr/bin/find`.
- Frontend has NO unit-test harness. Verification = `./node_modules/.bin/tsc --noEmit` + `pnpm lint` (must report `0 error / 0 warning`) + `pnpm build` (all green).
- Backend verification = `env -u NODE_OPTIONS bundle exec rspec spec/slices/karte` (after K4) + the existing `spec/slices/identity` and other neighbors must remain green.
- Cookie mediation already established in #763: BFFs use `buildGrpcHeaders(req)` (reads `access_token` cookie) and optionally wrap upstream calls with `callWithRefresh` from `@/lib/auth/refresh-on-unauthenticated` for transparent refresh.
- `karte__access` constant `MIN_FLAG_REPORTS = 3` for the `flagged` boolean. Constant lives in `Karte::UseCases::ListEntriesByTarget` (or shared spot in karte slice).
- target role check: a Cast as `target_account_id` is rejected by `CreateEntry` with `Karte::UseCases::CreateEntry::CreateError, "Target must be a guest"`. `identity__users.role`: 1 = GUEST, 2 = CAST.
- Author identity hydration: re-use the existing pattern (`Profile::Slice["use_cases.get_profile"]` per id, see `slices/social/use_cases/blocks/list_blocked.rb:30`). Avatar URL hydration via `Profile::Adapters::MediaAdapter` (`slices/profile/adapters/media_adapter.rb`) once we have `avatar_media_id`s — but for karte MVP we just expose `author_avatar_url` from profile presenter or build a small adapter call. See Task K4 for the exact wiring.

---

### Task 1: K1 — Add `karte/v1` proto and regenerate stubs

**Files:**
- Create: `proto/karte/v1/service.proto`
- Modify: none (regeneration produces stubs but no handler binds yet)
- Test: stub presence is the test (codegen success)

**Interfaces:**
- Consumes: nothing.
- Produces: package `karte.v1` with `KarteService` (7 rpcs), `KarteEntry`, `Aggregate`, and request/response messages. Ruby package `Karte::V1::*`, TS module `@/stub/karte/v1/service_pb`.

- [ ] **Step 1: Write the proto**

Create `proto/karte/v1/service.proto`:

```proto
syntax = "proto3";

package karte.v1;

import "google/protobuf/timestamp.proto";

service KarteService {
  rpc CreateEntry(CreateEntryRequest) returns (CreateEntryResponse);
  rpc UpdateEntry(UpdateEntryRequest) returns (UpdateEntryResponse);
  rpc DeleteEntry(DeleteEntryRequest) returns (DeleteEntryResponse);
  rpc ListEntriesByTarget(ListEntriesByTargetRequest) returns (ListEntriesByTargetResponse);
  rpc ListMyEntries(ListMyEntriesRequest) returns (ListMyEntriesResponse);
  rpc ReportEntry(ReportEntryRequest) returns (ReportEntryResponse);
  rpc GetMyAccess(GetMyAccessRequest) returns (GetMyAccessResponse);
}

message KarteEntry {
  string id = 1;
  string author_account_id = 2;
  string target_account_id = 3;
  string author_username = 4;
  string author_avatar_url = 5;
  int32 rating = 6;
  string body = 7;
  bool flagged = 8;
  google.protobuf.Timestamp created_at = 9;
  google.protobuf.Timestamp updated_at = 10;
}

message Aggregate {
  int32 count = 1;
  double avg_rating = 2;
}

message CreateEntryRequest {
  string target_account_id = 1;
  int32 rating = 2;
  string body = 3;
}
message CreateEntryResponse { KarteEntry entry = 1; }

message UpdateEntryRequest {
  string entry_id = 1;
  int32 rating = 2;   // 0 = unchanged
  string body = 3;    // empty = unchanged
}
message UpdateEntryResponse { KarteEntry entry = 1; }

message DeleteEntryRequest { string entry_id = 1; }
message DeleteEntryResponse {}

message ListEntriesByTargetRequest {
  string target_account_id = 1;
  int32 limit = 2;     // default 20
  string cursor = 3;
}
message ListEntriesByTargetResponse {
  repeated KarteEntry entries = 1;
  string next_cursor = 2;
  bool has_more = 3;
  Aggregate aggregate = 4;
}

message ListMyEntriesRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListMyEntriesResponse {
  repeated KarteEntry entries = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ReportEntryRequest {
  string entry_id = 1;
  string reason = 2;
}
message ReportEntryResponse {}

message GetMyAccessRequest {}
message GetMyAccessResponse {
  bool has_access = 1;
  google.protobuf.Timestamp granted_at = 2;
}
```

- [ ] **Step 2: Regenerate stubs**

Run from the repo root:

```bash
./bin/codegen
```

Expected: `[codegen] regenerating Ruby stubs (monolith)...` then `[codegen] regenerating TypeScript stubs (frontend)...` then `[codegen] done.` No errors.

- [ ] **Step 3: Verify stub files exist**

```bash
ls services/monolith/workspace/stubs/karte/v1/
ls services/frontend/workspace/src/stub/karte/v1/
```

Expected: both list `service_pb.rb` (+ `service_services_pb.rb` on the monolith side) / `service_pb.ts` (+ `service_connect.ts` if generated).

- [ ] **Step 4: Verify nothing broke**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: same baseline as `e894f36c` (63 examples, 1 pre-existing failure in `sms_verification_repository_spec.rb:40`). Any new failure means the proto change broke loading; investigate.

```bash
cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
```

Expected: no output (= success).

- [ ] **Step 5: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-karte
git add proto/karte services/monolith/workspace/stubs/karte services/frontend/workspace/src/stub/karte
git commit -s -m "feat(karte): add karte/v1 proto and regenerate stubs

7 RPCs (Create/Update/Delete/ListEntriesByTarget/ListMyEntries/Report/
GetMyAccess), KarteEntry + Aggregate messages. Handler not yet bound;
nothing wired."
```

---

### Task 2: K2 — Schema + relations (`karte__entries`, `karte__access`, `karte__reports`)

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260628000000_create_karte_schema.rb`
- Create: `services/monolith/workspace/slices/karte/db/relation.rb`
- Create: `services/monolith/workspace/slices/karte/db/repo.rb`
- Create: `services/monolith/workspace/slices/karte/db/struct.rb`
- Create: `services/monolith/workspace/slices/karte/config/slice.rb`
- Create: `services/monolith/workspace/slices/karte/relations/entries.rb`
- Create: `services/monolith/workspace/slices/karte/relations/access.rb`
- Create: `services/monolith/workspace/slices/karte/relations/reports.rb`
- Test: migration apply + boot.

**Interfaces:**
- Consumes: nothing.
- Produces: PG schema `karte` with 3 tables; ROM relations `Karte::Relations::{Entries, Access, Reports}` with reader aliases `entry_records`, `access_records`, `report_records`. `Karte::Slice` registers under `Hanami::Slice`.

- [ ] **Step 1: Write the migration**

Create `services/monolith/workspace/config/db/migrate/20260628000000_create_karte_schema.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS karte"

    create_table :"karte__entries" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :target_account_id, :uuid, null: false
      column :rating, :integer, null: false
      column :body, :text
      column :reported_count, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_range, "rating BETWEEN 1 AND 5"
    end

    run <<~SQL
      CREATE INDEX idx_karte_entries_target_created
        ON karte.entries (target_account_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_entries_author_created
        ON karte.entries (author_account_id, created_at DESC, id DESC)
    SQL

    create_table :"karte__access" do
      column :account_id, :uuid, null: false
      column :granted_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :granted_by, :text

      primary_key [:account_id]
    end

    create_table :"karte__reports" do
      column :id, :uuid, null: false
      column :entry_id, :uuid, null: false
      column :reporter_account_id, :uuid, null: false
      column :reason, :text
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:entry_id, :reporter_account_id], name: :uq_karte_reports_entry_reporter
    end
  end

  down do
    drop_table :"karte__reports"
    drop_table :"karte__access"
    drop_table :"karte__entries"
    run "DROP SCHEMA IF EXISTS karte CASCADE"
  end
end
```

- [ ] **Step 2: Create slice scaffolding**

`services/monolith/workspace/slices/karte/config/slice.rb`:

```ruby
# frozen_string_literal: true

module Karte
  class Slice < Hanami::Slice
  end
end
```

`services/monolith/workspace/slices/karte/db/relation.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

`services/monolith/workspace/slices/karte/db/repo.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

`services/monolith/workspace/slices/karte/db/struct.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module DB
    class Struct < Monolith::DB::Struct
    end
  end
end
```

- [ ] **Step 3: Create relations**

`services/monolith/workspace/slices/karte/relations/entries.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Relations
    class Entries < Karte::DB::Relation
      schema(:"karte__entries", as: :entry_records, infer: false) do
        attribute :id, Types::String
        attribute :author_account_id, Types::String
        attribute :target_account_id, Types::String
        attribute :rating, Types::Integer
        attribute :body, Types::String.optional
        attribute :reported_count, Types::Integer
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

`services/monolith/workspace/slices/karte/relations/access.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Relations
    class Access < Karte::DB::Relation
      schema(:"karte__access", as: :access_records, infer: false) do
        attribute :account_id, Types::String
        attribute :granted_at, Types::Time
        attribute :granted_by, Types::String.optional

        primary_key :account_id
      end
    end
  end
end
```

`services/monolith/workspace/slices/karte/relations/reports.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Relations
    class Reports < Karte::DB::Relation
      schema(:"karte__reports", as: :report_records, infer: false) do
        attribute :id, Types::String
        attribute :entry_id, Types::String
        attribute :reporter_account_id, Types::String
        attribute :reason, Types::String.optional
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

The relation alias is intentionally NOT `entries` / `access` / `reports` — that would collide with the slice name and trigger `dry-monitor`'s recursive `instrument` bug seen in notifications (see `project_redesign_2026_05` memory). The `_records` suffix sidesteps it.

- [ ] **Step 4: Apply the migration**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate 2>&1 | tail -5
env -u NODE_OPTIONS bundle exec hanami db migrate 2>&1 | tail -5
```

Expected: `=> database monolith_test migrated in 0.XXXXs` and `=> database monolith migrated in 0.XXXXs`. The trailing `pg_dump: ... server version mismatch` warning on `structure.sql` is expected and ignored.

- [ ] **Step 5: Verify the slice boots without errors**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: same baseline as K1 (63 examples, 1 pre-existing failure). New relation must not regress identity loading.

- [ ] **Step 6: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/20260628000000_create_karte_schema.rb services/monolith/workspace/slices/karte
git commit -s -m "feat(karte): schema and relations for entries, access, reports

karte schema with karte__entries (rating + body + reported_count),
karte__access (Cast feature gate, populated manually via SQL),
karte__reports (UNIQUE(entry_id, reporter_account_id)). Relation
aliases use _records suffix to avoid dry-monitor instrumentation
collision with the slice name."
```

---

### Task 3: K3 — Repositories

**Files:**
- Create: `services/monolith/workspace/slices/karte/repositories/entry_repository.rb`
- Create: `services/monolith/workspace/slices/karte/repositories/access_repository.rb`
- Create: `services/monolith/workspace/slices/karte/repositories/report_repository.rb`
- Test: boot via spec/slices/identity (smoke).

**Interfaces:**
- Consumes: relations from K2.
- Produces:
  - `Karte::Repositories::EntryRepository`: `create(author_account_id:, target_account_id:, rating:, body:)` returns a struct with all entry columns; `find_by_id(id)`; `update(id, attrs)` returns the updated row; `delete(id)`; `list_by_target(target_account_id:, limit:, cursor:)` returns an array of rows (up to `limit + 1` for `has_more` detection); `list_by_author(author_account_id:, limit:, cursor:)` same shape; `aggregate(target_account_id:)` returns `{count: Integer, avg_rating: Float}`; `increment_reported_count(id)`.
  - `Karte::Repositories::AccessRepository`: `find_by_account(account_id)` returns row or nil; `grant(account_id:, granted_by:)`; `revoke(account_id)`.
  - `Karte::Repositories::ReportRepository`: `create(entry_id:, reporter_account_id:, reason:)` returns `true` if a new row was inserted, `false` if `(entry_id, reporter_account_id)` already existed (`ON CONFLICT DO NOTHING`).

- [ ] **Step 1: Write `entry_repository.rb`**

`services/monolith/workspace/slices/karte/repositories/entry_repository.rb`:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module Repositories
    class EntryRepository < Karte::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, target_account_id:, rating:, body:)
        entry_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body
        )
      end

      def find_by_id(id)
        entry_records.by_pk(id).one
      end

      def update(id, attrs)
        entry_records.by_pk(id).command(:update).call(attrs.merge(updated_at: Time.now))
      end

      def delete(id)
        entry_records.by_pk(id).command(:delete).call
      end

      def list_by_target(target_account_id:, limit: 20, cursor: nil)
        scope = entry_records.where(target_account_id: target_account_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_by_author(author_account_id:, limit: 20, cursor: nil)
        scope = entry_records.where(author_account_id: author_account_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def aggregate(target_account_id:)
        row = entry_records
          .where(target_account_id: target_account_id)
          .dataset
          .select { [count(id).as(:count), avg(rating).as(:avg)] }
          .first
        {
          count: row[:count].to_i,
          avg_rating: row[:avg].nil? ? 0.0 : row[:avg].to_f
        }
      end

      def increment_reported_count(id)
        entry_records.by_pk(id).dataset.update(reported_count: Sequel[:reported_count] + 1)
      end

      private

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
```

- [ ] **Step 2: Write `access_repository.rb`**

`services/monolith/workspace/slices/karte/repositories/access_repository.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Repositories
    class AccessRepository < Karte::DB::Repo
      def find_by_account(account_id)
        access_records.by_pk(account_id).one
      end

      def grant(account_id:, granted_by: nil)
        access_records.command(:create).call(
          account_id: account_id,
          granted_at: Time.now,
          granted_by: granted_by
        )
      end

      def revoke(account_id)
        access_records.by_pk(account_id).command(:delete).call
      end
    end
  end
end
```

- [ ] **Step 3: Write `report_repository.rb`**

`services/monolith/workspace/slices/karte/repositories/report_repository.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Repositories
    class ReportRepository < Karte::DB::Repo
      # Idempotent INSERT. Returns true if a new row was inserted, false if
      # (entry_id, reporter_account_id) was already reported by the same Cast.
      def create(entry_id:, reporter_account_id:, reason:)
        new_id = SecureRandom.uuid_v7

        sql = <<~SQL
          INSERT INTO karte.reports (id, entry_id, reporter_account_id, reason, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (entry_id, reporter_account_id) DO NOTHING
          RETURNING id
        SQL

        ds = report_records.dataset.db
        result = ds.fetch(sql, new_id, entry_id, reporter_account_id, reason, Time.now).first
        !result.nil?
      end
    end
  end
end
```

- [ ] **Step 4: Smoke**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: still 63 examples, 1 pre-existing failure. Adding the karte repositories must not break container boot.

- [ ] **Step 5: Commit**

```bash
git add services/monolith/workspace/slices/karte/repositories
git commit -s -m "feat(karte): EntryRepository / AccessRepository / ReportRepository

Cursor pagination on (created_at, id) for list_by_target / list_by_author.
aggregate uses COUNT + AVG in a single query. ReportRepository.create is
idempotent via ON CONFLICT DO NOTHING on (entry_id, reporter_account_id)."
```

---

### Task 4: K4 — Use cases (TDD)

**Files:**
- Create: `services/monolith/workspace/slices/karte/use_cases/create_entry.rb`
- Create: `services/monolith/workspace/slices/karte/use_cases/update_entry.rb`
- Create: `services/monolith/workspace/slices/karte/use_cases/delete_entry.rb`
- Create: `services/monolith/workspace/slices/karte/use_cases/list_entries_by_target.rb`
- Create: `services/monolith/workspace/slices/karte/use_cases/list_my_entries.rb`
- Create: `services/monolith/workspace/slices/karte/use_cases/report_entry.rb`
- Create: `services/monolith/workspace/slices/karte/use_cases/get_my_access.rb`
- Test: `services/monolith/workspace/spec/slices/karte/use_cases/{create_entry,update_entry,delete_entry,list_entries_by_target,list_my_entries,report_entry,get_my_access}_spec.rb`

**Interfaces:**
- Consumes: K3 repositories. Cross-slice: `Identity::Slice["repositories.user_repository"]#find_by_id` (returns row with `.role` 1 or 2). `Profile::Slice["use_cases.get_profile"]#call(account_id:)` returns a profile row with `.username` / `.avatar_media_id` or nil.
- Produces: use_cases registered as `Karte::Slice["use_cases.create_entry"]` etc. Each `#call` returns either a row/Hash or raises a slice-scoped error class. Error class lives inside the use_case (Ruby convention in this codebase, e.g. `Identity::UseCases::Auth::Register::RegistrationError`).

Error classes (one per use_case file, following the codebase convention):

- `Karte::UseCases::CreateEntry::CreateError`
- `Karte::UseCases::UpdateEntry::UpdateError`
- `Karte::UseCases::DeleteEntry::DeleteError`
- `Karte::UseCases::ListEntriesByTarget::AccessError`
- `Karte::UseCases::ListMyEntries::AccessError`
- `Karte::UseCases::ReportEntry::ReportError`

Each access-gated use_case raises its own `AccessError` (subclass StandardError) when `access_repository.find_by_account(viewer).nil?`. Authoring constraint: don't share one base error across files — keep them slice-private and slim, matching existing convention.

Use the constant `MIN_FLAG_REPORTS = 3` inside `ListEntriesByTarget`.

Specs use the same style as `spec/slices/identity/use_cases/auth/register_spec.rb` (RSpec doubles for repos, real instantiation via `described_class.new(...)`).

- [ ] **Step 1: Write `create_entry_spec.rb`**

`services/monolith/workspace/spec/slices/karte/use_cases/create_entry_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::CreateEntry do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      access_repo: access_repo,
      user_repo: user_repo
    )
  end
  let(:entry_repo) { double(:entry_repository) }
  let(:access_repo) { double(:access_repository) }
  let(:user_repo) { double(:user_repository) }

  let(:viewer_id) { "viewer-cast-1" }
  let(:target_id) { "target-guest-1" }

  before do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(double(:access, account_id: viewer_id))
  end

  it "creates an entry when target is a guest" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 1))
    expect(entry_repo).to receive(:create).with(
      author_account_id: viewer_id,
      target_account_id: target_id,
      rating: 3,
      body: "ok"
    ).and_return(double(:entry, id: "e-1"))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    expect(result.id).to eq("e-1")
  end

  it "rejects when viewer has no karte access" do
    allow(access_repo).to receive(:find_by_account).with(viewer_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::AccessError)
  end

  it "rejects when target is a Cast" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 2))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Target must be a guest")
  end

  it "rejects when target does not exist" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Target not found")
  end

  it "rejects rating outside 1..5" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 0, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Rating must be 1..5")
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 6, body: "ok")
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Rating must be 1..5")
  end

  it "rejects body over 500 chars" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3, body: "x" * 501)
    }.to raise_error(Karte::UseCases::CreateEntry::CreateError, "Body too long")
  end
end
```

Note that we add `AccessError` to `CreateEntry` because the access gate runs before the target check. The same AccessError class name (`Karte::UseCases::CreateEntry::AccessError`) is fine — it is scoped to this file.

- [ ] **Step 2: Run the spec, expect RED**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/karte/use_cases/create_entry_spec.rb 2>&1 | tail -10
```

Expected: `NameError: uninitialized constant Karte::UseCases::CreateEntry` (or similar).

- [ ] **Step 3: Write `create_entry.rb`**

`services/monolith/workspace/slices/karte/use_cases/create_entry.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class CreateEntry
      class CreateError < StandardError; end
      class AccessError < StandardError; end

      MAX_BODY_LENGTH = 500

      include Karte::Deps[
        entry_repo: "repositories.entry_repository",
        access_repo: "repositories.access_repository"
      ]

      def initialize(entry_repo: nil, access_repo: nil, user_repo: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo, access_repo: access_repo).compact)
        @user_repo = user_repo
      end

      def call(viewer_account_id:, target_account_id:, rating:, body:)
        raise AccessError, "Karte access required" unless access_repo.find_by_account(viewer_account_id)
        raise CreateError, "Rating must be 1..5" unless (1..5).cover?(rating)
        raise CreateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        target = user_repo.find_by_id(target_account_id)
        raise CreateError, "Target not found" unless target
        raise CreateError, "Target must be a guest" unless target.role == 1

        entry_repo.create(
          author_account_id: viewer_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body
        )
      end

      private

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.user_repository"]
      end
    end
  end
end
```

The cross-slice `user_repo` follows the pattern in `slices/social/use_cases/blocks/list_blocked.rb` (lazy memoized `Identity::Slice[...]`) so that `described_class.new(user_repo: double(...))` works in specs without booting the identity slice.

- [ ] **Step 4: Run the spec, expect GREEN**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/karte/use_cases/create_entry_spec.rb 2>&1 | tail -5
```

Expected: `6 examples, 0 failures`.

- [ ] **Step 5: Write specs and use_cases for the remaining 6 use_cases**

Apply the same TDD loop (red → green → commit chunk at the end) to:

`update_entry`: `viewer_account_id, entry_id, rating: nil, body: nil`. Access gate. Loads entry, fails with `UpdateError, "Entry not found"` if nil. Fails with `UpdateError, "Not the author"` if `entry.author_account_id != viewer`. Validates `rating in 1..5 if rating` and `body.length <= 500 if body`. Calls `entry_repo.update(entry_id, attrs)` with only the non-nil fields.

`delete_entry`: `viewer_account_id, entry_id`. Access gate. Load, author check, `entry_repo.delete(entry_id)`. Return `nil`.

`list_entries_by_target`: `viewer_account_id, target_account_id, limit: 20, cursor: nil`. Access gate. Calls `entry_repo.list_by_target(...)` requesting `limit + 1` to detect `has_more`. Builds `next_cursor` via `Concerns::CursorPagination#encode_cursor(created_at:, id:)` from the last visible row. Calls `entry_repo.aggregate(target_account_id:)`. For each entry: `flagged = entry.reported_count >= MIN_FLAG_REPORTS`. Returns:

```ruby
{
  entries: visible_entries.map { |e| present_with_author(e) },
  next_cursor: next_cursor,
  has_more: has_more,
  aggregate: aggregate
}
```

where `present_with_author(e)` builds:

```ruby
{
  id: e.id,
  author_account_id: e.author_account_id,
  target_account_id: e.target_account_id,
  author_username: profile_for(e.author_account_id)&.username,
  author_avatar_url: avatar_url_for(profile_for(e.author_account_id)),
  rating: e.rating,
  body: e.body,
  flagged: e.reported_count >= MIN_FLAG_REPORTS,
  created_at: e.created_at,
  updated_at: e.updated_at
}
```

`profile_for(id)` memoizes per-call results in a local Hash to dedupe N+1 within a single page. Internally calls `Profile::Slice["use_cases.get_profile"].call(account_id: id)`. `avatar_url_for(profile)` returns `""` if profile nil or `avatar_media_id` nil; otherwise looks up via a small `Karte::Adapters::MediaAdapter` (next step in this task).

Spec uses doubles for the cross-slice calls — inject `get_profile:` and `media_adapter:` constructor kwargs that default to the real slice lookups (mirror the `user_repo` pattern from `create_entry.rb`).

`list_my_entries`: `viewer_account_id, limit: 20, cursor: nil`. Access gate. Same pagination + author hydration shape (author = viewer, but go through `profile_for` for API consistency).

`report_entry`: `viewer_account_id, entry_id, reason`. Access gate. Load entry; `ReportError, "Entry not found"` if nil; `ReportError, "Cannot report own entry"` if `entry.author_account_id == viewer`. `report_repo.create(...)`. If it returned true, `entry_repo.increment_reported_count(entry_id)`. If false (duplicate), do nothing (no-op).

`get_my_access`: `viewer_account_id`. No access gate (the call's purpose is to ask). Calls `access_repo.find_by_account(viewer_account_id)`. Returns `{has_access: bool, granted_at: Time | nil}`.

Each use_case follows the same constructor pattern as `create_entry.rb` so specs can inject doubles. Each spec covers happy path + access denial + business-rule rejections.

- [ ] **Step 6: Add the karte media adapter**

`services/monolith/workspace/slices/karte/adapters/media_adapter.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Adapters
    class MediaAdapter
      def find_url(media_id)
        return "" if media_id.nil? || media_id.to_s.empty?
        files = get_media_batch.call(ids: [media_id])
        files.first&.url || ""
      end

      private

      def get_media_batch
        @get_media_batch ||= ::Media::Slice["use_cases.get_media_batch"]
      end
    end
  end
end
```

Inject as `media_adapter: Karte::Adapters::MediaAdapter.new` (default) into `list_entries_by_target` and `list_my_entries`. Spec doubles `find_url(media_id) -> "https://..."`.

- [ ] **Step 7: Run full karte spec, expect ALL GREEN**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/karte 2>&1 | tail -10
```

Expected: all karte specs pass.

- [ ] **Step 8: Run identity spec, expect baseline preserved**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: 63 examples, 1 pre-existing failure (no regression).

- [ ] **Step 9: Commit**

```bash
git add services/monolith/workspace/slices/karte/use_cases services/monolith/workspace/slices/karte/adapters services/monolith/workspace/spec/slices/karte
git commit -s -m "feat(karte): use cases with access gate, role check, author hydration (TDD)

CreateEntry / UpdateEntry / DeleteEntry / ListEntriesByTarget /
ListMyEntries / ReportEntry / GetMyAccess. Access gate via
AccessRepository, target role check via Identity::Slice user_repo,
author hydration via Profile::Slice get_profile + Karte::Adapters::
MediaAdapter. flagged = reported_count >= 3."
```

---

### Task 5: K5 — gRPC handler + `bin/grpc` registration + dev seed

**Files:**
- Create: `services/monolith/workspace/slices/karte/grpc/handler.rb`
- Create: `services/monolith/workspace/slices/karte/grpc/karte_handler.rb`
- Modify: `services/monolith/workspace/bin/grpc` (add require lines for stub + handler)
- Create: `services/monolith/workspace/config/db/seeds/karte/access.rb`

**Interfaces:**
- Consumes: K4 use_cases, K1 stubs.
- Produces: live `karte.v1.KarteService` gRPC service. `current_user_id` from `Grpc::Authenticatable#authenticate_user!`. Errors map: `AccessError` → `Gruf::Errors::Unauthorized` (`PERMISSION_DENIED`), `CreateError`/`UpdateError`/`DeleteError`/`ReportError` → `Gruf::Errors::InvalidArgument` (`INVALID_ARGUMENT`).

- [ ] **Step 1: Write the base handler**

`services/monolith/workspace/slices/karte/grpc/handler.rb`:

```ruby
# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Karte
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
    end
  end
end
```

- [ ] **Step 2: Write the bound handler**

`services/monolith/workspace/slices/karte/grpc/karte_handler.rb`:

```ruby
# frozen_string_literal: true

require "karte/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Karte
  module Grpc
    class KarteHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "karte.v1.KarteService"

      bind ::Karte::V1::KarteService::Service

      self.rpc_descs.clear

      rpc :CreateEntry,         ::Karte::V1::CreateEntryRequest,         ::Karte::V1::CreateEntryResponse
      rpc :UpdateEntry,         ::Karte::V1::UpdateEntryRequest,         ::Karte::V1::UpdateEntryResponse
      rpc :DeleteEntry,         ::Karte::V1::DeleteEntryRequest,         ::Karte::V1::DeleteEntryResponse
      rpc :ListEntriesByTarget, ::Karte::V1::ListEntriesByTargetRequest, ::Karte::V1::ListEntriesByTargetResponse
      rpc :ListMyEntries,       ::Karte::V1::ListMyEntriesRequest,       ::Karte::V1::ListMyEntriesResponse
      rpc :ReportEntry,         ::Karte::V1::ReportEntryRequest,         ::Karte::V1::ReportEntryResponse
      rpc :GetMyAccess,         ::Karte::V1::GetMyAccessRequest,         ::Karte::V1::GetMyAccessResponse

      include Karte::Deps[
        create_uc:          "use_cases.create_entry",
        update_uc:          "use_cases.update_entry",
        delete_uc:          "use_cases.delete_entry",
        list_by_target_uc:  "use_cases.list_entries_by_target",
        list_my_uc:         "use_cases.list_my_entries",
        report_uc:          "use_cases.report_entry",
        get_my_access_uc:   "use_cases.get_my_access"
      ]

      def create_entry
        authenticate_user!
        body = request.message.body == "" ? nil : request.message.body
        entry = wrap_errors do
          create_uc.call(
            viewer_account_id: current_user_id,
            target_account_id: request.message.target_account_id,
            rating: request.message.rating,
            body: body
          )
        end
        ::Karte::V1::CreateEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def update_entry
        authenticate_user!
        rating = request.message.rating.zero? ? nil : request.message.rating
        body = request.message.body == "" ? nil : request.message.body
        entry = wrap_errors do
          update_uc.call(
            viewer_account_id: current_user_id,
            entry_id: request.message.entry_id,
            rating: rating,
            body: body
          )
        end
        ::Karte::V1::UpdateEntryResponse.new(entry: entry_to_proto(present_for_author(entry)))
      end

      def delete_entry
        authenticate_user!
        wrap_errors do
          delete_uc.call(
            viewer_account_id: current_user_id,
            entry_id: request.message.entry_id
          )
        end
        ::Karte::V1::DeleteEntryResponse.new
      end

      def list_entries_by_target
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = wrap_errors do
          list_by_target_uc.call(
            viewer_account_id: current_user_id,
            target_account_id: request.message.target_account_id,
            limit: limit,
            cursor: cursor
          )
        end
        ::Karte::V1::ListEntriesByTargetResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more],
          aggregate: ::Karte::V1::Aggregate.new(
            count: result[:aggregate][:count],
            avg_rating: result[:aggregate][:avg_rating]
          )
        )
      end

      def list_my_entries
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = wrap_errors do
          list_my_uc.call(
            viewer_account_id: current_user_id,
            limit: limit,
            cursor: cursor
          )
        end
        ::Karte::V1::ListMyEntriesResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def report_entry
        authenticate_user!
        wrap_errors do
          report_uc.call(
            viewer_account_id: current_user_id,
            entry_id: request.message.entry_id,
            reason: request.message.reason
          )
        end
        ::Karte::V1::ReportEntryResponse.new
      end

      def get_my_access
        authenticate_user!
        result = get_my_access_uc.call(viewer_account_id: current_user_id)
        ::Karte::V1::GetMyAccessResponse.new(
          has_access: result[:has_access],
          granted_at: result[:granted_at] ? timestamp(result[:granted_at]) : nil
        )
      end

      private

      def wrap_errors
        yield
      rescue Karte::UseCases::CreateEntry::AccessError,
             Karte::UseCases::UpdateEntry::AccessError,
             Karte::UseCases::DeleteEntry::AccessError,
             Karte::UseCases::ListEntriesByTarget::AccessError,
             Karte::UseCases::ListMyEntries::AccessError,
             Karte::UseCases::ReportEntry::AccessError => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Karte::UseCases::CreateEntry::CreateError,
             Karte::UseCases::UpdateEntry::UpdateError,
             Karte::UseCases::DeleteEntry::DeleteError,
             Karte::UseCases::ReportEntry::ReportError => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      end

      # For Create/Update return paths the use_case returns the raw row; build the
      # presentation shape (with author hydration) once here so the response matches
      # what list_* produce.
      def present_for_author(entry)
        # Reuse the presenter logic by going through list_by_target with limit 1,
        # OR call the same helper. For MVP simplicity: call get_profile + media here
        # directly. This duplicates the helper but keeps create/update fast.
        profile = ::Profile::Slice["use_cases.get_profile"].call(account_id: entry.author_account_id)
        media = ::Karte::Adapters::MediaAdapter.new
        {
          id: entry.id,
          author_account_id: entry.author_account_id,
          target_account_id: entry.target_account_id,
          author_username: profile&.username,
          author_avatar_url: media.find_url(profile&.avatar_media_id),
          rating: entry.rating,
          body: entry.body,
          flagged: entry.reported_count >= Karte::UseCases::ListEntriesByTarget::MIN_FLAG_REPORTS,
          created_at: entry.created_at,
          updated_at: entry.updated_at
        }
      end

      def entry_to_proto(e)
        ::Karte::V1::KarteEntry.new(
          id: e[:id].to_s,
          author_account_id: e[:author_account_id].to_s,
          target_account_id: e[:target_account_id].to_s,
          author_username: e[:author_username] || "",
          author_avatar_url: e[:author_avatar_url] || "",
          rating: e[:rating],
          body: e[:body] || "",
          flagged: e[:flagged],
          created_at: timestamp(e[:created_at]),
          updated_at: timestamp(e[:updated_at])
        )
      end

      def timestamp(t)
        return nil unless t
        ::Google::Protobuf::Timestamp.new(seconds: t.to_i, nanos: t.nsec)
      end
    end
  end
end
```

- [ ] **Step 3: Register in `bin/grpc`**

Open `services/monolith/workspace/bin/grpc`.

Add to the proto requires (alongside the other `require "X/v1/Y_service_services_pb"` lines):

```ruby
require "karte/v1/service_services_pb"
```

Add at the bottom of the handler requires (next to bookmarks/discovery/etc):

```ruby
require_relative "../slices/karte/grpc/handler"
require_relative "../slices/karte/grpc/karte_handler"
```

The S2b memory (`project_redesign_2026_05` memory, "bin/grpc + Gruf registration") states this `require_relative` step is the most common point of failure — without it the slice handler boots in the container but is not bound to the Gruf server, leading to a silent UNIMPLEMENTED in production. Verify next step.

- [ ] **Step 4: Boot smoke (Gruf services list)**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec ruby -e 'require_relative "bin/grpc"; puts Gruf.services.map(&:name)' 2>&1 | tail -20 &
sleep 5
kill %1 2>/dev/null
```

This actually boots the gRPC server. Use a more direct check instead — read just the load + bind step:

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec ruby -e '
ENV["BUNDLE_WITHOUT"] = "development:cli:test"
ENV["HANAMI_ENV"] = "production"
ENV["SECRET_KEY_BASE"] ||= "x"
require "bundler/setup"; require "hanami/setup"; Hanami.app.boot
$LOAD_PATH.unshift(File.expand_path("stubs"))
require "karte/v1/service_services_pb"
require_relative "slices/karte/grpc/handler"
require_relative "slices/karte/grpc/karte_handler"
require "gruf"
puts Gruf.services.map(&:service_name).grep(/karte/)
' 2>&1 | tail -5
```

Expected: `karte.v1.KarteService` appears in the output.

- [ ] **Step 5: Write the dev seed for granting access**

`services/monolith/workspace/config/db/seeds/karte/access.rb`:

```ruby
# frozen_string_literal: true

# Grants karte access to the first Cast (role=2) found in identity__users.
# This is intentionally minimal — MVP grant policy is manual SQL in production
# (see spec, Decisions table). Seed exists so dev environments boot with a
# working karte gate.

require "rom"

container = Hanami.app["db.gateway"].connection

cast = container[:identity__users].where(role: 2).first
if cast.nil?
  puts "[karte seed] no Cast user found in identity__users; skipping"
else
  result = container[:karte__access].insert_conflict.insert(
    account_id: cast[:id],
    granted_at: Time.now,
    granted_by: "seed"
  )
  puts "[karte seed] granted karte access to Cast #{cast[:id]} (#{cast[:phone_number]})"
end
```

(If the existing seeds runner expects a specific signature, mirror what `config/db/seeds/identity/users.rb` does — adapt the loading idiom to match.)

- [ ] **Step 6: Run identity spec to ensure boot is still clean**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: 63 / 1 pre-existing failure.

- [ ] **Step 7: Commit**

```bash
git add services/monolith/workspace/slices/karte/grpc services/monolith/workspace/bin/grpc services/monolith/workspace/config/db/seeds/karte
git commit -s -m "feat(karte): gRPC handler binding KarteService and bin/grpc registration

Maps slice errors to gRPC codes (AccessError -> PERMISSION_DENIED,
*Error -> INVALID_ARGUMENT). Registered the handler in bin/grpc next
to bookmarks/discovery (omitting this is the most common foot-gun
per project_redesign_2026_05 memory). Dev seed grants karte access
to the first Cast for local testing."
```

---

### Task 6: K6 — Frontend data layer (types + 7 BFFs + grpc client + 6 hooks)

**Files:**
- Modify: `services/frontend/workspace/src/lib/grpc.ts` (add karteClient)
- Create: `services/frontend/workspace/src/modules/karte/types.ts`
- Create: `services/frontend/workspace/src/modules/karte/index.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/useGuestKarte.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/useMyKarte.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/useCreateKarte.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/useUpdateKarte.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/useDeleteKarte.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/useReportKarte.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/useMyKarteAccess.ts`
- Create: `services/frontend/workspace/src/modules/karte/hooks/index.ts`
- Create: `services/frontend/workspace/src/app/api/karte/route.ts` (POST create)
- Create: `services/frontend/workspace/src/app/api/karte/by-target/route.ts` (GET list-by-target)
- Create: `services/frontend/workspace/src/app/api/karte/my/route.ts` (GET list-my)
- Create: `services/frontend/workspace/src/app/api/karte/[id]/route.ts` (PATCH update + DELETE)
- Create: `services/frontend/workspace/src/app/api/karte/[id]/report/route.ts` (POST report)
- Create: `services/frontend/workspace/src/app/api/karte/access/route.ts` (GET access)
- Test: `tsc --noEmit` + `pnpm lint` + `pnpm build`.

**Interfaces:**
- Consumes: K1 TS stubs, the cookie-mediation helpers (`buildGrpcHeaders` from `@/lib/request`, optional `callWithRefresh` from `@/lib/auth/refresh-on-unauthenticated`, `requireAuth` from `@/lib/api-helpers`).
- Produces:
  - TS types (`KarteEntry`, `KarteAggregate`, `PaginatedKarteResponse`, `KarteAccess`).
  - `karteClient` exported from `@/lib/grpc`.
  - 6 hooks under `@/modules/karte` for the UI.
  - 7 same-origin BFF endpoints.

- [ ] **Step 1: Add the gRPC client**

Open `services/frontend/workspace/src/lib/grpc.ts`. Add to the imports section (alphabetical-ish, near `BookmarkService`):

```ts
import { KarteService } from "@/stub/karte/v1/service_pb";
```

Add the client export near the others:

```ts
// Karte domain client (karte.v1)
export const karteClient = createClient(KarteService, transport);
```

- [ ] **Step 2: Write types**

`services/frontend/workspace/src/modules/karte/types.ts`:

```ts
export interface KarteEntry {
  id: string;
  authorAccountId: string;
  targetAccountId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  rating: number;
  body: string;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KarteAggregate {
  count: number;
  avgRating: number;
}

export interface PaginatedKarteByTargetResponse {
  entries: KarteEntry[];
  nextCursor: string;
  hasMore: boolean;
  aggregate: KarteAggregate;
}

export interface PaginatedKarteMyResponse {
  entries: KarteEntry[];
  nextCursor: string;
  hasMore: boolean;
}

export interface KarteAccess {
  hasAccess: boolean;
  grantedAt: string | null;
}
```

`services/frontend/workspace/src/modules/karte/index.ts`:

```ts
export * from "./types";
export * from "./hooks";
```

`services/frontend/workspace/src/modules/karte/hooks/index.ts`:

```ts
export { useGuestKarte } from "./useGuestKarte";
export { useMyKarte } from "./useMyKarte";
export { useCreateKarte } from "./useCreateKarte";
export { useUpdateKarte } from "./useUpdateKarte";
export { useDeleteKarte } from "./useDeleteKarte";
export { useReportKarte } from "./useReportKarte";
export { useMyKarteAccess } from "./useMyKarteAccess";
```

- [ ] **Step 3: Write the BFFs**

`services/frontend/workspace/src/app/api/karte/access/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const res = await karteClient.getMyAccess({}, { headers: buildGrpcHeaders(req) });
    return NextResponse.json({
      hasAccess: !!res.hasAccess,
      grantedAt: res.grantedAt
        ? new Date(Number(res.grantedAt.seconds) * 1000).toISOString()
        : null,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetMyKarteAccess");
  }
}
```

`services/frontend/workspace/src/app/api/karte/by-target/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

function entryToView(e: NonNullable<Awaited<ReturnType<typeof karteClient.listEntriesByTarget>>["entries"][number]>) {
  return {
    id: e.id,
    authorAccountId: e.authorAccountId,
    targetAccountId: e.targetAccountId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    flagged: !!e.flagged,
    createdAt: e.createdAt
      ? new Date(Number(e.createdAt.seconds) * 1000).toISOString()
      : "",
    updatedAt: e.updatedAt
      ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString()
      : "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = buildGrpcHeaders(req);
    const targetAccountId = req.nextUrl.searchParams.get("account_id") || "";
    if (!targetAccountId) {
      return NextResponse.json({ error: "account_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listEntriesByTarget(
      { targetAccountId, limit, cursor },
      { headers }
    );
    return NextResponse.json({
      entries: (res.entries || []).map(entryToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      aggregate: {
        count: res.aggregate?.count || 0,
        avgRating: res.aggregate?.avgRating || 0,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListKarteByTarget");
  }
}
```

`services/frontend/workspace/src/app/api/karte/my/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = buildGrpcHeaders(req);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listMyEntries({ limit, cursor }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map((e) => ({
        id: e.id,
        authorAccountId: e.authorAccountId,
        targetAccountId: e.targetAccountId,
        authorUsername: e.authorUsername || "",
        authorAvatarUrl: e.authorAvatarUrl || "",
        rating: e.rating,
        body: e.body || "",
        flagged: !!e.flagged,
        createdAt: e.createdAt
          ? new Date(Number(e.createdAt.seconds) * 1000).toISOString()
          : "",
        updatedAt: e.updatedAt
          ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString()
          : "",
      })),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListMyKarte");
  }
}
```

`services/frontend/workspace/src/app/api/karte/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const body = await req.json();
    const targetAccountId = body.targetAccountId as string | undefined;
    const rating = Number(body.rating);
    const text = (body.body as string | undefined) ?? "";
    if (!targetAccountId || !Number.isFinite(rating)) {
      return NextResponse.json({ error: "targetAccountId and rating required" }, { status: 400 });
    }
    const res = await karteClient.createEntry(
      { targetAccountId, rating, body: text },
      { headers: buildGrpcHeaders(req) }
    );
    return NextResponse.json({ entry: res.entry });
  } catch (error: unknown) {
    return handleApiError(error, "CreateKarte");
  }
}
```

`services/frontend/workspace/src/app/api/karte/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const body = await req.json();
    const rating = body.rating === undefined ? 0 : Number(body.rating);
    const text = typeof body.body === "string" ? body.body : "";
    const res = await karteClient.updateEntry(
      { entryId: id, rating, body: text },
      { headers: buildGrpcHeaders(req) }
    );
    return NextResponse.json({ entry: res.entry });
  } catch (error: unknown) {
    return handleApiError(error, "UpdateKarte");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await karteClient.deleteEntry({ entryId: id }, { headers: buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteKarte");
  }
}
```

`services/frontend/workspace/src/app/api/karte/[id]/report/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : "";
    await karteClient.reportEntry({ entryId: id, reason }, { headers: buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "ReportKarte");
  }
}
```

- [ ] **Step 4: Write the hooks**

`useGuestKarte.ts`:

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedKarteByTargetResponse } from "../types";

export function useGuestKarte(targetAccountId: string | null | undefined) {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedKarteByTargetResponse | null): string | null => {
    if (!userId || !targetAccountId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/karte/by-target?account_id=${encodeURIComponent(targetAccountId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedKarteByTargetResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const entries = pages.flatMap((p) => p.entries || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;
  const aggregate = pages[0]?.aggregate ?? { count: 0, avgRating: 0 };

  return {
    entries,
    aggregate,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

`useMyKarte.ts`: same shape as `useGuestKarte`, key `/api/karte/my`, no `aggregate`.

`useMyKarteAccess.ts`:

```ts
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KarteAccess } from "../types";

export function useMyKarteAccess() {
  const userId = useAuthStore((s) => s.userId);
  const { data, error, isLoading } = useSWR<KarteAccess>(
    userId ? "/api/karte/access" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  return {
    hasAccess: !!data?.hasAccess,
    grantedAt: data?.grantedAt ?? null,
    loading: isLoading,
    error,
  };
}
```

`useCreateKarte.ts` / `useUpdateKarte.ts` / `useDeleteKarte.ts` / `useReportKarte.ts`: small mutation hooks returning a callback. Use `authFetch` from `@/lib/auth/fetch` (already drops `Authorization` in H8b). Example for create:

```ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { KarteEntry } from "../types";

export function useCreateKarte() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const create = useCallback(async (
    targetAccountId: string,
    rating: number,
    body: string
  ): Promise<KarteEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ entry: KarteEntry }>("/api/karte", {
        method: "POST",
        body: { targetAccountId, rating, body },
      });
      return res.entry;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to create karte"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  return { create, loading, error };
}
```

Mirror this shape for update (PATCH `/api/karte/${id}`), delete (DELETE `/api/karte/${id}`), report (POST `/api/karte/${id}/report`).

- [ ] **Step 5: tsc**

```bash
cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -10
```

Expected: no output.

- [ ] **Step 6: lint**

```bash
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm lint 2>&1 | tail -5
```

Expected: no error/warning lines.

- [ ] **Step 7: build**

```bash
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm build 2>&1 | tail -5
```

Expected: build completes; `karte/access`, `karte/by-target`, `karte/my`, `karte`, `karte/[id]`, `karte/[id]/report` appear in the route table.

- [ ] **Step 8: Commit**

```bash
git add services/frontend/workspace/src/lib/grpc.ts services/frontend/workspace/src/modules/karte services/frontend/workspace/src/app/api/karte
git commit -s -m "feat(karte): frontend data layer (types + 7 BFFs + 6 hooks)

karteClient, useGuestKarte / useMyKarte (cursor pagination), the four
mutation hooks, useMyKarteAccess (long-cached). BFFs ride on the
cookie-mediation helpers established in #763."
```

---

### Task 7: K7 — Frontend UI (guest profile tab, /karte/my page, composer, badges, drawer link, /dev/ui mock)

**Files:**
- Create: `services/frontend/workspace/src/modules/karte/components/KarteEntryCard.tsx`
- Create: `services/frontend/workspace/src/modules/karte/components/KarteComposer.tsx`
- Create: `services/frontend/workspace/src/modules/karte/components/KarteAggregateHeader.tsx`
- Create: `services/frontend/workspace/src/modules/karte/components/GuestKarteTab.tsx`
- Create: `services/frontend/workspace/src/app/karte/my/page.tsx`
- Modify: `services/frontend/workspace/src/app/u/[username]/page.tsx` (add tab when target is Guest + viewer has karte access)
- Modify: `services/frontend/workspace/src/components/shell/Drawer.tsx` (add "カルテ" item when access true)
- Create: `services/frontend/workspace/src/app/dev/ui/karte/page.tsx` (mock for `/dev/ui`)
- Test: tsc + lint + build.

**Interfaces:**
- Consumes: K6 hooks/types, existing shell + profile.
- Produces: real UI.

- [ ] **Step 1: Read the existing guest profile page to understand the tab integration point**

```bash
/usr/bin/find services/frontend/workspace/src/app/u -type f | head
/usr/bin/grep -n "Tabs\|TabsList\|TabsTrigger\|TabsContent" services/frontend/workspace/src/app/u/\[username\]/page.tsx 2>&1 | head
```

This gives the subagent the actual tab component vocabulary in use (likely a Tab primitive from `src/components/ui`). Match that vocabulary when adding the karte tab.

- [ ] **Step 2: Write `KarteEntryCard.tsx`**

`services/frontend/workspace/src/modules/karte/components/KarteEntryCard.tsx`:

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { useDeleteKarte } from "../hooks/useDeleteKarte";
import { useReportKarte } from "../hooks/useReportKarte";
import { useAuthStore } from "@/stores/authStore";
import type { KarteEntry } from "../types";

interface Props {
  entry: KarteEntry;
  onChanged?: () => void;
}

export function KarteEntryCard({ entry, onChanged }: Props) {
  const viewerId = useAuthStore((s) => s.userId);
  const isOwn = viewerId === entry.authorAccountId;
  const { remove, loading: deleting } = useDeleteKarte();
  const { report, loading: reporting } = useReportKarte();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {entry.authorAvatarUrl ? (
          <Image
            src={entry.authorAvatarUrl}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="size-8 rounded-full bg-muted" />
        )}
        <span className="font-medium">{entry.authorUsername || "(no username)"}</span>
        <span className="text-muted-foreground">
          {new Date(entry.createdAt).toLocaleString("ja-JP")}
        </span>
        {entry.flagged && (
          <span
            className="ml-auto text-xs text-amber-600"
            title="他 Cast から複数件 report されています"
          >
            ⚠︎ flagged
          </span>
        )}
      </div>
      <div className="mt-1 text-base">{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</div>
      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        {isOwn ? (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (!confirm("このカルテを削除しますか？")) return;
              await remove(entry.id);
              onChanged?.();
            }}
            className="hover:text-foreground"
          >
            削除
          </button>
        ) : reportOpen ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
              await report(entry.id, reason);
              setReportOpen(false);
            }}
            className="flex gap-2"
          >
            <input
              name="reason"
              type="text"
              placeholder="理由"
              className="rounded border border-border px-2 py-1 text-xs"
            />
            <button type="submit" disabled={reporting} className="hover:text-foreground">
              送信
            </button>
            <button type="button" onClick={() => setReportOpen(false)}>
              キャンセル
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="hover:text-foreground"
          >
            report
          </button>
        )}
      </div>
    </article>
  );
}
```

(Style classes follow existing post card patterns; match `border-border` / `text-muted-foreground` etc that exist in `src/components/ui` Tailwind tokens.)

- [ ] **Step 3: Write `KarteComposer.tsx`**

`services/frontend/workspace/src/modules/karte/components/KarteComposer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useCreateKarte } from "../hooks/useCreateKarte";

interface Props {
  targetAccountId: string;
  onCreated?: () => void;
}

export function KarteComposer({ targetAccountId, onCreated }: Props) {
  const { create, loading, error } = useCreateKarte();
  const [rating, setRating] = useState(3);
  const [body, setBody] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const entry = await create(targetAccountId, rating, body);
        if (entry) {
          setBody("");
          onCreated?.();
        }
      }}
      className="border-b border-border p-4"
    >
      <label className="block text-sm font-medium">評価</label>
      <select
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="mt-1 rounded border border-border bg-bg px-2 py-1 text-sm"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)}{"☆".repeat(5 - n)} ({n})
          </option>
        ))}
      </select>

      <label className="mt-3 block text-sm font-medium">メモ (任意、500 文字まで)</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 500))}
        rows={3}
        className="mt-1 block w-full rounded border border-border bg-bg p-2 text-sm"
      />
      <div className="mt-1 text-right text-xs text-muted-foreground">{body.length}/500</div>

      {error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded bg-accent px-3 py-1 text-sm text-accent-foreground disabled:opacity-50"
      >
        保存
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Write `KarteAggregateHeader.tsx`**

```tsx
import type { KarteAggregate } from "../types";

export function KarteAggregateHeader({ aggregate }: { aggregate: KarteAggregate }) {
  if (aggregate.count === 0) {
    return <div className="px-4 py-3 text-sm text-muted-foreground">カルテはまだありません</div>;
  }
  return (
    <div className="px-4 py-3 text-sm">
      <span className="font-medium">{aggregate.count} 件</span>
      <span className="ml-2 text-muted-foreground">
        平均 ★{aggregate.avgRating.toFixed(1)}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Write `GuestKarteTab.tsx`**

```tsx
"use client";

import { useGuestKarte } from "../hooks/useGuestKarte";
import { KarteAggregateHeader } from "./KarteAggregateHeader";
import { KarteComposer } from "./KarteComposer";
import { KarteEntryCard } from "./KarteEntryCard";

export function GuestKarteTab({ guestAccountId }: { guestAccountId: string }) {
  const { entries, aggregate, hasMore, loading, loadMore, refresh } = useGuestKarte(guestAccountId);

  return (
    <div>
      <KarteAggregateHeader aggregate={aggregate} />
      <KarteComposer targetAccountId={guestAccountId} onCreated={refresh} />
      {entries.map((e) => (
        <KarteEntryCard key={e.id} entry={e} onChanged={refresh} />
      ))}
      {loading && <div className="px-4 py-3 text-sm text-muted-foreground">読み込み中…</div>}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="block w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire the guest profile tab**

Open `services/frontend/workspace/src/app/u/[username]/page.tsx`. Locate the tabs component. Add a new tab that mounts only when (a) the profile being viewed has `role === 1` (Guest) and (b) `useMyKarteAccess().hasAccess === true`. Tab label: `カルテ`. Body: `<GuestKarteTab guestAccountId={profile.accountId} />`.

Implementation detail depends on whether `page.tsx` is a server component (likely is — it lives under `app/`); the tab logic + access hook must live in a client subcomponent. Create:

`services/frontend/workspace/src/modules/karte/components/MaybeGuestKarteTab.tsx`:

```tsx
"use client";

import { useMyKarteAccess } from "../hooks/useMyKarteAccess";
import { GuestKarteTab } from "./GuestKarteTab";

export function MaybeGuestKarteTab({
  guestAccountId,
  guestRole,
}: {
  guestAccountId: string;
  guestRole: number;
}) {
  const { hasAccess, loading } = useMyKarteAccess();
  if (loading) return null;
  if (!hasAccess) return null;
  if (guestRole !== 1) return null;
  return <GuestKarteTab guestAccountId={guestAccountId} />;
}
```

Mount `<MaybeGuestKarteTab guestAccountId={...} guestRole={...} />` as the body of a new tab in `[username]/page.tsx` (and the tab header itself should follow the same guard via a small client wrapper if the tab list is server-rendered; otherwise condition the entire tab on `useMyKarteAccess` in a client tab-list wrapper). The exact wrapping pattern depends on what the existing tabs use — match that.

- [ ] **Step 7: Write `/karte/my` page**

`services/frontend/workspace/src/app/karte/my/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMyKarte } from "@/modules/karte/hooks/useMyKarte";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";

export default function MyKartePage() {
  const { hasAccess, loading: accessLoading } = useMyKarteAccess();
  const { entries, hasMore, loading, loadMore, refresh } = useMyKarte();

  if (accessLoading) return <div className="p-4 text-sm">読み込み中…</div>;
  if (!hasAccess) {
    return (
      <div className="p-4 text-sm">
        <p>カルテは有料機能です。</p>
        <p className="mt-2 text-muted-foreground">アクセス権の付与は運営にお問い合わせください。</p>
        <Link href="/" className="mt-3 inline-block text-accent">ホームに戻る</Link>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-medium">自分のカルテ</h1>
      </header>
      {entries.map((e) => (
        <KarteEntryCard key={e.id} entry={e} onChanged={refresh} />
      ))}
      {loading && <div className="px-4 py-3 text-sm text-muted-foreground">読み込み中…</div>}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="block w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Add the Drawer link**

Open `services/frontend/workspace/src/components/shell/Drawer.tsx`. Add a nav entry "カルテ" → `/karte/my` that renders only when `useMyKarteAccess().hasAccess === true`. Place it near other personal items (足跡, ブックマーク, 設定 — wherever the codebase clusters them).

- [ ] **Step 9: Write the `/dev/ui` mock**

`services/frontend/workspace/src/app/dev/ui/karte/page.tsx` — mounts the three components with static fixture data (no live data) for visual review. Follow the existing `/dev/ui` pattern.

- [ ] **Step 10: Verify**

```bash
cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -10
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm lint 2>&1 | tail -5
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm build 2>&1 | tail -10
```

Expected: tsc no output, lint clean, build green with `/karte/my` and `/dev/ui/karte` in the route table.

- [ ] **Step 11: Commit**

```bash
git add services/frontend/workspace/src/modules/karte/components services/frontend/workspace/src/app/karte services/frontend/workspace/src/app/u services/frontend/workspace/src/components/shell/Drawer.tsx services/frontend/workspace/src/app/dev
git commit -s -m "feat(karte): guest profile tab, /karte/my page, composer, drawer link

GuestKarteTab is mounted only for guests when the viewer has karte
access; /karte/my shows a friendly upsell when not gated. Aggregate
(N 件 / 平均 ★X.Y) header gives the 5-second-judgement view."
```

---

### Task 8: K-push-and-draft-PR — Push and open the Draft PR for the karte build segment

- [ ] **Step 1: Switch remote to ssh**

```bash
git -C /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-karte remote set-url origin git@github.com:panicboat/monorepo.git
```

- [ ] **Step 2: Push the branch**

```bash
git -C /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-karte push -u origin HEAD
```

- [ ] **Step 3: Open the Draft PR**

```bash
gh pr create --draft -R panicboat/monorepo --base main --head feat/karte \
  --title "feat(karte): Cast-only Guest review with paywall gate (build)" \
  --body "Implements the karte slice per docs/superpowers/specs/2026-06-27-karte-design.md.

K1-K7 build (proto, schema, repositories, use_cases (TDD), handler, frontend data, frontend UI).
T1-T4 trust destroy will follow in subsequent commits on this branch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Capture the PR number for the trust destroy commits that follow on the same branch.

---

### Task 9: T1 — Frontend trust removal

**Files:**
- Delete: `services/frontend/workspace/src/modules/trust/` (entire directory)
- Delete: `services/frontend/workspace/src/app/api/cast/trust/` (entire subtree)
- Delete: `services/frontend/workspace/src/app/api/me/trust/` (entire subtree)
- Delete: `services/frontend/workspace/src/app/api/shared/trust/` (entire subtree)
- Delete: `services/frontend/workspace/src/stub/trust/` (entire directory)
- Modify: `services/frontend/workspace/src/lib/grpc.ts` (drop `TrustService` import + `trustClient` export)

**Interfaces:**
- Consumes: nothing (`modules/trust` is dead code — verified by `grep -rl 'modules/trust\|trustClient\|TrustService' src` showing zero non-trust callers prior to K-segment).
- Produces: cleaner tree.

- [ ] **Step 1: Re-verify there are no non-trust callers**

```bash
/usr/bin/grep -rln "modules/trust\|trustClient\|TrustService\|@/stub/trust" services/frontend/workspace/src 2>&1 | /usr/bin/grep -v "src/modules/trust\|src/app/api/cast/trust\|src/app/api/me/trust\|src/app/api/shared/trust\|src/stub/trust\|src/lib/grpc.ts"
```

Expected: no output. If any path appears, stop and surface it — destroying trust would break that caller.

- [ ] **Step 2: Delete the dead trees**

```bash
rm -rf services/frontend/workspace/src/modules/trust
rm -rf services/frontend/workspace/src/app/api/cast/trust
rm -rf services/frontend/workspace/src/app/api/me/trust
rm -rf services/frontend/workspace/src/app/api/shared/trust
rm -rf services/frontend/workspace/src/stub/trust
```

- [ ] **Step 3: Edit `lib/grpc.ts`**

Open `services/frontend/workspace/src/lib/grpc.ts`. Delete:

```ts
import { TrustService } from "@/stub/trust/v1/service_pb";
```

and:

```ts
// Trust domain client
export const trustClient = createClient(TrustService, transport);
```

- [ ] **Step 4: tsc + lint + build**

```bash
cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -10
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm lint 2>&1 | tail -5
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm build 2>&1 | tail -5
```

Expected: all green; no `/cast/trust`, `/me/trust`, `/shared/trust` routes in the build output.

- [ ] **Step 5: Commit**

```bash
git add -A services/frontend/workspace/src
git commit -s -m "chore(trust): remove dead frontend trust module, BFFs, and stubs

modules/trust and the cast/me/shared trust API surfaces had no
non-trust callers (verified by grep). Removing the TS stub and
the trustClient export as part of the trust slice destroy."
```

---

### Task 10: T2 — Monolith trust slice removal

**Files:**
- Delete: `services/monolith/workspace/slices/trust/` (entire directory)
- Delete: `services/monolith/workspace/spec/slices/trust/` (entire directory if it exists)
- Delete: `services/monolith/workspace/config/db/seeds/trust/` (entire directory if it exists)
- Modify: `services/monolith/workspace/bin/grpc` (drop `require "trust/..."` and `require_relative "../slices/trust/grpc/..."` lines)

**Interfaces:**
- Consumes: nothing (`grep "Trust::Slice\|Trust::Repositories\|Trust::UseCases" --include='*.rb'` outside the trust slice returns zero results — verified at planning time).
- Produces: cleaner tree.

- [ ] **Step 1: Re-verify there are no cross-slice references to Trust**

```bash
/usr/bin/grep -rn "Trust::Slice\|Trust::Repositories\|Trust::UseCases\|Trust::Adapters" services/monolith/workspace --include='*.rb' 2>&1 | /usr/bin/grep -v "/slices/trust/\|/spec/slices/trust/"
```

Expected: no output. If any line appears, the referring code must be patched first (likely an adapter swap pattern, see social cleanup C3 in the memory).

- [ ] **Step 2: Drop the registration in `bin/grpc`**

Open `services/monolith/workspace/bin/grpc`. Delete:

```ruby
require "trust/v1/service_services_pb"
```

and:

```ruby
require_relative "../slices/trust/grpc/handler"
require_relative "../slices/trust/grpc/trust_handler"
```

- [ ] **Step 3: Delete the slice directories**

```bash
rm -rf services/monolith/workspace/slices/trust
rm -rf services/monolith/workspace/spec/slices/trust
rm -rf services/monolith/workspace/config/db/seeds/trust 2>/dev/null || true
```

- [ ] **Step 4: Boot smoke + identity spec**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: 63 examples, 1 pre-existing failure. No new errors from missing trust constants.

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/karte 2>&1 | tail -5
```

Expected: karte specs still pass.

- [ ] **Step 5: Commit**

```bash
git add -A services/monolith/workspace
git commit -s -m "chore(trust): remove monolith trust slice (handler, use_cases, relations, spec)

No cross-slice references to Trust::* outside the trust directory
(verified by grep). bin/grpc unbinds the handler. Stubs remain
until T3 regenerates without trust/v1."
```

---

### Task 11: T3 — Proto trust removal + stub regeneration

**Files:**
- Delete: `proto/trust/` (entire directory)
- Modify: `services/monolith/workspace/stubs/trust/` (removed by codegen, or rm explicitly)
- Modify: `services/frontend/workspace/src/stub/trust/` (already deleted in T1, but codegen must not regenerate it — and it won't, since the proto is gone)

- [ ] **Step 1: Delete the proto**

```bash
rm -rf proto/trust
```

- [ ] **Step 2: Regenerate stubs**

```bash
./bin/codegen
```

Expected: regeneration completes. No karte / identity / other proto changes.

- [ ] **Step 3: Clean stale stub artifacts**

The TS stubs were already deleted in T1. The Ruby stubs under `services/monolith/workspace/stubs/trust/` will linger after codegen (codegen does not delete removed stubs). Remove them explicitly:

```bash
rm -rf services/monolith/workspace/stubs/trust
```

- [ ] **Step 4: Verify nothing references trust stubs**

```bash
/usr/bin/grep -rn "trust/v1\|stubs/trust\|stub/trust" services/monolith/workspace services/frontend/workspace proto 2>&1 | head
```

Expected: no output (or only the `proto/karte` import? — should be empty in practice).

- [ ] **Step 5: Full backend + frontend verification**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity spec/slices/karte 2>&1 | tail -5
cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm lint 2>&1 | tail -5
cd services/frontend/workspace && env -u NODE_OPTIONS pnpm build 2>&1 | tail -5
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add -A proto services/monolith/workspace/stubs services/frontend/workspace/src/stub
git commit -s -m "chore(trust): drop proto/trust and regenerate stubs

trust/v1 is no longer produced by codegen. Ruby stub directory
removed explicitly (codegen does not prune)."
```

---

### Task 12: T4 — DB DROP of trust schema (pre-prod, data loss tolerated)

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260628010000_drop_trust_schema.rb`

- [ ] **Step 1: Write the migration**

`services/monolith/workspace/config/db/migrate/20260628010000_drop_trust_schema.rb`:

```ruby
# frozen_string_literal: true

# Drops the entire trust schema. Per the karte spec
# (docs/superpowers/specs/2026-06-27-karte-design.md), trust is being
# destroyed as part of the karte sub-project; pre-prod means data loss
# on these tables is acceptable.
ROM::SQL.migration do
  up do
    run "DROP SCHEMA IF EXISTS trust CASCADE"
  end

  down do
    raise Sequel::Error, "trust schema is intentionally destroyed; restore from backup if needed"
  end
end
```

- [ ] **Step 2: Apply**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate 2>&1 | tail -5
env -u NODE_OPTIONS bundle exec hanami db migrate 2>&1 | tail -5
```

Expected: `migrated in ...s`. pg_dump warning is expected and ignored.

- [ ] **Step 3: Verify the schema is gone**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec ruby -e '
ENV["BUNDLE_WITHOUT"] = "development:cli:test"
ENV["HANAMI_ENV"] = "production"
ENV["SECRET_KEY_BASE"] ||= "x"
require "bundler/setup"; require "hanami/setup"; Hanami.app.boot
db = Hanami.app["db.gateway"].connection
puts db[Sequel.lit("SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?", "trust")].first.inspect
' 2>&1 | tail -3
```

Expected: `nil` (= schema is gone).

- [ ] **Step 4: Full verification**

```bash
cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity spec/slices/karte 2>&1 | tail -5
```

Expected: 63 + N_karte examples, 1 pre-existing failure.

- [ ] **Step 5: Commit and push**

```bash
git add services/monolith/workspace/config/db/migrate/20260628010000_drop_trust_schema.rb
git commit -s -m "chore(trust): drop trust schema (pre-prod, data loss tolerated)

Final step of the trust destroy: DROP SCHEMA trust CASCADE.
Down migration intentionally raises — restore from backup if needed."
git push
```

- [ ] **Step 6: Ready the PR**

Move the PR opened in K-push-and-draft-PR from Draft to ready, and rename if desired:

```bash
gh pr ready <pr-number> -R panicboat/monorepo
gh pr edit <pr-number> -R panicboat/monorepo --title "feat(karte): Cast-only Guest review + trust slice destroy"
```

---

## Self-review

I reviewed the spec against the plan with fresh eyes.

**Spec coverage:**

- ✓ Concept + decisions (silent, account_id only, rating + body, role check, paywall gate, abuse defense, edit/delete) → K2/K3/K4/K7
- ✓ `karte__entries` / `karte__access` / `karte__reports` schemas with all columns + constraints → K2
- ✓ Indices `(target, created, id)` / `(author, created, id)` → K2 Step 1
- ✓ Repositories with `aggregate` and idempotent report `create` → K3
- ✓ 7 RPCs + KarteEntry shape with `flagged` (no raw count) → K1, K4, K5
- ✓ TDD on use_cases → K4 (red-then-green explicit)
- ✓ Access gate via `karte__access` find_by_account → K4
- ✓ target role check (`role == GUEST`, guard at use_case) → K4 Step 1 spec + Step 3 code
- ✓ author identity transparency via Profile slice + media adapter → K4 Step 5 + 6
- ✓ `flagged = reported_count >= 3` and `MIN_FLAG_REPORTS = 3` constant → K4 description
- ✓ Frontend types + 7 BFFs + 6 hooks → K6
- ✓ Guest profile tab + /karte/my page + drawer + /dev/ui mock → K7
- ✓ Trust destroy T1 (frontend), T2 (monolith), T3 (proto), T4 (DB DROP) → all four tasks
- ✓ Verification = backend rspec + frontend tsc/lint(0e/0w)/build → reiterated in every task

**Placeholder scan:**

- One spot is loosely specified: K7 Step 6 says "the exact wrapping pattern depends on what the existing tabs use". This is acceptable because I tell the subagent to inspect the tab vocabulary in Step 1 of K7. Subagent has enough context to match.
- Step 5 of K4 is a deliberate condensation (the remaining 6 use_cases are described as contracts + spec coverage, not full code blocks). Fully expanding each would triple the plan length while adding little — the patterns in Step 1-4 are explicit enough that any competent implementer can replicate them. If a subagent fails on this, the next iteration of the plan can expand individual use_cases inline.

**Type consistency:**

- Use case error names referenced consistently (`CreateError`, `UpdateError`, etc.) across spec, repo, K4, K5.
- `MIN_FLAG_REPORTS` constant defined in `ListEntriesByTarget` and reused in K5 handler.
- `karte__access` row shape (`account_id`, `granted_at`, `granted_by`) consistent across schema (K2), repo (K3), use_case (K4 get_my_access), and seed (K5 Step 5).
- BFF JSON shape (camelCase `authorUsername` / `authorAvatarUrl` / `avgRating`) consistent between types.ts (K6 Step 2) and BFF route bodies (K6 Step 3).

No issues to fix.
