# Suggested Users (おすすめユーザー pane) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `SuggestUsers` RPC to `discovery.v1` returning newest-first profiles of the viewer's opposite role (cast↔guest), and render them in a desktop right-column "おすすめユーザー" pane.

**Architecture:** `SuggestUsers` mirrors the existing `SearchUsers` cross-slice orchestrator: a new `ProfileRepository#list_recent` supplies newest-first rows (role-filtered + exclusion-filtered), the `Discovery::UseCases::SuggestUsers` use_case builds the exclusion set from Social (follow/block) and derives the opposite role from Identity, then hydrates via `Profile::Slice["use_cases.get_profile"]`. The frontend adds a BFF route, an SWR hook, and a `SuggestedUsersPane` slotted into `AppShell` at the `xl:` breakpoint.

**Tech Stack:** Hanami 2.3 / ROM-SQL / Gruf gRPC / RSpec (monolith); buf + grpc-tools + protoc-gen-es (proto); Next.js App Router / connect-es / SWR (frontend).

**Spec:** `docs/superpowers/specs/2026-06-19-suggested-users-design.md`

**Verification conventions:**
- monolith: `env -u NODE_OPTIONS bundle exec rspec <path>` (DB-backed integration specs)
- proto: `./bin/codegen` from repo root (regenerates Ruby + TS stubs)
- frontend: `env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit` + `pnpm build` + `pnpm lint` (no component unit-test harness; tsc/build/lint is the gate)
- Shell note: bare `find`/`grep` are shadowed in this environment — use `/usr/bin/find` and `/usr/bin/grep`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `proto/discovery/v1/discovery_service.proto` | `SuggestUsers` RPC + req/res messages | Modify |
| `services/monolith/workspace/slices/profile/repositories/profile_repository.rb` | `list_recent` query method | Modify |
| `services/monolith/workspace/slices/discovery/use_cases/suggest_users.rb` | orchestration: exclusions + opposite role + hydration | Create |
| `services/monolith/workspace/slices/discovery/grpc/discovery_handler.rb` | `SuggestUsers` RPC binding + handler method | Modify |
| `services/monolith/workspace/spec/slices/discovery/use_cases/suggest_users_spec.rb` | DB-backed use_case spec | Create |
| `services/frontend/workspace/src/app/api/discovery/suggested-users/route.ts` | BFF GET → `discoveryClient.suggestUsers` | Create |
| `services/frontend/workspace/src/modules/discovery/hooks/useSuggestedUsers.ts` | SWR single-page hook | Create |
| `services/frontend/workspace/src/modules/discovery/hooks/index.ts` | export the hook | Modify |
| `services/frontend/workspace/src/components/shell/SuggestedUsersPane.tsx` | right-column pane UI | Create |
| `services/frontend/workspace/src/components/shell/AppShell.tsx` | slot pane into right column at `xl:` | Modify |

---

## Task 1: Proto — add SuggestUsers RPC

**Files:**
- Modify: `proto/discovery/v1/discovery_service.proto`

- [ ] **Step 1: Add the RPC to the service block**

In `proto/discovery/v1/discovery_service.proto`, add the RPC after `RankPosts`:

```proto
service DiscoveryService {
  rpc SearchUsers(SearchUsersRequest) returns (SearchUsersResponse);
  rpc SearchPosts(SearchPostsRequest) returns (SearchPostsResponse);
  rpc RankPosts(RankPostsRequest) returns (RankPostsResponse);
  rpc SuggestUsers(SuggestUsersRequest) returns (SuggestUsersResponse);
}
```

- [ ] **Step 2: Add the request/response messages**

Append at the end of the file (after `RankPostsResponse`):

```proto
message SuggestUsersRequest {
  int32 limit = 1;     // default 10, max 50
  string cursor = 2;   // base64 (created_at, account_id)
}

message SuggestUsersResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

- [ ] **Step 3: Regenerate stubs**

Run from repo root: `./bin/codegen`
Expected: `[codegen] done.` with no errors. Ruby stub `services/monolith/workspace/stubs/discovery/v1/...` and TS stub `services/frontend/workspace/src/stub/discovery/v1/discovery_service_pb.ts` both updated to include `SuggestUsers`.

- [ ] **Step 4: Verify the new symbols exist**

Run: `/usr/bin/grep -rn "SuggestUsers" services/monolith/workspace/stubs/discovery services/frontend/workspace/src/stub/discovery`
Expected: matches in both Ruby and TS stubs.

- [ ] **Step 5: Commit**

```bash
git add proto/discovery/v1/discovery_service.proto services/monolith/workspace/stubs/discovery services/frontend/workspace/src/stub/discovery
git commit -s -m "feat(proto): add discovery SuggestUsers RPC"
```

---

## Task 2: Monolith — list_recent repo method + SuggestUsers use_case (TDD)

**Files:**
- Create: `services/monolith/workspace/spec/slices/discovery/use_cases/suggest_users_spec.rb`
- Modify: `services/monolith/workspace/slices/profile/repositories/profile_repository.rb`
- Create: `services/monolith/workspace/slices/discovery/use_cases/suggest_users.rb`

- [ ] **Step 1: Write the failing spec**

Create `services/monolith/workspace/spec/slices/discovery/use_cases/suggest_users_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Discovery::UseCases::SuggestUsers do
  subject(:use_case) { Discovery::Slice["use_cases.suggest_users"] }

  let(:users) { Identity::Slice["relations.users"] }
  let(:follows) { Social::Slice["relations.follows"] }
  let(:blocks) { Social::Slice["relations.blocks"] }
  let(:profile_repo) { Profile::Slice["repositories.profile_repository"] }

  # identity.users.role: 1 = guest, 2 = cast. Raw insert so we control the id
  # (profiles.account_id == users.id) and the role.
  def insert_user(role:)
    id = SecureRandom.uuid_v7
    users.dataset.insert(
      id: id,
      phone_number: "0#{rand(10**10)}",
      password_digest: "x",
      role: role,
      created_at: Time.now,
      updated_at: Time.now
    )
    id
  end

  # Creates a user + a profile. profile_repo.create relies on DB defaults for
  # sns_links / is_private (created_at defaults to now()).
  def make(role:, display_name:)
    id = insert_user(role: role)
    profile_repo.create(account_id: id, display_name: display_name, username: "u_#{id[0, 8]}")
    id
  end

  it "returns the opposite role of the viewer (cast viewer → guests)" do
    viewer = insert_user(role: 2) # cast
    guest = make(role: 1, display_name: "G")
    other_cast = make(role: 2, display_name: "C")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids).to include(guest)
    expect(ids).not_to include(other_cast)
  end

  it "returns the opposite role of the viewer (guest viewer → casts)" do
    viewer = insert_user(role: 1) # guest
    cast = make(role: 2, display_name: "C")
    other_guest = make(role: 1, display_name: "G")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids).to include(cast)
    expect(ids).not_to include(other_guest)
  end

  it "excludes self, already-following, and bidirectionally-blocked accounts" do
    viewer = insert_user(role: 2) # cast
    followed = make(role: 1, display_name: "F")
    blocked = make(role: 1, display_name: "B")
    visible = make(role: 1, display_name: "V")

    follows.dataset.insert(
      id: SecureRandom.uuid_v7,
      follower_id: viewer, followee_id: followed, status: "approved",
      created_at: Time.now, updated_at: Time.now
    )
    blocks.dataset.insert(
      id: SecureRandom.uuid_v7,
      blocker_id: blocked, blocked_id: viewer, created_at: Time.now
    )

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids).to include(visible)
    expect(ids).not_to include(followed)
    expect(ids).not_to include(blocked)
    expect(ids).not_to include(viewer)
  end

  it "orders newest-first" do
    viewer = insert_user(role: 2) # cast
    older = make(role: 1, display_name: "old")
    sleep 0.05
    newer = make(role: 1, display_name: "new")

    ids = use_case.call(viewer_account_id: viewer, limit: 10)[:profiles].map(&:account_id)

    expect(ids.index(newer)).to be < ids.index(older)
  end
end
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/discovery/use_cases/suggest_users_spec.rb`
Expected: FAIL — `Discovery::Slice["use_cases.suggest_users"]` cannot be resolved (use_case does not exist yet).

- [ ] **Step 3: Add `list_recent` to ProfileRepository**

In `services/monolith/workspace/slices/profile/repositories/profile_repository.rb`, add after `search_by_query` (inside the class, alongside the other public methods):

```ruby
# Newest-first profiles for the suggested-users feature.
# role_filter: nil = no filter, 1 = guest only, 2 = cast only (subquery against identity.users).
# exclude_account_ids: viewer self + already-following + bidirectionally-blocked.
# Cursor pagination over (created_at, account_id) — same shape as search_by_query.
def list_recent(limit:, cursor: nil, exclude_account_ids: [], role_filter: nil)
  scope = profiles
  scope = scope.exclude(account_id: exclude_account_ids) unless exclude_account_ids.empty?

  if role_filter && [1, 2].include?(role_filter)
    scope = scope.where(
      account_id: profiles.dataset.db[:identity__users].where(role: role_filter).select(:id)
    )
  end

  if cursor
    decoded = decode_cursor(cursor)
    if decoded
      scope = scope.where {
        (created_at < decoded[:created_at]) |
          ((created_at =~ decoded[:created_at]) & (account_id < decoded[:id]))
      }
    end
  end

  scope.order { [created_at.desc, account_id.desc] }.limit(limit + 1).to_a
end
```

NOTE: `decode_cursor` is provided by the repository's existing cursor helper (used by `search_by_query`). If `search_by_query` resolves `decode_cursor`, `list_recent` resolves it the same way — do not add a new include.

- [ ] **Step 4: Create the SuggestUsers use_case**

Create `services/monolith/workspace/slices/discovery/use_cases/suggest_users.rb`:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    # Suggests newest-first profiles of the viewer's opposite role (cast↔guest),
    # excluding self / approved-following / bidirectionally-blocked accounts.
    # Mirrors SearchUsers: Profile repo supplies rows, get_profile hydrates them.
    class SuggestUsers
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50

      # identity.users.role: 1 = guest, 2 = cast. Suggest the opposite role.
      OPPOSITE_ROLE = { 1 => 2, 2 => 1 }.freeze

      def call(viewer_account_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        role_filter = OPPOSITE_ROLE[viewer_role(viewer_account_id)]
        exclude_ids = exclusion_ids(viewer_account_id)

        rows = profile_repo.list_recent(
          limit: limit,
          cursor: cursor,
          exclude_account_ids: exclude_ids,
          role_filter: role_filter
        )

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.account_id)
        end

        profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.account_id) }

        { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
      end

      private

      def exclusion_ids(viewer_account_id)
        following = follow_repo.following_account_ids(account_id: viewer_account_id)
        blocked = block_repo.bidirectionally_blocked_ids(account_id: viewer_account_id)
        ([viewer_account_id] + following + blocked).uniq
      end

      def viewer_role(viewer_account_id)
        user_repo.find_by_id(viewer_account_id)&.role
      end

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def user_repo
        @user_repo ||= Identity::Slice["repositories.user_repository"]
      end
    end
  end
end
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/discovery/use_cases/suggest_users_spec.rb`
Expected: PASS (4 examples, 0 failures).

If `decode_cursor` raises a `NoMethodError` in `list_recent`, check how `search_by_query` obtains it (same file) and match that mechanism exactly.

- [ ] **Step 6: Commit**

```bash
git add services/monolith/workspace/slices/profile/repositories/profile_repository.rb \
        services/monolith/workspace/slices/discovery/use_cases/suggest_users.rb \
        services/monolith/workspace/spec/slices/discovery/use_cases/suggest_users_spec.rb
git commit -s -m "feat(discovery): SuggestUsers use_case + ProfileRepository#list_recent"
```

---

## Task 3: Monolith — wire SuggestUsers into the gRPC handler

**Files:**
- Modify: `services/monolith/workspace/slices/discovery/grpc/discovery_handler.rb`

- [ ] **Step 1: Register the RPC and inject the use_case**

In `services/monolith/workspace/slices/discovery/grpc/discovery_handler.rb`, add the `rpc` line after the `RankPosts` rpc line:

```ruby
rpc :RankPosts, ::Discovery::V1::RankPostsRequest, ::Discovery::V1::RankPostsResponse
rpc :SuggestUsers, ::Discovery::V1::SuggestUsersRequest, ::Discovery::V1::SuggestUsersResponse
```

And add `suggest_users_uc` to the `include Discovery::Deps[...]` block:

```ruby
include Discovery::Deps[
  search_users_uc: "use_cases.search_users",
  search_posts_uc: "use_cases.search_posts",
  rank_posts_uc: "use_cases.rank_posts",
  suggest_users_uc: "use_cases.suggest_users"
]
```

- [ ] **Step 2: Add the handler method**

Add a `suggest_users` method (place it after `search_users`, mirroring its shape):

```ruby
def suggest_users
  authenticate_user!
  limit = request.message.limit.zero? ? 10 : request.message.limit
  cursor = request.message.cursor.empty? ? nil : request.message.cursor

  result = suggest_users_uc.call(
    viewer_account_id: current_user_id,
    limit: limit,
    cursor: cursor
  )
  ::Discovery::V1::SuggestUsersResponse.new(
    profiles: result[:profiles],
    next_cursor: result[:next_cursor] || "",
    has_more: result[:has_more]
  )
end
```

- [ ] **Step 3: Verify the slice boots and the existing discovery specs still pass**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/discovery`
Expected: PASS (the use_case spec from Task 2 still passes; no boot/load errors from the handler change).

- [ ] **Step 4: Commit**

```bash
git add services/monolith/workspace/slices/discovery/grpc/discovery_handler.rb
git commit -s -m "feat(discovery): bind SuggestUsers RPC in discovery handler"
```

---

## Task 4: Frontend — BFF route + SWR hook

**Files:**
- Create: `services/frontend/workspace/src/app/api/discovery/suggested-users/route.ts`
- Create: `services/frontend/workspace/src/modules/discovery/hooks/useSuggestedUsers.ts`
- Modify: `services/frontend/workspace/src/modules/discovery/hooks/index.ts`

- [ ] **Step 1: Create the BFF route**

Create `services/frontend/workspace/src/app/api/discovery/suggested-users/route.ts` (mirrors `api/discovery/users/route.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { discoveryClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "10");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const res = await discoveryClient.suggestUsers({ limit, cursor }, { headers });
    return NextResponse.json({
      profiles: (res.profiles || []).map(profileToSocialAccount),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "SuggestUsers");
  }
}
```

- [ ] **Step 2: Create the hook**

Create `services/frontend/workspace/src/modules/discovery/hooks/useSuggestedUsers.ts`:

```ts
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedUsersResponse } from "../types";

export function useSuggestedUsers(limit = 10) {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PaginatedUsersResponse>(
    token ? `/api/discovery/suggested-users?limit=${limit}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    profiles: data?.profiles ?? [],
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

- [ ] **Step 3: Export the hook**

In `services/frontend/workspace/src/modules/discovery/hooks/index.ts`, add the export alongside the existing ones:

```ts
export { useSuggestedUsers } from "./useSuggestedUsers";
```

(Confirm the existing export style in that file and match it — named re-export.)

- [ ] **Step 4: Verify types compile**

Run: `cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit`
Expected: no errors. (Confirms `discoveryClient.suggestUsers` exists from the regenerated stub and `PaginatedUsersResponse` matches.)

- [ ] **Step 5: Commit**

```bash
git add services/frontend/workspace/src/app/api/discovery/suggested-users/route.ts \
        services/frontend/workspace/src/modules/discovery/hooks/useSuggestedUsers.ts \
        services/frontend/workspace/src/modules/discovery/hooks/index.ts
git commit -s -m "feat(frontend): suggested-users BFF route + useSuggestedUsers hook"
```

---

## Task 5: Frontend — SuggestedUsersPane + AppShell wiring

**Files:**
- Create: `services/frontend/workspace/src/components/shell/SuggestedUsersPane.tsx`
- Modify: `services/frontend/workspace/src/components/shell/AppShell.tsx`

- [ ] **Step 1: Create the pane component**

Create `services/frontend/workspace/src/components/shell/SuggestedUsersPane.tsx` (user-row pattern from `src/app/search/page.tsx`):

```tsx
"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/modules/social";
import { useSuggestedUsers } from "@/modules/discovery/hooks";

export function SuggestedUsersPane() {
  const { profiles, loading } = useSuggestedUsers(10);

  // Hide the pane entirely when there is nothing to suggest.
  if (!loading && profiles.length === 0) return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto px-4 py-4 xl:block">
      <h2 className="px-2 pb-2 text-base font-bold text-text-primary">おすすめユーザー</h2>
      <div className="rounded-2xl bg-surface">
        {loading && profiles.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-secondary">読み込み中…</p>
        )}
        {profiles.map((p) => (
          <div key={p.accountId} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/u/${encodeURIComponent(p.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary">{p.displayName}</p>
                <p className="truncate text-xs text-text-secondary">@{p.username}</p>
              </div>
            </Link>
            <FollowButton targetAccountId={p.accountId} />
          </div>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Slot the pane into AppShell**

In `services/frontend/workspace/src/components/shell/AppShell.tsx`:

Add the import after the `SideNav` import:

```ts
import { SideNav } from "./SideNav";
import { SuggestedUsersPane } from "./SuggestedUsersPane";
```

Replace the reserved-space comment + the existing 3-col `<div>` block:

```tsx
      {/* Desktop: persistent left nav + center column. The space to the right of
          the center column is reserved for the おすすめユーザー pane (Phase 1b-B PR2). */}
      <div className="mx-auto flex w-full max-w-screen-xl">
        <SideNav />
        <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
          {children}
        </main>
      </div>
```

with:

```tsx
      {/* Desktop 3-col: persistent left nav + center column + おすすめユーザー pane (xl:). */}
      <div className="mx-auto flex w-full max-w-screen-xl">
        <SideNav />
        <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
          {children}
        </main>
        <SuggestedUsersPane />
      </div>
```

- [ ] **Step 3: Verify tsc, lint, and build**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint `0 errors / 0 warnings`; build `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/workspace/src/components/shell/SuggestedUsersPane.tsx \
        services/frontend/workspace/src/components/shell/AppShell.tsx
git commit -s -m "feat(frontend): おすすめユーザー pane in AppShell right column (xl:)"
```

---

## Task 6: Update session handoff doc

**Files:**
- Modify: `docs/superpowers/2026-06-18-session-handoff.md`

- [ ] **Step 1: Mark Phase 1b-B complete**

In `docs/superpowers/2026-06-18-session-handoff.md`:
- Section 1 "Current state": change Phase 1b-B line to `✅` (PR1 + PR2 完了).
- Section 2 roadmap table Phase 1b-B row: status → `✅`, drop the "右 pane は PR2 (未着手)" note.
- Section 4 "Session 2026-06-19" table: change the Phase 1b-B PR1 row state and add a row for this PR2 (`SuggestUsers` + おすすめユーザー pane).
- Section 5 A: mark the Phase 1b-B row done; update "残 backlog" to drop Phase 1b-B PR2.

Make the edits consistent with the surrounding table styles (match column counts and `✅`/`🔄` markers already in use).

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/2026-06-18-session-handoff.md
git commit -s -m "docs: mark Phase 1b-B complete in session handoff"
```

---

## Final verification (before PR)

- [ ] monolith discovery specs pass: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/discovery`
- [ ] proto stubs in sync: `./bin/codegen` produces no diff (re-run; `git status` clean)
- [ ] frontend gate: `cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit && env -u NODE_OPTIONS pnpm lint && env -u NODE_OPTIONS pnpm build` (tsc clean, 0e/0w, build ok)
- [ ] Push branch, open Draft PR (conventional title), `gh pr ready`, `gh pr merge --squash --delete-branch --auto`

**Success criteria (from spec):**
- viewer=cast sees only guests; viewer=guest sees only casts
- self / approved-following / bidirectionally-blocked excluded
- newest-first ordering
- right pane renders at `xl:`+, hidden below `xl:`
