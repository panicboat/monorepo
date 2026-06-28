# Account Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cast self-deactivation (2-stage soft → 30-day grace → hard-delete cron) and codify the "no admin destroy" invariant. Drop the `export` requirement from the北極星 doc since "凍結しない" already covers "customer retention".

**Architecture:** New `deactivated_at` column on `identity__users`, new `DeactivateAccount` RPC, `Login` auto-reactivates. A cron-callable rake task runs `PurgeDeactivatedAccounts` which orchestrates per-slice `PurgeAccount` use_cases. Karte entries authored by the deactivated Cast and messaging threads/messages are retained (`author/sender` null-references after hard-delete); everything else is cascade-deleted application-level (no cross-schema FK in this codebase).

**Tech Stack:** Ruby 3.4 + Hanami + dry-rb + ROM-SQL + Gruf, PostgreSQL, buf + protoc-gen-es, Next.js 15 App Router (BFF) + SWR, @connectrpc/connect-node for gRPC transport.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-29-account-durability-design.md`. Every Decision in that spec is binding.
- Worktree: `.claude/worktrees/feat-account-durability`, branch `feat/account-durability`, base = `origin/main` (= `7f5b75b2`).
- Git: commit with `-s` signoff, NO `Co-Authored-By`, English commit messages, conventional PR title, `gh pr create --draft` for new PRs. Switch remote to ssh on push auth failure: `git -C <worktree> remote set-url origin git@github.com:panicboat/monorepo.git`.
- Migration timestamps `20260629000000_…`, `20260629010000_…`, etc. (one minute apart per task). `structure.sql` is NOT regenerated (pg_dump version mismatch warning is expected, ignored). Verify migrations via `bundle exec rspec`.
- Bare `grep` / `find` are shadowed; use `/usr/bin/grep` / `/usr/bin/find`.
- Backend rspec baseline = identity (63 examples, 1 pre-existing failure in `sms_verification_repository_spec.rb:40`) + karte (29/0) + profile/post/social/bookmarks/footprints/notifications/messaging baseline as it is at pre-task HEAD (do not hard-code numbers; compare to pre-task run).
- Frontend has NO unit-test harness. Verification = `./node_modules/.bin/tsc --noEmit` (no output) + `pnpm lint` (`0 error / 0 warning`) + `pnpm build` (green).
- Cookie mediation (post-#763): all BFFs use `requireAuth(req)` + `buildGrpcHeaders(req)` + `handleApiError`. Client hooks use `useAuthStore((s) => s.userId)` for SWR gate and `authFetch` for mutations.
- `MIN_FLAG_REPORTS` style: constants live in the file that owns them; cross-file references are explicit (e.g. `Karte::UseCases::ListEntriesByTarget::MIN_FLAG_REPORTS`).
- The brand-new `PurgeAccount` use_case per slice is idempotent (re-running on an already-purged account is no-op).

---

### Task 1: identity schema — `deactivated_at` column + repo helpers

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260629000000_add_deactivated_at_to_users.rb`
- Modify: `services/monolith/workspace/slices/identity/relations/users.rb`
- Modify: `services/monolith/workspace/slices/identity/repositories/user_repository.rb`
- Test: existing identity rspec must remain green.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `identity__users.deactivated_at timestamptz NULL`
  - `Identity::Relations::Users` exposes `:deactivated_at` attribute
  - `Identity::Repositories::UserRepository#deactivate(user_id)` sets `deactivated_at = Time.now` and bumps `updated_at`
  - `Identity::Repositories::UserRepository#reactivate(user_id)` sets `deactivated_at = nil` and bumps `updated_at`
  - `Identity::Repositories::UserRepository#list_deactivated_before(cutoff_time)` returns an array of users with `deactivated_at IS NOT NULL AND deactivated_at < cutoff`

- [ ] **Step 1: Write the migration**

Create `services/monolith/workspace/config/db/migrate/20260629000000_add_deactivated_at_to_users.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table :identity__users do
      add_column :deactivated_at, DateTime
    end
  end
end
```

- [ ] **Step 2: Update the relation**

Open `services/monolith/workspace/slices/identity/relations/users.rb`. Add the new attribute right after `:locked_until`:

```ruby
        attribute :role, Types::Integer
        attribute :failed_login_attempts, Types::Integer
        attribute :locked_until, Types::Time
        attribute :deactivated_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time
```

- [ ] **Step 3: Add repository helpers**

Open `services/monolith/workspace/slices/identity/repositories/user_repository.rb`. Append three methods at the end of the class (before the final `end end end`):

```ruby
      def deactivate(user_id)
        update(user_id, deactivated_at: Time.now, updated_at: Time.now)
      end

      def reactivate(user_id)
        update(user_id, deactivated_at: nil, updated_at: Time.now)
      end

      def list_deactivated_before(cutoff)
        users.where { deactivated_at < cutoff }.to_a
      end
```

- [ ] **Step 4: Apply the migration**

Run from the worktree root:

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate 2>&1 | tail -5
env -u NODE_OPTIONS bundle exec hanami db migrate 2>&1 | tail -5
```

Expected: each prints `=> database <name> migrated in 0.X...s`. The trailing `pg_dump server version mismatch` warning is expected and ignored.

- [ ] **Step 5: Identity rspec baseline holds**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: same baseline as `7f5b75b2` (63 examples, 1 pre-existing failure in `sms_verification_repository_spec.rb:40`).

- [ ] **Step 6: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/20260629000000_add_deactivated_at_to_users.rb \
        services/monolith/workspace/slices/identity/relations/users.rb \
        services/monolith/workspace/slices/identity/repositories/user_repository.rb
git commit -s -m "feat(identity): add deactivated_at to users + repo helpers

deactivated_at timestamp gates self-deactivation; NULL = active.
Repo gains deactivate/reactivate (single-row toggles) and
list_deactivated_before (cron orchestrator)."
```

---

### Task 2: identity `DeactivateAccount` use_case + Login auto-reactivate (TDD)

**Files:**
- Create: `services/monolith/workspace/slices/identity/use_cases/auth/deactivate_account.rb`
- Modify: `services/monolith/workspace/slices/identity/use_cases/auth/login.rb`
- Create: `services/monolith/workspace/spec/slices/identity/use_cases/auth/deactivate_account_spec.rb`
- Modify: `services/monolith/workspace/spec/slices/identity/use_cases/auth/login_spec.rb`

**Interfaces:**
- Consumes: Task 1 (`UserRepository#deactivate`, `#reactivate`, the `deactivated_at` attribute)
- Produces:
  - `Identity::UseCases::Auth::DeactivateAccount#call(viewer_account_id:)` returns nil. Idempotent: deactivating an already-deactivated account is a no-op (does not refresh the timestamp). Container key `use_cases.auth.deactivate_account`.
  - `Identity::UseCases::Auth::Login#call(phone_number:, password:, role: nil)` now returns the same shape PLUS one new key when a deactivated account was auto-reactivated: `{ access_token:, refresh_token:, account:, reactivated: true }`. For non-deactivated accounts the `reactivated` key is omitted (or `false` if you prefer always-present; choose omitted for backward compat — see spec).

- [ ] **Step 1: Write the failing spec for DeactivateAccount**

Create `services/monolith/workspace/spec/slices/identity/use_cases/auth/deactivate_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Auth::DeactivateAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:user_repository) }
  let(:viewer_id) { "viewer-cast-1" }

  it "deactivates the account when it is currently active" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(
      double(:user, id: viewer_id, deactivated_at: nil)
    )
    expect(repo).to receive(:deactivate).with(viewer_id)
    use_case.call(viewer_account_id: viewer_id)
  end

  it "is no-op when the account is already deactivated" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(
      double(:user, id: viewer_id, deactivated_at: Time.now - 60)
    )
    expect(repo).not_to receive(:deactivate)
    use_case.call(viewer_account_id: viewer_id)
  end

  it "returns nil regardless of branch" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(
      double(:user, id: viewer_id, deactivated_at: nil)
    )
    allow(repo).to receive(:deactivate)
    expect(use_case.call(viewer_account_id: viewer_id)).to be_nil
  end

  it "raises when the user is not found" do
    allow(repo).to receive(:find_by_id).with(viewer_id).and_return(nil)
    expect { use_case.call(viewer_account_id: viewer_id) }.to raise_error(
      Identity::UseCases::Auth::DeactivateAccount::DeactivationError, "User not found"
    )
  end
end
```

- [ ] **Step 2: Run the spec, expect RED**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/auth/deactivate_account_spec.rb 2>&1 | tail -10
```

Expected: `NameError: uninitialized constant Identity::UseCases::Auth::DeactivateAccount`.

- [ ] **Step 3: Implement DeactivateAccount**

Create `services/monolith/workspace/slices/identity/use_cases/auth/deactivate_account.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module Auth
      class DeactivateAccount
        class DeactivationError < StandardError; end

        include Identity::Deps[repo: "repositories.user_repository"]

        def call(viewer_account_id:)
          user = repo.find_by_id(viewer_account_id)
          raise DeactivationError, "User not found" unless user

          # Idempotent: already-deactivated accounts are not re-stamped.
          return nil if user.deactivated_at

          repo.deactivate(viewer_account_id)
          nil
        end
      end
    end
  end
end
```

- [ ] **Step 4: Run the spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/auth/deactivate_account_spec.rb 2>&1 | tail -5
```

Expected: `4 examples, 0 failures`.

- [ ] **Step 5: Write the failing spec additions for Login (auto-reactivate)**

Open `services/monolith/workspace/spec/slices/identity/use_cases/auth/login_spec.rb`. Add a new context near the others (BEFORE the existing `context "when credentials are valid"` block — order does not matter for RSpec, but keep them grouped):

```ruby
    context "when account is deactivated and credentials are valid" do
      let(:user) do
        double(
          :user,
          id: "user-123",
          phone_number: phone_number,
          password_digest: BCrypt::Password.create(password),
          role: role,
          failed_login_attempts: 0,
          locked_until: nil,
          deactivated_at: Time.now - 86_400 # 1 day ago, within 30-day grace
        )
      end

      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(user)
        allow(repo).to receive(:reset_login_attempts)
        allow(repo).to receive(:reactivate)
      end

      it "auto-reactivates and returns a normal session plus reactivated: true" do
        expect(repo).to receive(:reactivate).with("user-123")
        result = use_case.call(phone_number: phone_number, password: password, role: role)
        expect(result[:access_token]).not_to be_nil
        expect(result[:reactivated]).to be(true)
      end
    end
```

Also add `deactivated_at: nil` to every existing `double(:user, …)` in the spec (search for occurrences) — without it the new `if user.deactivated_at` check raises `RSpec::Mocks::MockExpectationError` for unstubbed methods on the doubles.

- [ ] **Step 6: Run login spec, expect RED on new test + RED on existing tests due to missing `deactivated_at` stub**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/auth/login_spec.rb 2>&1 | tail -10
```

Expected: the new test fails ("reactivated key missing") + existing tests fail ("received unexpected message :deactivated_at"). This is fine — the RED step.

- [ ] **Step 7: Update Login to auto-reactivate**

Open `services/monolith/workspace/slices/identity/use_cases/auth/login.rb`. Update the section after the BCrypt check and role check, BEFORE the `repo.reset_login_attempts` call. Replace:

```ruby
          repo.reset_login_attempts(user.id)

          token = ::Auth::JwtCodec.encode(sub: user.id, role: user.role)

          refresh_token = SecureRandom.hex(32)
          refresh_repo.create(token: refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)

          { access_token: token, refresh_token: refresh_token, account: { id: user.id, phone_number: user.phone_number, role: user.role } }
```

with:

```ruby
          repo.reset_login_attempts(user.id)

          # Auto-reactivate if the account is in soft-deleted (deactivated) state.
          # Same-phone + correct password is treated as the user's intent to come back.
          reactivated = false
          if user.deactivated_at
            repo.reactivate(user.id)
            reactivated = true
          end

          token = ::Auth::JwtCodec.encode(sub: user.id, role: user.role)

          refresh_token = SecureRandom.hex(32)
          refresh_repo.create(token: refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)

          result = {
            access_token: token,
            refresh_token: refresh_token,
            account: { id: user.id, phone_number: user.phone_number, role: user.role }
          }
          result[:reactivated] = true if reactivated
          result
```

- [ ] **Step 8: Run identity rspec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: 63 + 4 (new deactivate_account spec) + 1 (new login reactivate test) = 68 examples, 1 pre-existing failure.

- [ ] **Step 9: Commit**

```bash
git add services/monolith/workspace/slices/identity/use_cases/auth/deactivate_account.rb \
        services/monolith/workspace/slices/identity/use_cases/auth/login.rb \
        services/monolith/workspace/spec/slices/identity/use_cases/auth/deactivate_account_spec.rb \
        services/monolith/workspace/spec/slices/identity/use_cases/auth/login_spec.rb
git commit -s -m "feat(identity): DeactivateAccount use_case + Login auto-reactivates (TDD)

DeactivateAccount is idempotent. Login sees a deactivated user and
correct credentials as an intent to come back: reactivates and adds
reactivated: true to the response. RPC/handler exposure comes in
the next task."
```

---

### Task 3: identity proto + handler — `DeactivateAccount` RPC + `LoginResponse.reactivated`

**Files:**
- Modify: `proto/identity/v1/service.proto`
- Regen (codegen output): `services/monolith/workspace/stubs/identity/v1/service_pb.rb`, `service_services_pb.rb`, `services/frontend/workspace/src/stub/identity/v1/service_pb.ts`
- Modify: `services/monolith/workspace/slices/identity/grpc/handler.rb`
- Modify: `services/monolith/workspace/slices/identity/presenters/auth_presenter.rb`

**Interfaces:**
- Consumes: Task 2 (`Identity::UseCases::Auth::DeactivateAccount`, `Login`'s new `reactivated` key)
- Produces:
  - proto: `service IdentityService { … rpc DeactivateAccount(DeactivateAccountRequest) returns (DeactivateAccountResponse); }` with empty request/response message types
  - proto: `LoginResponse` gains `bool reactivated = 4;`
  - handler: `DeactivateAccount` requires authenticated viewer (raises `UNAUTHENTICATED` otherwise), invokes the use_case, returns empty response

- [ ] **Step 1: Edit the proto**

Open `proto/identity/v1/service.proto`. In the service block, after `GetCurrentAccount`, add:

```proto
  // Deactivate (soft-delete) the current account. 30-day grace, then hard-delete via cron.
  rpc DeactivateAccount (DeactivateAccountRequest) returns (DeactivateAccountResponse);
```

Locate `message LoginResponse { … }` and add the new field:

```proto
message LoginResponse {
  string access_token = 1;
  Account account = 2;
  string refresh_token = 3;
  bool reactivated = 4;
}
```

At the bottom of the file (or wherever messages are grouped), add:

```proto
message DeactivateAccountRequest {}
message DeactivateAccountResponse {}
```

- [ ] **Step 2: Regenerate stubs**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-account-durability
./bin/codegen
```

Expected: `[codegen] regenerating Ruby stubs (monolith)...` then `[codegen] regenerating TypeScript stubs (frontend)...` then `[codegen] done.` No errors.

- [ ] **Step 3: Bind the RPC in the handler**

Open `services/monolith/workspace/slices/identity/grpc/handler.rb`. In the `rpc :…` block (around the existing GetCurrentAccount line), add:

```ruby
      rpc :DeactivateAccount, ::Identity::V1::DeactivateAccountRequest, ::Identity::V1::DeactivateAccountResponse
```

In the `Identity::Deps[…]` block (where the other use_cases are injected), add:

```ruby
        deactivate_account_uc: "use_cases.auth.deactivate_account",
```

Below the existing `def get_current_account` method, add:

```ruby
      def deactivate_account
        user_id = ::Current.user_id
        unless user_id
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Unauthenticated")
        end

        deactivate_account_uc.call(viewer_account_id: user_id)
        ::Identity::V1::DeactivateAccountResponse.new
      rescue Identity::UseCases::Auth::DeactivateAccount::DeactivationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end
```

- [ ] **Step 4: Update `AuthPresenter.to_login_response` to include `reactivated`**

Open `services/monolith/workspace/slices/identity/presenters/auth_presenter.rb`. Replace `to_login_response`:

```ruby
      def self.to_login_response(result)
        ::Identity::V1::LoginResponse.new(
          access_token: result[:access_token],
          refresh_token: result[:refresh_token],
          account: AccountPresenter.to_proto(result[:account]),
          reactivated: result[:reactivated] == true
        )
      end
```

- [ ] **Step 5: Boot smoke + identity rspec**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec ruby -e '
ENV["BUNDLE_WITHOUT"] = "development:cli:test"
ENV["HANAMI_ENV"] = "production"
ENV["SECRET_KEY_BASE"] ||= "x"
require "bundler/setup"; require "hanami/setup"; Hanami.app.boot
$LOAD_PATH.unshift(File.expand_path("stubs"))
require "identity/v1/service_services_pb"
require_relative "slices/identity/grpc/handler"
require "gruf"
puts Gruf.services.map(&:service_name).grep(/identity/)
' 2>&1 | tail -3
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity 2>&1 | tail -5
```

Expected: `identity.v1.IdentityService` appears, and rspec is 68 examples, 1 pre-existing failure.

- [ ] **Step 6: Frontend stub regen verification (codegen already ran in Step 2)**

```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-account-durability
git add proto/identity/v1/service.proto \
        services/monolith/workspace/stubs/identity/v1/service_pb.rb \
        services/monolith/workspace/stubs/identity/v1/service_services_pb.rb \
        services/frontend/workspace/src/stub/identity/v1/service_pb.ts \
        services/monolith/workspace/slices/identity/grpc/handler.rb \
        services/monolith/workspace/slices/identity/presenters/auth_presenter.rb
git commit -s -m "feat(identity): DeactivateAccount RPC + LoginResponse.reactivated

Exposes the deactivate flow to clients (cookie mediation per #763
applies). LoginResponse carries reactivated so the UI can show
'お帰りなさい' after auto-reactivation."
```

---

### Task 4: messaging schema — nullable sender_id / threads.account_a / account_b

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260629010000_relax_messaging_columns_for_deactivation.rb`
- Modify: `services/monolith/workspace/slices/messaging/relations/messages.rb`
- Modify: `services/monolith/workspace/slices/messaging/relations/threads.rb`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `messaging__messages.sender_id` becomes NULLABLE
  - `messaging__threads.account_a` and `account_b` become NULLABLE
  - the `chk_threads_account_order` CHECK and `uq_threads_account_pair` UNIQUE constraints remain; PG accepts NULL in these (CHECK is "false → reject", NULL → pass; UNIQUE treats NULLs as distinct)
  - relations expose `sender_id`, `account_a`, `account_b` as `Types::String.optional`

- [ ] **Step 1: Write the migration**

Create `services/monolith/workspace/config/db/migrate/20260629010000_relax_messaging_columns_for_deactivation.rb`:

```ruby
# frozen_string_literal: true

# Allow sender_id and threads.account_a / account_b to be NULL so that
# hard-delete of a Cast can preserve the conversation history for the
# remaining participant (mainstream messaging UX: "(retired)" sender).
ROM::SQL.migration do
  up do
    alter_table :messaging__messages do
      set_column_allow_null :sender_id
    end
    alter_table :messaging__threads do
      set_column_allow_null :account_a
      set_column_allow_null :account_b
    end
  end

  down do
    alter_table :messaging__messages do
      set_column_not_null :sender_id
    end
    alter_table :messaging__threads do
      set_column_not_null :account_a
      set_column_not_null :account_b
    end
  end
end
```

- [ ] **Step 2: Update the relations**

`services/monolith/workspace/slices/messaging/relations/messages.rb` — change `attribute :sender_id, Types::String` to:

```ruby
        attribute :sender_id, Types::String.optional
```

`services/monolith/workspace/slices/messaging/relations/threads.rb` — change `attribute :account_a, Types::String` and `attribute :account_b, Types::String` to:

```ruby
        attribute :account_a, Types::String.optional
        attribute :account_b, Types::String.optional
```

- [ ] **Step 3: Apply migration**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate 2>&1 | tail -5
env -u NODE_OPTIONS bundle exec hanami db migrate 2>&1 | tail -5
```

Expected: each `migrated in 0.X...s`.

- [ ] **Step 4: messaging rspec + identity rspec baseline**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/messaging spec/slices/identity 2>&1 | tail -5
```

Expected: same baseline as pre-task (do NOT compare to a hard-coded number; just confirm no new failures introduced).

- [ ] **Step 5: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/20260629010000_relax_messaging_columns_for_deactivation.rb \
        services/monolith/workspace/slices/messaging/relations/messages.rb \
        services/monolith/workspace/slices/messaging/relations/threads.rb
git commit -s -m "feat(messaging): allow NULL sender_id + threads.account_a/b

Prepares the schema for PurgeAccount in task 9: a deactivated Cast's
messages get sender_id = NULL and their thread membership is
NULL'd out, preserving the remaining participant's conversation."
```

---

### Task 5: media schema — `uploader_account_id` (NULLABLE) + Upload use_case optional param

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260629020000_add_uploader_account_id_to_media_files.rb`
- Modify: `services/monolith/workspace/slices/media/relations/files.rb`
- Modify: `services/monolith/workspace/slices/media/repositories/media_repository.rb` (read first to confirm signatures)
- Modify: `services/monolith/workspace/slices/media/use_cases/<upload-use-case>.rb` (read the slice's use_cases dir; the use_case that creates files needs the new param)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `media__files.uploader_account_id uuid NULL`
  - `Media::Relations::Files` exposes `:uploader_account_id, Types::String.optional`
  - The Media create-file / register-media use_case accepts an OPTIONAL `uploader_account_id:` kwarg (existing callers do not pass it; future callers can). When omitted, the row's `uploader_account_id` is NULL.

- [ ] **Step 1: Inspect existing media use_cases to find the file-creation entry point**

```bash
/usr/bin/find services/monolith/workspace/slices/media -name '*.rb' -not -path '*spec*' | xargs /usr/bin/grep -ln 'def call\|files.command(:create)\|create_file\|register' 2>/dev/null | head
```

Read the file(s) that handle file creation. Match the existing repository.create signature when adding the optional param.

- [ ] **Step 2: Write the migration**

Create `services/monolith/workspace/config/db/migrate/20260629020000_add_uploader_account_id_to_media_files.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table :media__files do
      add_column :uploader_account_id, :uuid
    end

    add_index :media__files, :uploader_account_id, name: :idx_media_files_uploader
  end
end
```

- [ ] **Step 3: Update the relation**

`services/monolith/workspace/slices/media/relations/files.rb` — add `:uploader_account_id` after `:created_at` or before `primary_key`:

```ruby
        attribute :created_at, Types::Time
        attribute :uploader_account_id, Types::String.optional

        primary_key :id
```

- [ ] **Step 4: Add the optional param to the repository's create path**

In the media repository (most likely `media_repository.rb` or similar; locate via Step 1), find the `def create(...)` method. Add `uploader_account_id: nil` to its kwargs and pass it through to the underlying `files.command(:create).call(...)`. Example shape (adapt to the actual code):

```ruby
      def create(media_type:, url:, ..., uploader_account_id: nil)
        files.command(:create).call(
          id: SecureRandom.uuid_v7,
          media_type: media_type,
          url: url,
          ...
          uploader_account_id: uploader_account_id
        )
      end
```

If the use_case that calls `create` is shaped to forward arbitrary kwargs, simply add the param to the public use_case method too. Do NOT update existing callers; they pass nothing for this param and the new column defaults to NULL.

- [ ] **Step 5: Apply migration**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS HANAMI_ENV=test bundle exec hanami db migrate 2>&1 | tail -5
env -u NODE_OPTIONS bundle exec hanami db migrate 2>&1 | tail -5
```

Expected: each `migrated in 0.X...s`.

- [ ] **Step 6: media rspec + identity rspec baseline**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/media spec/slices/identity 2>&1 | tail -5
```

Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/20260629020000_add_uploader_account_id_to_media_files.rb \
        services/monolith/workspace/slices/media/relations/files.rb \
        services/monolith/workspace/slices/media/repositories/media_repository.rb \
        services/monolith/workspace/slices/media/use_cases/
git commit -s -m "feat(media): add uploader_account_id (NULLABLE) + opt-in param

Foundation for PurgeAccount in task 8. Existing callers do not yet
pass the new param; backfill + NOT NULL + caller updates ship in a
future 'Media uploader tracking' sub-project per the spec."
```

---

### Task 6: PurgeAccount Phase 1 — Karte / Bookmarks / Footprints / Notifications (TDD)

**Files (per slice):**
- Karte: `slices/karte/use_cases/purge_account.rb` + `spec/slices/karte/use_cases/purge_account_spec.rb`
- Bookmarks: `slices/bookmarks/use_cases/purge_account.rb` + `spec/slices/bookmarks/use_cases/purge_account_spec.rb`
- Footprints: `slices/footprints/use_cases/purge_account.rb` + `spec/slices/footprints/use_cases/purge_account_spec.rb`
- Notifications: `slices/notifications/use_cases/purge_account.rb` + `spec/slices/notifications/use_cases/purge_account_spec.rb`

**Interfaces:**
- Consumes: existing slice repositories (you may need to add `delete_by_*` repo helpers).
- Produces: 4 idempotent `PurgeAccount#call(account_id:)` use_cases registered at `<Slice>::Slice["use_cases.purge_account"]`. Each returns nil. Each is responsible for deleting EVERY row referencing the given account_id in its slice.

#### Karte (special: only `karte__access` + `karte__reports`, NOT `karte__entries`)

- [ ] **Step 1: Karte purge spec (RED)**

Create `services/monolith/workspace/spec/slices/karte/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(access_repo: access_repo, report_repo: report_repo) }
  let(:access_repo) { double(:access_repository) }
  let(:report_repo) { double(:report_repository) }
  let(:account_id) { "cast-1" }

  it "deletes karte__access and karte__reports rows for the account, leaving karte__entries untouched" do
    expect(access_repo).to receive(:revoke).with(account_id)
    expect(report_repo).to receive(:delete_by_reporter).with(account_id)
    use_case.call(account_id: account_id)
  end

  it "is idempotent (re-running on already-purged account is no-op)" do
    allow(access_repo).to receive(:revoke).with(account_id)
    allow(report_repo).to receive(:delete_by_reporter).with(account_id)
    expect { use_case.call(account_id: account_id) }.not_to raise_error
    expect { use_case.call(account_id: account_id) }.not_to raise_error
  end
end
```

- [ ] **Step 2: Add `delete_by_reporter` to ReportRepository**

Open `services/monolith/workspace/slices/karte/repositories/report_repository.rb`. Append:

```ruby
      def delete_by_reporter(account_id)
        report_records.where(reporter_account_id: account_id).command(:delete).call
      end
```

- [ ] **Step 3: Implement Karte::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/karte/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class PurgeAccount
      include Karte::Deps[
        access_repo: "repositories.access_repository",
        report_repo: "repositories.report_repository"
      ]

      def call(account_id:)
        access_repo.revoke(account_id)
        report_repo.delete_by_reporter(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 4: Run Karte spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/karte/use_cases/purge_account_spec.rb 2>&1 | tail -5
```

Expected: `2 examples, 0 failures`.

#### Bookmarks

- [ ] **Step 5: Bookmarks purge spec (RED)**

Create `services/monolith/workspace/spec/slices/bookmarks/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Bookmarks::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(bookmark_repo: bookmark_repo) }
  let(:bookmark_repo) { double(:bookmark_repository) }

  it "deletes all bookmarks owned by the account" do
    expect(bookmark_repo).to receive(:delete_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 6: Add `delete_by_account` to BookmarkRepository**

`services/monolith/workspace/slices/bookmarks/repositories/bookmark_repository.rb` — append:

```ruby
      def delete_by_account(account_id)
        bookmark_records.where(account_id: account_id).command(:delete).call
      end
```

- [ ] **Step 7: Implement Bookmarks::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/bookmarks/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Bookmarks
  module UseCases
    class PurgeAccount
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(account_id:)
        bookmark_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 8: Run spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/bookmarks/use_cases/purge_account_spec.rb 2>&1 | tail -5
```

Expected: `1 example, 0 failures`.

#### Footprints

- [ ] **Step 9: Footprints purge spec (RED)**

Create `services/monolith/workspace/spec/slices/footprints/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Footprints::UseCases::PurgeAccount do
  let(:use_case) do
    described_class.new(visit_repo: visit_repo, read_state_repo: read_state_repo)
  end
  let(:visit_repo) { double(:visit_repository) }
  let(:read_state_repo) { double(:read_state_repository) }

  it "deletes visits where the account is visitor or visited, and the account's read_state" do
    expect(visit_repo).to receive(:delete_by_account).with("cast-1")
    expect(read_state_repo).to receive(:delete_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 10: Inspect existing footprints repos**

```bash
ls services/monolith/workspace/slices/footprints/repositories/
```

If `visit_repository.rb` and `read_state_repository.rb` exist, append the helpers there. If different, use the actual filenames.

In whichever repo owns `visit_records`:

```ruby
      def delete_by_account(account_id)
        visit_records.where { (visitor_id =~ account_id) | (visited_id =~ account_id) }
          .command(:delete).call
      end
```

In whichever repo owns `read_state_records`:

```ruby
      def delete_by_account(account_id)
        read_state_records.where(account_id: account_id).command(:delete).call
      end
```

- [ ] **Step 11: Implement Footprints::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/footprints/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Footprints
  module UseCases
    class PurgeAccount
      include Footprints::Deps[
        visit_repo: "repositories.visit_repository",
        read_state_repo: "repositories.read_state_repository"
      ]

      def call(account_id:)
        visit_repo.delete_by_account(account_id)
        read_state_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
```

(If the repository container keys differ from these literal strings, look at how existing footprints use_cases reference repos in `Footprints::Deps[…]` and copy the key.)

- [ ] **Step 12: Run spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/footprints/use_cases/purge_account_spec.rb 2>&1 | tail -5
```

Expected: `1 example, 0 failures`.

#### Notifications

- [ ] **Step 13: Notifications purge spec (RED)**

Create `services/monolith/workspace/spec/slices/notifications/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::PurgeAccount do
  let(:use_case) do
    described_class.new(
      notification_repo: notification_repo,
      preference_repo: preference_repo
    )
  end
  let(:notification_repo) { double(:notification_repository) }
  let(:preference_repo) { double(:preference_repository) }

  it "deletes notifications (recipient OR latest_actor) and the preferences row" do
    expect(notification_repo).to receive(:delete_by_account).with("cast-1")
    expect(preference_repo).to receive(:delete_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 14: Add repo helpers**

In `services/monolith/workspace/slices/notifications/repositories/notification_repository.rb` (locate the actual class — the file may be named differently; the container key is what matters):

```ruby
      def delete_by_account(account_id)
        notification_records.where { (recipient_id =~ account_id) | (latest_actor_id =~ account_id) }
          .command(:delete).call
      end
```

In `services/monolith/workspace/slices/notifications/repositories/preference_repository.rb`:

```ruby
      def delete_by_account(account_id)
        preference_records.where(account_id: account_id).command(:delete).call
      end
```

- [ ] **Step 15: Implement Notifications::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/notifications/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Notifications
  module UseCases
    class PurgeAccount
      include Notifications::Deps[
        notification_repo: "repositories.notification_repository",
        preference_repo: "repositories.preference_repository"
      ]

      def call(account_id:)
        notification_repo.delete_by_account(account_id)
        preference_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 16: Run spec + identity baseline**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/notifications/use_cases/purge_account_spec.rb spec/slices/identity 2>&1 | tail -5
```

Expected: notification spec passes, identity baseline holds.

- [ ] **Step 17: Commit (Phase 1)**

```bash
git add services/monolith/workspace/slices/karte/use_cases/purge_account.rb \
        services/monolith/workspace/slices/karte/repositories/report_repository.rb \
        services/monolith/workspace/spec/slices/karte/use_cases/purge_account_spec.rb \
        services/monolith/workspace/slices/bookmarks/use_cases/purge_account.rb \
        services/monolith/workspace/slices/bookmarks/repositories/bookmark_repository.rb \
        services/monolith/workspace/spec/slices/bookmarks/use_cases/purge_account_spec.rb \
        services/monolith/workspace/slices/footprints/use_cases/purge_account.rb \
        services/monolith/workspace/slices/footprints/repositories/ \
        services/monolith/workspace/spec/slices/footprints/use_cases/purge_account_spec.rb \
        services/monolith/workspace/slices/notifications/use_cases/purge_account.rb \
        services/monolith/workspace/slices/notifications/repositories/ \
        services/monolith/workspace/spec/slices/notifications/use_cases/purge_account_spec.rb
git commit -s -m "feat(account-durability): PurgeAccount for karte/bookmarks/footprints/notifications

Each slice gains an idempotent PurgeAccount(account_id:) use_case.
Karte deliberately retains karte__entries (Cast's own writings stay
as safety information for other Casts); only karte__access and
karte__reports are deleted."
```

---

### Task 7: PurgeAccount Phase 2 — Profile / Social / Post (TDD)

**Files (per slice):**
- Profile: `slices/profile/use_cases/purge_account.rb` + `spec/slices/profile/use_cases/purge_account_spec.rb`
- Social: `slices/social/use_cases/purge_account.rb` + `spec/slices/social/use_cases/purge_account_spec.rb`
- Post: `slices/post/use_cases/purge_account.rb` + `spec/slices/post/use_cases/purge_account_spec.rb`

**Interfaces:**
- Consumes: existing slice repositories.
- Produces: 3 idempotent `PurgeAccount#call(account_id:)` use_cases at `<Slice>::Slice["use_cases.purge_account"]`.

#### Profile

- [ ] **Step 1: Profile purge spec (RED)**

Create `services/monolith/workspace/spec/slices/profile/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Profile::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(profile_repo: profile_repo) }
  let(:profile_repo) { double(:profile_repository) }

  it "deletes profile_areas first, then the profile row" do
    expect(profile_repo).to receive(:delete_profile_areas_by_account).with("cast-1").ordered
    expect(profile_repo).to receive(:delete_by_account).with("cast-1").ordered
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 2: Add helpers to ProfileRepository**

Open `services/monolith/workspace/slices/profile/repositories/profile_repository.rb` and append:

```ruby
      def delete_profile_areas_by_account(account_id)
        # profile__profile_areas.profile_id is profile.account_id (PK = account_id).
        profile_areas.where(profile_id: account_id).command(:delete).call
      end

      def delete_by_account(account_id)
        profiles.where(account_id: account_id).command(:delete).call
      end
```

(If the actual relation reader names differ from `profiles` / `profile_areas`, use whichever the repository already references.)

- [ ] **Step 3: Implement Profile::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/profile/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class PurgeAccount
      include Profile::Deps[profile_repo: "repositories.profile_repository"]

      def call(account_id:)
        profile_repo.delete_profile_areas_by_account(account_id)
        profile_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 4: Run spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/profile/use_cases/purge_account_spec.rb 2>&1 | tail -5
```

#### Social

- [ ] **Step 5: Social purge spec (RED)**

Create `services/monolith/workspace/spec/slices/social/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::PurgeAccount do
  let(:use_case) do
    described_class.new(follow_repo: follow_repo, block_repo: block_repo)
  end
  let(:follow_repo) { double(:follow_repository) }
  let(:block_repo) { double(:block_repository) }

  it "deletes follows (follower OR followee) and blocks (blocker OR blocked)" do
    expect(follow_repo).to receive(:delete_by_account).with("cast-1")
    expect(block_repo).to receive(:delete_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 6: Add repo helpers**

In `services/monolith/workspace/slices/social/repositories/follow_repository.rb` append:

```ruby
      def delete_by_account(account_id)
        follows.where { (follower_id =~ account_id) | (followee_id =~ account_id) }
          .command(:delete).call
      end
```

In `services/monolith/workspace/slices/social/repositories/block_repository.rb` append:

```ruby
      def delete_by_account(account_id)
        blocks.where { (blocker_id =~ account_id) | (blocked_id =~ account_id) }
          .command(:delete).call
      end
```

- [ ] **Step 7: Implement Social::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/social/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    class PurgeAccount
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      def call(account_id:)
        follow_repo.delete_by_account(account_id)
        block_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 8: Run spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/social/use_cases/purge_account_spec.rb 2>&1 | tail -5
```

#### Post

- [ ] **Step 9: Post purge spec (RED)**

Create `services/monolith/workspace/spec/slices/post/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Post::UseCases::PurgeAccount do
  let(:use_case) do
    described_class.new(
      post_repo: post_repo,
      like_repo: like_repo,
      comment_repo: comment_repo
    )
  end
  let(:post_repo) { double(:post_repository) }
  let(:like_repo) { double(:like_repository) }
  let(:comment_repo) { double(:comment_repository) }

  it "deletes likes, comments, then posts owned by the account" do
    expect(like_repo).to receive(:delete_by_account).with("cast-1").ordered
    expect(comment_repo).to receive(:delete_by_account).with("cast-1").ordered
    expect(post_repo).to receive(:delete_by_author).with("cast-1").ordered
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 10: Add repo helpers**

Open `services/monolith/workspace/slices/post/repositories/like_repository.rb` (locate via `ls services/monolith/workspace/slices/post/repositories/`) and append:

```ruby
      def delete_by_account(account_id)
        # likes uses two legacy id columns: guest_user_id (older) and account_id (newer).
        likes.where { (guest_user_id =~ account_id) | (account_id =~ account_id) }
          .command(:delete).call
      end
```

In `services/monolith/workspace/slices/post/repositories/comment_repository.rb` append:

```ruby
      def delete_by_account(account_id)
        comments.where(user_id: account_id).command(:delete).call
      end
```

In `services/monolith/workspace/slices/post/repositories/post_repository.rb` append:

```ruby
      def delete_by_author(account_id)
        # posts uses cast_user_id (primary) and author_id (optional newer column).
        posts.where { (cast_user_id =~ account_id) | (author_id =~ account_id) }
          .command(:delete).call
        # Related rows in post__post_media and post__hashtags are FK-cascaded
        # within the post schema (intra-schema FKs exist per the migrations).
      end
```

- [ ] **Step 11: Implement Post::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/post/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Post
  module UseCases
    class PurgeAccount
      include Post::Deps[
        post_repo: "repositories.post_repository",
        like_repo: "repositories.like_repository",
        comment_repo: "repositories.comment_repository"
      ]

      def call(account_id:)
        like_repo.delete_by_account(account_id)
        comment_repo.delete_by_account(account_id)
        post_repo.delete_by_author(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 12: Run spec + full backend baseline**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/profile spec/slices/social spec/slices/post spec/slices/identity 2>&1 | tail -5
```

Expected: existing baselines hold; new specs pass.

- [ ] **Step 13: Commit (Phase 2)**

```bash
git add services/monolith/workspace/slices/profile/use_cases/purge_account.rb \
        services/monolith/workspace/slices/profile/repositories/profile_repository.rb \
        services/monolith/workspace/spec/slices/profile/use_cases/purge_account_spec.rb \
        services/monolith/workspace/slices/social/use_cases/purge_account.rb \
        services/monolith/workspace/slices/social/repositories/follow_repository.rb \
        services/monolith/workspace/slices/social/repositories/block_repository.rb \
        services/monolith/workspace/spec/slices/social/use_cases/purge_account_spec.rb \
        services/monolith/workspace/slices/post/use_cases/purge_account.rb \
        services/monolith/workspace/slices/post/repositories/like_repository.rb \
        services/monolith/workspace/slices/post/repositories/comment_repository.rb \
        services/monolith/workspace/slices/post/repositories/post_repository.rb \
        services/monolith/workspace/spec/slices/post/use_cases/purge_account_spec.rb
git commit -s -m "feat(account-durability): PurgeAccount for profile/social/post

profile clears profile_areas before profiles. social wipes both
follow directions and both block directions. post wipes likes /
comments / posts; intra-schema FKs handle post_media / hashtags."
```

---

### Task 8: PurgeAccount for Media (TDD)

**Files:**
- Create: `services/monolith/workspace/slices/media/use_cases/purge_account.rb`
- Modify: `services/monolith/workspace/slices/media/repositories/media_repository.rb` (add `delete_by_uploader`)
- Create: `services/monolith/workspace/spec/slices/media/use_cases/purge_account_spec.rb`

**Interfaces:**
- Consumes: Task 5 (the `uploader_account_id` column on `media__files`)
- Produces: `Media::UseCases::PurgeAccount#call(account_id:)` deletes only `media__files` rows whose `uploader_account_id = self`. Pre-existing orphan rows (uploader_account_id IS NULL) are not touched; physical object storage cleanup is out of scope.

- [ ] **Step 1: Spec (RED)**

Create `services/monolith/workspace/spec/slices/media/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Media::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:media_repository) }

  it "deletes media__files where uploader_account_id matches" do
    expect(repo).to receive(:delete_by_uploader).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 2: Add `delete_by_uploader` to MediaRepository**

Append to `services/monolith/workspace/slices/media/repositories/media_repository.rb`:

```ruby
      def delete_by_uploader(account_id)
        files.where(uploader_account_id: account_id).command(:delete).call
      end
```

- [ ] **Step 3: Implement Media::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/media/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Media
  module UseCases
    class PurgeAccount
      include Media::Deps[repo: "repositories.media_repository"]

      def call(account_id:)
        repo.delete_by_uploader(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 4: Run spec + baseline**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/media spec/slices/identity 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add services/monolith/workspace/slices/media/use_cases/purge_account.rb \
        services/monolith/workspace/slices/media/repositories/media_repository.rb \
        services/monolith/workspace/spec/slices/media/use_cases/purge_account_spec.rb
git commit -s -m "feat(media): PurgeAccount deletes files by uploader_account_id

Newly-uploaded media tagged with uploader_account_id (Task 5) are
deleted on Cast hard-delete. Existing orphan rows (uploader_account_id
IS NULL) and physical object storage cleanup are deferred to a
future 'Media uploader tracking' sub-project per the spec."
```

---

### Task 9: PurgeAccount for Messaging — sender null-out + read_states cascade (TDD)

**Files:**
- Create: `services/monolith/workspace/slices/messaging/use_cases/purge_account.rb`
- Modify: `services/monolith/workspace/slices/messaging/repositories/messaging_repository.rb` (or the existing repo file; locate via `ls services/monolith/workspace/slices/messaging/repositories/`)
- Create: `services/monolith/workspace/spec/slices/messaging/use_cases/purge_account_spec.rb`

**Interfaces:**
- Consumes: Task 4 (NULLABLE sender_id / account_a / account_b)
- Produces: `Messaging::UseCases::PurgeAccount#call(account_id:)`:
  - `messaging__read_states` rows where `account_id = self` are deleted
  - `messaging__messages.sender_id = self` rows have `sender_id` SET to NULL
  - `messaging__threads.account_a = self` rows have `account_a` SET to NULL
  - `messaging__threads.account_b = self` rows have `account_b` SET to NULL

- [ ] **Step 1: Spec (RED)**

Create `services/monolith/workspace/spec/slices/messaging/use_cases/purge_account_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:messaging_repository) }

  it "deletes read_states first, then NULLs out sender_id and thread participants" do
    expect(repo).to receive(:delete_read_states_by_account).with("cast-1").ordered
    expect(repo).to receive(:null_out_sender).with("cast-1").ordered
    expect(repo).to receive(:null_out_thread_participants).with("cast-1").ordered
    use_case.call(account_id: "cast-1")
  end
end
```

- [ ] **Step 2: Add repo helpers**

Open the messaging repository file (commonly `messaging_repository.rb` — locate via `ls`) and append:

```ruby
      def delete_read_states_by_account(account_id)
        read_state_records.where(account_id: account_id).command(:delete).call
      end

      def null_out_sender(account_id)
        message_records.where(sender_id: account_id).dataset.update(sender_id: nil)
      end

      def null_out_thread_participants(account_id)
        thread_records.where(account_a: account_id).dataset.update(account_a: nil)
        thread_records.where(account_b: account_id).dataset.update(account_b: nil)
      end
```

(The relation aliases — `read_state_records`, `message_records`, `thread_records` — match the slice's existing convention; reuse whatever the existing methods reference.)

- [ ] **Step 3: Implement Messaging::UseCases::PurgeAccount**

Create `services/monolith/workspace/slices/messaging/use_cases/purge_account.rb`:

```ruby
# frozen_string_literal: true

module Messaging
  module UseCases
    class PurgeAccount
      include Messaging::Deps[repo: "repositories.messaging_repository"]

      def call(account_id:)
        repo.delete_read_states_by_account(account_id)
        repo.null_out_sender(account_id)
        repo.null_out_thread_participants(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 4: Run spec + messaging baseline**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/messaging spec/slices/identity 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add services/monolith/workspace/slices/messaging/use_cases/purge_account.rb \
        services/monolith/workspace/slices/messaging/repositories/messaging_repository.rb \
        services/monolith/workspace/spec/slices/messaging/use_cases/purge_account_spec.rb
git commit -s -m "feat(messaging): PurgeAccount null-outs sender/participants, cascades read_states

Preserves the remaining participant's conversation history while
removing the deactivated Cast's identity from the thread. read_states
is composite-PK so deletion is the only correct operation."
```

---

### Task 10: identity `PurgeIdentity` + `PurgeDeactivatedAccounts` orchestrator + rake task (TDD)

**Files:**
- Create: `services/monolith/workspace/slices/identity/use_cases/user/purge_identity.rb`
- Create: `services/monolith/workspace/slices/identity/use_cases/user/purge_deactivated_accounts.rb`
- Create: `services/monolith/workspace/lib/tasks/account.rake`
- Modify: `services/monolith/workspace/slices/identity/repositories/user_repository.rb` (add `delete` and `delete_refresh_tokens / sms_verifications` helpers — or call the existing record-level deletes)
- Modify: `services/monolith/workspace/slices/identity/repositories/refresh_token_repository.rb` (add `delete_by_user_id`)
- Modify: `services/monolith/workspace/slices/identity/repositories/sms_verification_repository.rb` (add `delete_by_phone_number`)
- Create: `services/monolith/workspace/spec/slices/identity/use_cases/user/purge_identity_spec.rb`
- Create: `services/monolith/workspace/spec/slices/identity/use_cases/user/purge_deactivated_accounts_spec.rb`

**Interfaces:**
- Consumes: Tasks 6 / 7 / 8 / 9 (every slice's `PurgeAccount`), plus `UserRepository#list_deactivated_before` from Task 1.
- Produces:
  - `Identity::UseCases::User::PurgeIdentity#call(account_id:)` — deletes `refresh_tokens`, `sms_verifications` (by the user's phone number), then the `users` row itself. Idempotent.
  - `Identity::UseCases::User::PurgeDeactivatedAccounts#call(now:)` — for every user with `deactivated_at < (now - 30.days)`, calls each slice's `PurgeAccount` in the spec's order, then `PurgeIdentity`. A per-user failure is logged and the orchestrator continues to the next user.
  - rake task `account:purge_deactivated` invokes `PurgeDeactivatedAccounts.call(now: Time.now)`.

- [ ] **Step 1: Add `delete_by_user_id` to RefreshTokenRepository**

Append to `services/monolith/workspace/slices/identity/repositories/refresh_token_repository.rb`:

```ruby
      def delete_by_user_id(user_id)
        refresh_tokens.where(user_id: user_id).command(:delete).call
      end
```

- [ ] **Step 2: Add `delete_by_phone_number` to SmsVerificationRepository**

Append to `services/monolith/workspace/slices/identity/repositories/sms_verification_repository.rb`:

```ruby
      def delete_by_phone_number(phone_number)
        sms_verifications.where(phone_number: phone_number).command(:delete).call
      end
```

- [ ] **Step 3: Add `delete` to UserRepository**

Append to `services/monolith/workspace/slices/identity/repositories/user_repository.rb`:

```ruby
      def delete(user_id)
        users.where(id: user_id).command(:delete).call
      end
```

- [ ] **Step 4: PurgeIdentity spec (RED)**

Create `services/monolith/workspace/spec/slices/identity/use_cases/user/purge_identity_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::User::PurgeIdentity do
  let(:use_case) do
    described_class.new(
      user_repo: user_repo,
      refresh_repo: refresh_repo,
      verification_repo: verification_repo
    )
  end
  let(:user_repo) { double(:user_repository) }
  let(:refresh_repo) { double(:refresh_token_repository) }
  let(:verification_repo) { double(:sms_verification_repository) }
  let(:account_id) { "cast-1" }

  it "deletes refresh tokens, sms verifications (by phone), then the user row" do
    allow(user_repo).to receive(:find_by_id).with(account_id).and_return(
      double(:user, id: account_id, phone_number: "+819000000000")
    )
    expect(refresh_repo).to receive(:delete_by_user_id).with(account_id).ordered
    expect(verification_repo).to receive(:delete_by_phone_number).with("+819000000000").ordered
    expect(user_repo).to receive(:delete).with(account_id).ordered

    use_case.call(account_id: account_id)
  end

  it "is no-op when the user is already gone (idempotent)" do
    allow(user_repo).to receive(:find_by_id).with(account_id).and_return(nil)
    expect(refresh_repo).not_to receive(:delete_by_user_id)
    expect(verification_repo).not_to receive(:delete_by_phone_number)
    expect(user_repo).not_to receive(:delete)
    expect { use_case.call(account_id: account_id) }.not_to raise_error
  end
end
```

- [ ] **Step 5: Implement PurgeIdentity**

Create `services/monolith/workspace/slices/identity/use_cases/user/purge_identity.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module User
      class PurgeIdentity
        include Identity::Deps[
          user_repo: "repositories.user_repository",
          refresh_repo: "repositories.refresh_token_repository",
          verification_repo: "repositories.sms_verification_repository"
        ]

        def call(account_id:)
          user = user_repo.find_by_id(account_id)
          return nil unless user

          refresh_repo.delete_by_user_id(account_id)
          verification_repo.delete_by_phone_number(user.phone_number)
          user_repo.delete(account_id)
          nil
        end
      end
    end
  end
end
```

- [ ] **Step 6: Run PurgeIdentity spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/user/purge_identity_spec.rb 2>&1 | tail -5
```

Expected: `2 examples, 0 failures`.

- [ ] **Step 7: PurgeDeactivatedAccounts spec (RED)**

Create `services/monolith/workspace/spec/slices/identity/use_cases/user/purge_deactivated_accounts_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::User::PurgeDeactivatedAccounts do
  let(:use_case) do
    described_class.new(
      user_repo: user_repo,
      purge_notifications: purge_notifications,
      purge_footprints: purge_footprints,
      purge_bookmarks: purge_bookmarks,
      purge_karte: purge_karte,
      purge_messaging: purge_messaging,
      purge_social: purge_social,
      purge_post: purge_post,
      purge_media: purge_media,
      purge_profile: purge_profile,
      purge_identity: purge_identity,
      logger: logger
    )
  end
  let(:user_repo) { double(:user_repository) }
  let(:purge_notifications) { double(:purge, call: nil) }
  let(:purge_footprints) { double(:purge, call: nil) }
  let(:purge_bookmarks) { double(:purge, call: nil) }
  let(:purge_karte) { double(:purge, call: nil) }
  let(:purge_messaging) { double(:purge, call: nil) }
  let(:purge_social) { double(:purge, call: nil) }
  let(:purge_post) { double(:purge, call: nil) }
  let(:purge_media) { double(:purge, call: nil) }
  let(:purge_profile) { double(:purge, call: nil) }
  let(:purge_identity) { double(:purge_identity, call: nil) }
  let(:logger) { double(:logger, info: nil, error: nil) }

  let(:now) { Time.now }

  it "calls each slice's purge in the spec's order for every eligible user" do
    user_a = double(:user, id: "user-a")
    user_b = double(:user, id: "user-b")
    allow(user_repo).to receive(:list_deactivated_before).and_return([user_a, user_b])

    [user_a, user_b].each do |u|
      expect(purge_notifications).to receive(:call).with(account_id: u.id).ordered
      expect(purge_footprints).to receive(:call).with(account_id: u.id).ordered
      expect(purge_bookmarks).to receive(:call).with(account_id: u.id).ordered
      expect(purge_karte).to receive(:call).with(account_id: u.id).ordered
      expect(purge_messaging).to receive(:call).with(account_id: u.id).ordered
      expect(purge_social).to receive(:call).with(account_id: u.id).ordered
      expect(purge_post).to receive(:call).with(account_id: u.id).ordered
      expect(purge_media).to receive(:call).with(account_id: u.id).ordered
      expect(purge_profile).to receive(:call).with(account_id: u.id).ordered
      expect(purge_identity).to receive(:call).with(account_id: u.id).ordered
    end

    use_case.call(now: now)
  end

  it "uses now - 30 days as the cutoff" do
    expect(user_repo).to receive(:list_deactivated_before).with(now - 30 * 24 * 3600).and_return([])
    use_case.call(now: now)
  end

  it "continues to the next user when one user's purge raises" do
    user_a = double(:user, id: "user-a")
    user_b = double(:user, id: "user-b")
    allow(user_repo).to receive(:list_deactivated_before).and_return([user_a, user_b])

    allow(purge_notifications).to receive(:call).with(account_id: "user-a").and_raise("boom")
    allow(logger).to receive(:error)

    expect(purge_notifications).to receive(:call).with(account_id: "user-b") # second user still attempted
    expect(logger).to receive(:error).with(/user-a/)

    expect { use_case.call(now: now) }.not_to raise_error
  end
end
```

- [ ] **Step 8: Implement PurgeDeactivatedAccounts**

Create `services/monolith/workspace/slices/identity/use_cases/user/purge_deactivated_accounts.rb`:

```ruby
# frozen_string_literal: true

module Identity
  module UseCases
    module User
      class PurgeDeactivatedAccounts
        GRACE_PERIOD_SECONDS = 30 * 24 * 3600

        include Identity::Deps[user_repo: "repositories.user_repository"]

        def initialize(
          user_repo: nil,
          purge_notifications: nil,
          purge_footprints: nil,
          purge_bookmarks: nil,
          purge_karte: nil,
          purge_messaging: nil,
          purge_social: nil,
          purge_post: nil,
          purge_media: nil,
          purge_profile: nil,
          purge_identity: nil,
          logger: nil,
          **kwargs
        )
          super(**kwargs.merge(user_repo: user_repo).compact)
          @purge_notifications = purge_notifications
          @purge_footprints = purge_footprints
          @purge_bookmarks = purge_bookmarks
          @purge_karte = purge_karte
          @purge_messaging = purge_messaging
          @purge_social = purge_social
          @purge_post = purge_post
          @purge_media = purge_media
          @purge_profile = purge_profile
          @purge_identity = purge_identity
          @logger = logger
        end

        def call(now:)
          cutoff = now - GRACE_PERIOD_SECONDS
          users = user_repo.list_deactivated_before(cutoff)

          users.each do |u|
            begin
              purge_notifications.call(account_id: u.id)
              purge_footprints.call(account_id: u.id)
              purge_bookmarks.call(account_id: u.id)
              purge_karte.call(account_id: u.id)
              purge_messaging.call(account_id: u.id)
              purge_social.call(account_id: u.id)
              purge_post.call(account_id: u.id)
              purge_media.call(account_id: u.id)
              purge_profile.call(account_id: u.id)
              purge_identity.call(account_id: u.id)
              logger&.info("[purge] account #{u.id} fully purged")
            rescue => e
              logger&.error("[purge] account #{u.id} failed: #{e.class}: #{e.message}")
            end
          end
          nil
        end

        private

        def purge_notifications
          @purge_notifications ||= ::Notifications::Slice["use_cases.purge_account"]
        end
        def purge_footprints
          @purge_footprints ||= ::Footprints::Slice["use_cases.purge_account"]
        end
        def purge_bookmarks
          @purge_bookmarks ||= ::Bookmarks::Slice["use_cases.purge_account"]
        end
        def purge_karte
          @purge_karte ||= ::Karte::Slice["use_cases.purge_account"]
        end
        def purge_messaging
          @purge_messaging ||= ::Messaging::Slice["use_cases.purge_account"]
        end
        def purge_social
          @purge_social ||= ::Social::Slice["use_cases.purge_account"]
        end
        def purge_post
          @purge_post ||= ::Post::Slice["use_cases.purge_account"]
        end
        def purge_media
          @purge_media ||= ::Media::Slice["use_cases.purge_account"]
        end
        def purge_profile
          @purge_profile ||= ::Profile::Slice["use_cases.purge_account"]
        end
        def purge_identity
          @purge_identity ||= Identity::Slice["use_cases.user.purge_identity"]
        end
      end
    end
  end
end
```

- [ ] **Step 9: Run PurgeDeactivatedAccounts spec, expect GREEN**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/user/purge_deactivated_accounts_spec.rb 2>&1 | tail -5
```

Expected: `3 examples, 0 failures`.

- [ ] **Step 10: Create the rake task**

Create `services/monolith/workspace/lib/tasks/account.rake`:

```ruby
# frozen_string_literal: true

namespace :account do
  desc "Hard-delete accounts that have been deactivated for the full grace period"
  task purge_deactivated: :environment do
    use_case = Identity::Slice["use_cases.user.purge_deactivated_accounts"]
    use_case.call(now: Time.now)
  end
end
```

- [ ] **Step 11: Boot smoke for the rake task**

```bash
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rake -T account 2>&1 | tail -5
```

Expected: `rake account:purge_deactivated  # Hard-delete accounts that have been deactivated for the full grace period`.

- [ ] **Step 12: Final backend rspec sweep**

```bash
env -u NODE_OPTIONS bundle exec rspec spec/slices 2>&1 | tail -5
```

Expected: no new failures introduced.

- [ ] **Step 13: Commit**

```bash
git add services/monolith/workspace/slices/identity/use_cases/user/purge_identity.rb \
        services/monolith/workspace/slices/identity/use_cases/user/purge_deactivated_accounts.rb \
        services/monolith/workspace/spec/slices/identity/use_cases/user/ \
        services/monolith/workspace/slices/identity/repositories/user_repository.rb \
        services/monolith/workspace/slices/identity/repositories/refresh_token_repository.rb \
        services/monolith/workspace/slices/identity/repositories/sms_verification_repository.rb \
        services/monolith/workspace/lib/tasks/account.rake
git commit -s -m "feat(identity): PurgeIdentity + PurgeDeactivatedAccounts cron orchestrator

PurgeDeactivatedAccounts walks list_deactivated_before(now - 30d),
calls each slice's PurgeAccount in spec order, then PurgeIdentity
last. Per-user failures are logged and do not block the batch.
Exposed as rake account:purge_deactivated; production cron runs
it daily."
```

---

### Task 11: frontend BFFs — `POST /api/identity/deactivate` + sign-in BFF carries `reactivated`

**Files:**
- Create: `services/frontend/workspace/src/app/api/identity/deactivate/route.ts`
- Modify: `services/frontend/workspace/src/app/api/identity/sign-in/route.ts`

**Interfaces:**
- Consumes: Task 3 (`DeactivateAccount` RPC, `LoginResponse.reactivated`)
- Produces:
  - `POST /api/identity/deactivate` invokes `identityClient.deactivateAccount({}, { headers: buildGrpcHeaders(req) })`. On success returns `{ ok: true }` (200). On `UNAUTHENTICATED` returns 401 via `handleApiError`.
  - `POST /api/identity/sign-in` response body gains `reactivated: boolean` (default false).

- [ ] **Step 1: Create the deactivate BFF**

Create `services/frontend/workspace/src/app/api/identity/deactivate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    await identityClient.deactivateAccount({}, { headers: buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeactivateAccount");
  }
}
```

- [ ] **Step 2: Carry `reactivated` from sign-in**

Open `services/frontend/workspace/src/app/api/identity/sign-in/route.ts`. Find the success branch where the JSON is returned. Add `reactivated` to the body. The exact shape depends on the existing code; the change is one field. Example mapping (adapt to the actual file's variable names):

```ts
// existing body, with the new field appended
return NextResponse.json({
  account: { /* unchanged */ },
  reactivated: !!response.reactivated,
});
```

(The Login gRPC response now has `reactivated: bool`; pass it through.)

- [ ] **Step 3: tsc + lint + build**

```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
env -u NODE_OPTIONS pnpm lint 2>&1 | tail -3
env -u NODE_OPTIONS pnpm build 2>&1 | tail -3
```

Expected: tsc no output, lint clean, build green; `/api/identity/deactivate` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/workspace/src/app/api/identity/deactivate/route.ts \
        services/frontend/workspace/src/app/api/identity/sign-in/route.ts
git commit -s -m "feat(identity): deactivate BFF + sign-in surfaces reactivated flag

The deactivate route is cookie-mediated like all post-#763 BFFs.
sign-in now forwards LoginResponse.reactivated to the client so
the UI can show 'お帰りなさい' on auto-reactivation."
```

---

### Task 12: frontend UI — Settings 退会 button + confirm modal + reactivated toast

**Files:**
- Modify: `services/frontend/workspace/src/app/settings/page.tsx`
- Modify: `services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx` (or wherever `login` is defined — the function that calls `/api/identity/sign-in`)
- Create: `services/frontend/workspace/src/modules/identity/hooks/useDeactivateAccount.ts`

**Interfaces:**
- Consumes: Task 11 BFFs (`/api/identity/deactivate`, sign-in's `reactivated`)
- Produces:
  - `useDeactivateAccount()` hook returns `{ deactivate: () => Promise<boolean>, loading, error }`. On success: clears local auth state (cookie clear + identity store) and navigates to `/`.
  - Settings page renders a destructive "アカウントを退会" button. Clicking opens a confirm dialog with the spec's wording. Confirming calls the hook.
  - On login completion (existing useAuth's login flow), if `response.reactivated === true`, show a one-shot toast/notice "お帰りなさい。アカウントは復活しました。".

- [ ] **Step 1: Read existing settings page + useAuth to match patterns**

```bash
cat services/frontend/workspace/src/app/settings/page.tsx
/usr/bin/grep -n "sign-in\|api/identity" services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx
```

- [ ] **Step 2: Create the deactivate hook**

Create `services/frontend/workspace/src/modules/identity/hooks/useDeactivateAccount.ts`:

```ts
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";

export function useDeactivateAccount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const clearIdentity = useAuthStore((s) => s.clearIdentity);

  const deactivate = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authFetch<{ ok: boolean }>("/api/identity/deactivate", {
        method: "POST",
        body: {},
      });
      // Clear local identity + cookies are server-controlled; the next
      // /api/identity/me will 401 and the shell redirect kicks in.
      clearIdentity();
      router.push("/");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to deactivate"));
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearIdentity, router]);

  return { deactivate, loading, error };
}
```

- [ ] **Step 3: Add the deactivate section to the Settings page**

Open `services/frontend/workspace/src/app/settings/page.tsx`. At the end of the page content (before the closing tag), add a new section. Pattern (adapt the JSX wrapper to the existing layout):

```tsx
"use client";

// existing imports …
import { useState } from "react";
import { useDeactivateAccount } from "@/modules/identity/hooks/useDeactivateAccount";

// inside the component:
const { deactivate, loading: deactivating, error: deactivateError } = useDeactivateAccount();
const [confirmOpen, setConfirmOpen] = useState(false);

// inside the JSX (append):
<section className="border-t border-border mt-8 pt-6 px-4">
  <h2 className="text-base font-medium text-red-600">アカウントを退会</h2>
  <p className="mt-2 text-sm text-muted-foreground">
    30 日以内に同じ電話番号で login すれば自動的に復活します。
    30 日経過後はデータが消えます。
    <span className="block mt-1">
      ※ カルテに残した記録は、他の Cast の安全情報として残ります。
    </span>
  </p>
  <button
    type="button"
    onClick={() => setConfirmOpen(true)}
    disabled={deactivating}
    className="mt-3 rounded border border-red-600 bg-bg px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
  >
    退会する
  </button>
  {deactivateError && (
    <p className="mt-2 text-sm text-red-600">{deactivateError.message}</p>
  )}
</section>
{confirmOpen && (
  <div
    role="dialog"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
  >
    <div className="w-full max-w-sm rounded bg-bg p-4 shadow-lg">
      <p className="text-sm">本当に退会しますか？</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(false)}
          className="rounded px-3 py-1 text-sm hover:bg-muted"
        >
          キャンセル
        </button>
        <button
          type="button"
          disabled={deactivating}
          onClick={async () => {
            await deactivate();
            setConfirmOpen(false);
          }}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          退会する
        </button>
      </div>
    </div>
  </div>
)}
```

(If the settings page is a server component, extract the deactivate block into a small `"use client"` subcomponent and mount it from the server page.)

- [ ] **Step 4: Add the reactivated toast in useAuth.login**

Open `services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx`. Find the `login` function. After it parses the response and BEFORE the redirect, add a guarded call:

```ts
if (data.reactivated) {
  // Lightweight UX hint; alert is enough for MVP, replace with a proper
  // toast component if the codebase has one and it's already wired.
  if (typeof window !== "undefined") {
    window.alert("お帰りなさい。アカウントは復活しました。");
  }
}
```

If a real toast hook exists in the codebase (search for it: `/usr/bin/grep -rln "useToast\|toast(" services/frontend/workspace/src | head`), use it instead of `alert`.

- [ ] **Step 5: tsc + lint + build**

```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
env -u NODE_OPTIONS pnpm lint 2>&1 | tail -3
env -u NODE_OPTIONS pnpm build 2>&1 | tail -3
```

Expected: tsc no output, lint clean, build green.

- [ ] **Step 6: Commit**

```bash
git add services/frontend/workspace/src/app/settings/page.tsx \
        services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx \
        services/frontend/workspace/src/modules/identity/hooks/useDeactivateAccount.ts
git commit -s -m "feat(identity): Settings 退会 button + confirm modal + reactivated toast

Spec-mandated wording on the confirm modal includes the explicit
note that karte entries are retained. login auto-reactivate is
surfaced as a UX hint when LoginResponse.reactivated is true."
```

---

### Task 13: frontend null fallbacks — karte author "(退会済)" + DM sender "(退会)"

**Files:**
- Modify: `services/frontend/workspace/src/modules/karte/components/KarteEntryCard.tsx`
- Modify: `services/frontend/workspace/src/modules/messaging/components/<message-bubble>.tsx` (locate via `/usr/bin/grep -rln "senderId\|sender_id" services/frontend/workspace/src/modules/messaging`)

**Interfaces:**
- Consumes: Tasks 8 (Media not relevant here) / 9 (sender_id null). Both are display-only adaptations.
- Produces: visible fallback text for nullified authors / senders.

- [ ] **Step 1: Karte author fallback**

Open `services/frontend/workspace/src/modules/karte/components/KarteEntryCard.tsx`. Locate where `entry.authorUsername` and `entry.authorAvatarUrl` are rendered. Replace any direct `entry.authorUsername` with a fallback expression. The card today shows:

```tsx
<span className="font-medium">{entry.authorUsername || "(no username)"}</span>
```

Change the fallback string to `"(退会済)"`:

```tsx
<span className="font-medium">{entry.authorUsername || "(退会済)"}</span>
```

The existing image branch already handles the empty-URL case with `bg-muted`, so the avatar fallback already works.

- [ ] **Step 2: DM message sender fallback**

Locate the message bubble / row component:

```bash
/usr/bin/find services/frontend/workspace/src/modules/messaging/components -type f
```

Open the component that renders an individual message. Find where the sender's name is referenced (likely `senderId`, `senderName`, or a profile lookup). Add a fallback when `null`:

```tsx
const senderLabel = message.senderId == null ? "(退会)" : (message.senderName ?? "");
```

Render `{senderLabel}` instead of the raw name.

If the messaging UI today only renders the message body without a sender label per bubble (because the thread already shows the participant at the top), then the change moves up to the thread header / participant header: when both `account_a` and `account_b` of a thread are not the current viewer and one of them is `null`, label that participant `"(退会)"`.

Read the existing code first; the change is one or two lines wherever the participant identity is rendered.

- [ ] **Step 3: tsc + lint + build**

```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
env -u NODE_OPTIONS pnpm lint 2>&1 | tail -3
env -u NODE_OPTIONS pnpm build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
git add services/frontend/workspace/src/modules/karte/components/KarteEntryCard.tsx \
        services/frontend/workspace/src/modules/messaging/
git commit -s -m "feat(account-durability): retire fallbacks for karte author / DM sender

After hard-delete, karte entries persist with the original author's
account_id unresolvable (Profile slice was purged) and DM messages /
threads carry NULL sender/participants. Surface a localized fallback
instead of empty UI."
```

---

### Task 14: 北極星 doc update — drop export from MVP

**Files:**
- Modify: `docs/superpowers/specs/2026-06-20-product-direction-mvp-design.md`

**Interfaces:**
- Consumes: nothing.
- Produces: 北極星 doc reflects that `audience / data export` is no longer MVP-mandatory.

- [ ] **Step 1: Edit the table row**

Open `docs/superpowers/specs/2026-06-20-product-direction-mvp-design.md`. In the table under "柱 A — 安定した集客の場（durable presence）", find the row:

```markdown
| オーディエンス / データのエクスポート（携帯性） | ✅ 必須 | 積み上げた資産を Cast が持ち出せる＝「顧客を失わない」保証 |
```

Replace with:

```markdown
| オーディエンス / データのエクスポート（携帯性） | ❌ MVP 外 | 「凍結しない」自体が顧客を失わない保証を満たすため、export は将来検討に降格（`docs/superpowers/specs/2026-06-29-account-durability-design.md` で判断） |
```

- [ ] **Step 2: Update the success criteria section**

In the "成功基準（MVP）" section, find:

```markdown
- Cast が自分のオーディエンス / データをエクスポートできる。
```

Replace with:

```markdown
- Cast が自分の意思で退会でき、30 日以内なら復活できる（**export は MVP 外に降格**、`docs/superpowers/specs/2026-06-29-account-durability-design.md` 参照）。
```

- [ ] **Step 3: Update the sub-project list**

In "## 分解（sub-projects）" table, find the row for `Account durability + audience/data export`. Update its scope:

```markdown
| 3 | Account durability + self deactivation | ✅ 完了予定（本 PR） | 凍結しない方針の product 化 + 本人退会（2-stage soft → hard）。export は MVP 外。`docs/superpowers/specs/2026-06-29-account-durability-design.md` |
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-20-product-direction-mvp-design.md
git commit -s -m "docs(direction): drop export from MVP, point at account-durability spec

The account-durability sub-project judged 'export' redundant given
'凍結しない' already covers customer retention. Updates 柱 A table,
success criteria, and the sub-project decomposition row."
```

---

### Task 15: push + ready the PR

- [ ] **Step 1: Switch remote to ssh and push the full branch**

```bash
git -C /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-account-durability remote set-url origin git@github.com:panicboat/monorepo.git
git -C /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-account-durability push
```

- [ ] **Step 2: Move PR #766 from Draft to Ready, update title**

```bash
gh pr ready 766 -R panicboat/monorepo
gh pr edit 766 -R panicboat/monorepo --title "feat(account-durability): self deactivation + 30-day grace + cron hard-delete"
```

Final whole-branch review is handled by the controller (subagent-driven-development's terminal step).

---

## Self-review

I reviewed the spec against the plan with fresh eyes.

**Spec coverage:**

- ✓ "Concept" (no admin destroy is de-facto realized + retain that state) → Task 14 + Invariants in spec (no code task needed since codebase has zero admin destroy)
- ✓ Decisions — export deferred → Task 14
- ✓ Decisions — 2-stage soft→hard → Tasks 1, 2, 3, 10
- ✓ Decisions — 30-day grace → Task 10 `GRACE_PERIOD_SECONDS`
- ✓ Decisions — admin override = none → satisfied by absence; Task 10 only orchestrates user-initiated trigger
- ✓ Decisions — Login auto-reactivate → Task 2 Step 7
- ✓ Decisions — cascade range with karte retained → Task 6 (karte) + Task 7/8/9
- ✓ Decisions — messaging sender null → Tasks 4, 9
- ✓ Decisions — media uploader_account_id NULLABLE → Tasks 5, 8
- ✓ Decisions — application-level cascade → Tasks 6/7/8/9/10
- ✓ Decisions — rake task → Task 10 Step 10
- ✓ Frontend UI → Tasks 11, 12, 13
- ✓ Invariants — Task 14 (北極星 doc carries the long-term contract)

**Placeholder scan:**

- Step 1 of Task 5 ("inspect existing media use_cases to find the file-creation entry point") is exploratory — the subagent is told to read the actual file before editing. This is intentional because the media slice's use_case naming may differ from what I assume; the alternative (writing the wrong name into the plan) is worse. The same applies to Steps 1, 2 of Tasks 9 and 13 where I direct the subagent to inspect the existing file. Acceptable.
- The repository alias names (`profiles`, `profile_areas`, `follows`, etc.) are assumed from existing relation `as:` clauses observed during grounding. If a slice uses different reader names, the subagent must adapt one-for-one. This is called out in each repo-helper step ("If the actual relation reader names differ ...").

**Type consistency:**

- Use case method signatures: every `PurgeAccount#call(account_id:)` keyword-only. `PurgeIdentity#call(account_id:)` likewise. `PurgeDeactivatedAccounts#call(now:)` keyword-only. `DeactivateAccount#call(viewer_account_id:)`.
- Container keys: `<Slice>::Slice["use_cases.purge_account"]` consistent in Tasks 6/7/8/9 (registrations) and Task 10 (consumer).
- `GRACE_PERIOD_SECONDS` defined in Task 10 only; nothing else references it.
- `reactivated` boolean key in Login result → presenter → proto consistent across Tasks 2/3/11/12.
- `Identity::UseCases::Auth::DeactivateAccount::DeactivationError` referenced consistently across Task 2 (definition + spec) and Task 3 (handler rescue).
- Repository helper signatures (`delete_by_account`, `delete_by_uploader`, `delete_by_author`, `delete_by_phone_number`, `delete_by_user_id`, `delete_read_states_by_account`, `null_out_sender`, `null_out_thread_participants`) match between the repo-add step, the use_case implementation, and the spec mocks.

No issues to fix.
