# Unify the cast profile data model (`profile.casts` vs `profile.profiles`)

Issue: [#1181](https://github.com/panicboat/monorepo/issues/1181) — 新旧2つの cast データモデルが並存している

## Problem

`dystopia/monolith`'s `profile` schema has two tables that both hold cast
profile data:

- `profile.casts` — created 2026-01-17, cast-only.
- `profile.profiles` — created 2026-06-04, role-agnostic (cast + guest),
  keyed by `account_id` (same UUID space as `casts.user_id` —
  `identity.accounts.id`).

They overlap semantically on: display name, bio, avatar/cover media,
age, SNS links, three-sizes/body-stats, "handle" (slug vs username),
registered-at, and area selection. PR #1182 (2026-09-19, closed #1166)
extended `profiles` with `body_stats`/`sns_links` but did not touch
`casts`, which is what surfaced this issue.

Two concretely broken behaviors result from the split, found by reading
every live caller of each table (see Evidence):

1. **Post authors vs comment authors disagree.** `post_handler.rb`
   resolves post authors through `ProfileAuthorAdapter` (`profiles`).
   `comment_handler.rb`'s `get_comment_author` (defined on the shared
   `Post::Grpc::Handler` base class) still resolves through the old
   `CastAdapter`/`GuestAdapter` (`casts`/`guests`). A user who edits
   their display name or avatar in Settings sees it on their posts but
   not on their comments.
2. **Area-based discovery ignores the area a cast actually set.**
   `AreaSettings.tsx` saves through the generic `SaveProfile` RPC, which
   writes `profile.profile_areas`. Cast discovery-by-prefecture
   (`Profile::UseCases::Cast::Queries::GetPublicCastIdsInPrefecture`)
   reads `profile.cast_areas` instead. Setting an area in Settings has
   no effect on area-filtered cast discovery.

## Evidence: live vs. dead code on `casts`

Traced every caller of `Profile::Repositories::CastRepository` across
the monolith by grep (static, not runtime tracing — REASONED, not yet
VERIFIED by running the suite; re-confirm with `bundle exec rspec`
during implementation before deleting anything).

**Live** (called from a real request path):
- `save_visibility` — via `Profile::UseCases::SaveCastVisibility`.
- `find_by_ids` / `find_by_user_ids` — via
  `Profile::UseCases::Cast::Queries::{GetByIds,GetByUserIds}`, consumed
  by `Post::Adapters::CastAdapter` for `visibility`/existence checks and
  (currently) `name`/`avatar_media_id`/`profile_media_id`/`slug` display
  fields.
- `public_cast_ids`, `area_ids_by_prefecture`,
  `cast_user_ids_by_area_ids` — via
  `Profile::UseCases::Cast::Queries::{GetPublicCastIds,GetPublicCastIdsInPrefecture}`.
- `cast_genres`/`cast_gallery_media` relations — genuinely cast-only
  concepts with no `profiles` equivalent, still read/written by their
  respective use cases. (`cast_areas` is technically "live" via the
  grep above too, but only feeds the area-discovery bug described
  above — see Target design for why it's retired anyway.)

**Dead** (defined, zero callers found anywhere in `dystopia/monolith`
outside their own spec files):
- `Profile::Contracts::Cast::SaveProfileContract` (the entire cast-specific
  save-profile validation, including `name`/`bio`/`slug`/`tagline`/
  `social_links`/`age`/`height`/`blood_type`/`three_sizes`/`tags`/
  `default_schedules` rules).
- `CastRepository#find_by_slug`, `#slug_available?`, `#get_popular_tags`,
  `#complete_registration`, `#save_images`, `#find_with_plans`,
  `#find_by_user_id_with_plans`, `#find_gallery_media_ids`,
  `#private_cast_ids`. Lowest-confidence one: `#find_gallery_media_ids`
  — gallery media display is a live feature, so re-verify there isn't a
  caller this grep missed before deleting it (see Open Questions).
- `Post::Grpc::Handler#load_authors`, `#find_my_cast!`.
- **`casts.default_schedules`** — despite looking cast-specific and
  "obviously needed," it is referenced only in the relation schema and
  in the dead `Cast::SaveProfileContract`'s validation rule; no
  presenter, handler, or use case reads or writes it, and the live
  Schedule feature (`schedule_handler.rb`'s `SaveSchedule`/
  `ListSchedules`/`DeleteSchedule`, backed by the `offer` schema) has no
  coupling to it at all. Caught mid-spec by asking "is this actually
  needed?" — a reminder that "looks cast-specific" isn't the same as
  "is live"; every column here was re-checked for callers, not
  eyeballed. It is dropped, not retained.

Practical implication: no live code path can currently create a new
non-null value for `casts.name`, `tagline`, `social_links`, `age`,
`height`, `blood_type`, `three_sizes`, `tags`, `slug`,
`profile_media_id`, `avatar_media_id`, `registered_at`, or
`default_schedules`. Any existing values are frozen leftovers. This
makes the migration materially safer than "two actively-competing
writers" would be — it's closer to "retire an abandoned copy," but we
still back-fill once in case any row has data `profiles` doesn't (see
Migration).

## Target design

**`profile.profiles`** becomes the single source for all display /
identity-level fields, for every role: `display_name`, `username`,
`bio`, `avatar_media_id`, `cover_media_id`, `age`, `sns_links`,
`body_stats`, `prefecture`, `is_private`, `registered_at`, `website`,
`industry`, plus area selection via `profile_areas`.

**`profile.casts`** shrinks to cast-only business data with no
`profiles` equivalent: `user_id` (PK, = `profiles.account_id`),
`visibility`, `created_at`, `updated_at`. Its associations
`cast_genres` and `cast_gallery_media` are unchanged. `cast_areas` is
retired (see below).

**Dropped entirely** (dead code + dead columns, removed together):
`casts.name`, `tagline`, `social_links`, `age`, `height`, `blood_type`,
`three_sizes`, `tags`, `slug`, `profile_media_id`, `avatar_media_id`,
`registered_at`, `default_schedules`, plus `Cast::SaveProfileContract`
and the dead `CastRepository`/`Handler` methods listed above.

**`comment_handler.rb`'s `get_comment_author`** is rewritten to resolve
both cast and guest comment authors through `ProfileAuthorAdapter`
(`profiles`), the same as post authors — no more branching on
`account_adapter.get_user_type` for this purpose. This also removes the
last live reason `CastAdapter` needs to carry display fields at all;
after this change `CastAdapter`/`CastInfo` only need `user_id` and
`visibility` (used by `find_my_cast`/`find_blocker`/post-visibility
gating).

**Area-based cast discovery** (`GetPublicCastIdsInPrefecture`) switches
from `cast_areas`/`area_ids_by_prefecture` to
`profile_repository.account_ids_by_prefecture` (already used by the
feed AREA tab), intersected with `public_cast_ids`. `cast_areas` table,
its relation, and `CastRepository#area_ids_by_prefecture` /
`#cast_user_ids_by_area_ids` / `CastRepository#save_areas` /
`#find_area_ids` (the cast-specific ones — `ProfileRepository` already
has its own `save_areas`/`find_area_ids` for `profile_areas`) are
dropped.

## Migration plan

One ROM::SQL migration, in this order (each step is a no-op if the
"dead" assumption above holds, which is the expected case):

1. **Backfill** — for every column that exists on both tables, update
   `profiles` only where its value is `NULL` and the corresponding
   `casts` column is not:
   `UPDATE profile.profiles p SET <field> = c.<field> FROM profile.casts c WHERE p.account_id = c.user_id AND p.<field> IS NULL AND c.<field> IS NOT NULL`
   — repeated per overlapping column. `profiles` wins when both are
   present (it's the actively-edited copy today).
2. **Drop columns** from `profile.casts`: `name`, `tagline`,
   `social_links`, `age`, `height`, `blood_type`, `three_sizes`, `tags`,
   `slug`, `profile_media_id`, `avatar_media_id`, `registered_at`,
   `default_schedules`. (`name`/`bio` are `NOT NULL` on `casts` today —
   dropping the column removes the constraint with it, so this is
   safe.)
3. **Drop `profile.cast_areas`** (table + its ROM relation/association).
4. Regenerate `structure.sql` per the normal migration workflow.

No down-migration data restore is provided for the dropped columns
beyond re-adding them empty — per this repo's stated preference
(destroy-and-recreate over salvage) and because the columns are already
dead. If this turns out to be wrong for some column (see Open
Questions), we fix that specific column before dropping, not after.

## Consumer changes by slice

- **profile slice**: delete `Cast::SaveProfileContract`; slim
  `CastRepository` to `find_by_user_id(s)`/`find_by_id(s)` (returning
  just `user_id`+`visibility`), `save_visibility`, `public_cast_ids`,
  plus `cast_genres`/`cast_gallery_media` methods unchanged; delete the
  dead methods listed above (including `private_cast_ids`); update
  `Relations::Casts` schema to the narrowed column set; rewrite
  `GetPublicCastIdsInPrefecture` to use `ProfileRepository`.
- **post slice**: narrow `Post::Adapters::CastAdapter`'s `CastInfo` to
  `user_id`+`visibility`; rewrite `get_comment_author` (in
  `Post::Grpc::Handler`) to use `ProfileAuthorAdapter` for both roles;
  delete dead `load_authors`/`find_my_cast!`.
- **discovery slice**: no code change expected (already reads
  `profiles`) — regression-test only.
- **schedule slice**: no change — confirmed `casts.default_schedules`
  has no live reader/writer and no coupling to the `Schedule` slice's
  own tables (`offer` schema); it is simply dropped.
- **frontend**: no `Cast`-shaped TS type was found duplicating the
  `Profile` type during this investigation; verify during
  implementation and update any that do (e.g. discovery/search result
  mapping) to read the unified profile shape.

## Testing strategy

- `bundle exec rspec` for the full monolith before and after, per this
  repo's convention (CI does not run rspec; local run is the only
  signal — see project memory on monolith verification).
- Add/adjust specs for: `get_comment_author` returning current
  `profiles` data for both a cast and a guest author; area-filtered
  discovery reflecting a `profile_areas` change; the migration's
  backfill (a model/repository spec seeding divergent `casts`/`profiles`
  rows and asserting the resulting `profiles` row).
- No frontend behavior is intended to change (this is a backend data
  model consolidation); `pnpm exec tsc --noEmit` and `pnpm exec vitest
  run` as a regression check only.

## Out of scope

- `profile.guests` is not restructured — only the `post` slice's
  *comment author resolution* is made symmetric between cast and guest
  (both via `ProfileAuthorAdapter`/`profiles`), which was already true
  for post authors.
- Shop/schedule modeling (explicitly deferred by PR #1182 already) is
  untouched.
- No production data is touched directly from this session; the
  migration ships as a normal committed migration file and runs through
  the existing deploy pipeline, like every other migration in this
  repo.

## Open questions to confirm during implementation

- `CastRepository#find_gallery_media_ids` — the grep above flagged it
  as unused, but `cast_gallery_media` is a live relation; re-verify
  whether some other code path (e.g. a gRPC handler not yet read)
  fetches gallery media before deleting this method rather than the
  column/table.
- Whether any `casts` row currently has non-null data in a column
  `profiles` lacks for that account — the backfill step handles this
  generically, but worth a one-time read-only query against a
  non-production database copy before writing the down-migration
  commit message, to note in the PR whether backfill was a true no-op
  or actually moved data.
