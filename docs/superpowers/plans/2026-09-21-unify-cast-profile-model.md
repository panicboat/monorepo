# Unify Cast Profile Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate `profile.casts` and `profile.profiles` into a single cast profile data source: `profiles` owns all display/identity fields, `casts` shrinks to cast-only business data (`visibility`, plus the `cast_genres`/`cast_gallery_media` associations), and every dead code path uncovered during investigation is deleted.

**Architecture:** One ROM::SQL migration backfills `profiles` from `casts` (inserting missing `profiles` rows first) then drops the now-redundant `casts` columns and the `cast_areas` table. Application code in the `profile` and `post` slices is narrowed to match: `CastRepository`, `Post::Adapters::CastAdapter`, and `Post::Grpc::Handler` lose the methods that only existed to serve the dropped columns/tables, and `GetPublicCastIds(InPrefecture)` moves its "registered" and "in this prefecture" filtering onto `ProfileRepository`.

**Tech Stack:** Ruby / Hanami 2 slices / ROM-SQL (Postgres) / dry-validation contracts / RSpec (`type: :database` for repository specs) — `dystopia/monolith`. No frontend changes are expected; frontend commands are run only as a regression check.

**Spec:** `docs/superpowers/specs/2026-09-21-unify-cast-profile-model-design.md`

## Global Constraints

- Ruby files: `# frozen_string_literal: true` at the top (existing convention in every file this plan touches).
- Migration filenames: `config/db/migrate/<YYYYMMDDHHMMSS>_<snake_case_description>.rb`, using `ROM::SQL.migration do ... end` with `up`/`down` blocks (see any existing file under that directory).
- Table identifiers inside migrations use the `schema__table` form (e.g. `:"profile__casts"`), matching every existing migration.
- Do not bundle a regenerated `structure.sql` with this change — this repo's practice is migration file + local `bundle exec hanami db migrate` + `bundle exec rspec`, not committing `structure.sql` (see project memory on monolith migrations).
- No down-migration data restore beyond re-creating empty columns/tables — matches this repo's existing precedent (e.g. `20260218220000_remove_legacy_media_columns.rb`) and the spec's explicitly stated destroy-and-recreate preference.
- Every `rspec`/`tsc`/`vitest` command below is run from `dystopia/monolith` or `dystopia/frontend` respectively (this plan's working directory is the git worktree for branch `refactor/dystopia-unify-cast-profile-model`).

---

### Task 1: Migration — backfill `profiles`, drop dead `casts` columns and `cast_areas`

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20260921120000_unify_cast_profile_model.rb`

**Interfaces:**
- Produces: after this migration, `profile.casts` has exactly the columns `user_id, visibility, created_at, updated_at`; `profile.cast_areas` no longer exists; `profile.profiles` has a row for every account that has a `profile.casts` row, with `display_name`/`bio`/`avatar_media_id`/`registered_at`/`age` backfilled wherever `profiles` was missing a value and `casts` had one.

- [ ] **Step 1: Write the migration**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Ensure every cast account has a profiles row before backfilling into it.
    # profiles rows are only created when SaveProfile is called (Settings /
    # EditProfileModal) — never guaranteed at signup, so older casts that
    # never touched that flow would otherwise be silently dropped below.
    run <<~SQL
      INSERT INTO profile.profiles (account_id, display_name, bio, avatar_media_id, registered_at, age, created_at, updated_at)
      SELECT c.user_id, c.name, c.bio, c.avatar_media_id, c.registered_at, c.age, c.created_at, c.updated_at
      FROM profile.casts c
      WHERE NOT EXISTS (SELECT 1 FROM profile.profiles p WHERE p.account_id = c.user_id)
    SQL

    # Backfill profiles fields from casts wherever profiles is missing a value.
    # Only fields with a direct, same-shape counterpart are backfilled — see
    # the design doc for why tagline/social_links/height/blood_type/
    # three_sizes/tags/slug/profile_media_id are dropped without backfill.
    run <<~SQL
      UPDATE profile.profiles p
      SET display_name = c.name
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND (p.display_name IS NULL OR p.display_name = '') AND c.name IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET bio = c.bio
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.bio IS NULL AND c.bio IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET avatar_media_id = c.avatar_media_id
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.avatar_media_id IS NULL AND c.avatar_media_id IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET registered_at = c.registered_at
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.registered_at IS NULL AND c.registered_at IS NOT NULL
    SQL

    run <<~SQL
      UPDATE profile.profiles p
      SET age = c.age
      FROM profile.casts c
      WHERE p.account_id = c.user_id AND p.age IS NULL AND c.age IS NOT NULL
    SQL

    alter_table :"profile__casts" do
      drop_column :name
      drop_column :tagline
      drop_column :social_links
      drop_column :age
      drop_column :height
      drop_column :blood_type
      drop_column :three_sizes
      drop_column :tags
      drop_column :slug
      drop_column :profile_media_id
      drop_column :avatar_media_id
      drop_column :registered_at
      drop_column :default_schedules
    end

    drop_table :"profile__cast_areas"
  end

  down do
    create_table(:"profile__cast_areas") do
      column :cast_user_id, :uuid, null: false
      column :area_id, :uuid, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:cast_user_id, :area_id]
      foreign_key [:cast_user_id], :"profile__casts", on_delete: :cascade
      foreign_key [:area_id], :"profile__areas", on_delete: :cascade
    end
    add_index :"profile__cast_areas", :area_id, name: :idx_cast_areas_area_id

    alter_table :"profile__casts" do
      add_column :name, String
      add_column :tagline, String
      add_column :social_links, :jsonb, default: Sequel.lit("'{}'::jsonb")
      add_column :age, Integer
      add_column :height, Integer
      add_column :blood_type, String
      add_column :three_sizes, :jsonb, default: Sequel.lit("'{}'::jsonb")
      add_column :tags, :jsonb, default: Sequel.lit("'[]'::jsonb")
      add_column :slug, String
      add_column :profile_media_id, :uuid
      add_column :avatar_media_id, :uuid
      add_column :registered_at, :timestamptz
      add_column :default_schedules, :jsonb, default: Sequel.lit("'[]'::jsonb")
    end
  end
end
```

- [ ] **Step 2: Run the migration against the test database**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: migration `20260921120000_unify_cast_profile_model.rb` applies with no errors. (A `pg_dump` version-mismatch warning after this command is expected and can be ignored per project convention — the schema change itself is what matters.)

- [ ] **Step 3: Verify the migration is reversible**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db rollback && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: both commands succeed with no errors (proves the `down` block is syntactically and referentially valid — do not leave the DB rolled back, the final `db migrate` re-applies it).

- [ ] **Step 4: Commit**

```bash
git add dystopia/monolith/config/db/migrate/20260921120000_unify_cast_profile_model.rb
git commit -s -m "feat(dystopia/monolith): unify cast profile data into profile.profiles"
```

---

### Task 2: Narrow the `Casts` relation, delete the `CastAreas` relation

**Files:**
- Modify: `dystopia/monolith/slices/profile/relations/casts.rb`
- Delete: `dystopia/monolith/slices/profile/relations/cast_areas.rb`
- Modify: `dystopia/monolith/spec/slices/profile/relations/casts_spec.rb`

**Interfaces:**
- Consumes: the migrated `profile__casts` table from Task 1 (columns: `user_id, visibility, created_at, updated_at`).
- Produces: `Profile::Relations::Casts` schema with attributes `user_id, visibility, created_at, updated_at` and associations `plans, cast_gallery_media` (no more `cast_areas`).

- [ ] **Step 1: Update the failing spec first**

Replace the full contents of `dystopia/monolith/spec/slices/profile/relations/casts_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Relations::Casts", type: :database do
  let(:relation) { Hanami.app.slices[:profile]["relations.casts"] }

  it "defines the narrowed schema" do
    expect(relation.schema.primary_key_name).to eq(:user_id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to contain_exactly(:user_id, :visibility, :created_at, :updated_at)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"profile__casts")
  end

  it "defines associations" do
    associations = relation.schema.associations.elements
    expect(associations.keys).to contain_exactly(:plans, :cast_gallery_media)
  end
end
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/relations/casts_spec.rb`
Expected: FAIL — `contain_exactly` mismatches because the relation still declares the old, wider attribute/association set.

- [ ] **Step 3: Narrow the relation**

Replace the full contents of `dystopia/monolith/slices/profile/relations/casts.rb`:

```ruby
module Profile
  module Relations
    class Casts < Profile::DB::Relation
      schema(:"profile__casts", as: :casts, infer: false) do
        attribute :user_id, Types::String  # UUID
        attribute :visibility, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :user_id

        associations do
          has_many :plans, foreign_key: :cast_user_id
          has_many :cast_gallery_media, foreign_key: :cast_user_id
        end
      end
    end
  end
end
```

- [ ] **Step 4: Delete the now-orphaned `CastAreas` relation**

```bash
rm dystopia/monolith/slices/profile/relations/cast_areas.rb
```

- [ ] **Step 5: Run the spec again to confirm it passes**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/relations/casts_spec.rb`
Expected: 3 examples, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/slices/profile/relations/casts.rb \
        dystopia/monolith/slices/profile/relations/cast_areas.rb \
        dystopia/monolith/spec/slices/profile/relations/casts_spec.rb
git commit -s -m "refactor(dystopia/monolith): narrow the casts relation to cast-only fields"
```

---

### Task 3: Narrow `CastRepository`

**Files:**
- Modify: `dystopia/monolith/slices/profile/repositories/cast_repository.rb`
- Modify: `dystopia/monolith/spec/slices/profile/repositories/cast_repository_spec.rb`

**Interfaces:**
- Consumes: `Profile::Relations::Casts` from Task 2.
- Produces: `CastRepository` keeps exactly `#find_by_user_id`, `#find_by_id`, `#find_by_ids`, `#find_by_user_ids`, `#find_gallery_media_ids`, `#save_visibility`, `#public_cast_ids` (now `visibility`-only, no `registered_at` filter — that filter moves to `ProfileRepository#registered_account_ids` in Task 4), `#save_genres`, `#find_genre_ids`, `#find_area_and_genre_ids` (drop the `area_ids` half of its return — see Step 3), `#get_genre_ids`. Everything else found dead in the spec (`#find_by_slug`, `#slug_available?`, `#get_popular_tags`, `#complete_registration`, `#save_images`, `#find_with_plans`, `#find_by_user_id_with_plans`, `#private_cast_ids`, `#save_areas`, `#find_area_ids`, `#area_ids_by_prefecture`, `#cast_user_ids_by_area_ids`) is deleted.

- [ ] **Step 1: Replace `cast_repository_spec.rb` with specs for only the surviving methods**

Replace the full contents of `dystopia/monolith/spec/slices/profile/repositories/cast_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::CastRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }

  describe "#find_by_user_id" do
    it "returns nil when the cast does not exist" do
      expect(repo.find_by_user_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns the cast row when it exists" do
      user_id = SecureRandom.uuid_v7
      repo.create(user_id: user_id, visibility: "public")

      expect(repo.find_by_user_id(user_id).user_id).to eq(user_id)
    end
  end

  describe "#save_visibility" do
    it "updates the visibility column" do
      user_id = SecureRandom.uuid_v7
      repo.create(user_id: user_id, visibility: "offline")

      repo.save_visibility(user_id, "public")

      expect(repo.find_by_user_id(user_id).visibility).to eq("public")
    end
  end

  describe "#public_cast_ids" do
    it "returns only user_ids with visibility public" do
      public_id = SecureRandom.uuid_v7
      private_id = SecureRandom.uuid_v7
      repo.create(user_id: public_id, visibility: "public")
      repo.create(user_id: private_id, visibility: "private")

      expect(repo.public_cast_ids).to include(public_id)
      expect(repo.public_cast_ids).not_to include(private_id)
    end
  end
end
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/repositories/cast_repository_spec.rb`
Expected: FAIL/ERROR — `repo.create(user_id: ..., visibility: ...)` errors because the relation (from Task 2) no longer accepts `name`/`bio` as required attributes the way the old spec assumed, and `public_cast_ids` still references the now-dropped `registered_at` column.

- [ ] **Step 3: Narrow the repository**

Replace the full contents of `dystopia/monolith/slices/profile/repositories/cast_repository.rb`:

```ruby
module Profile
  module Repositories
    class CastRepository < Profile::DB::Repo
      commands :create, update: :by_pk

      # PK is user_id (no separate id column)
      def find_by_user_id(user_id)
        casts.by_pk(user_id).one
      end

      # find_by_id is now equivalent to find_by_user_id since PK = user_id
      def find_by_id(id)
        casts.by_pk(id).one
      end

      # find_by_ids now uses user_id (which is the PK)
      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        casts.where(user_id: ids).to_a
      end

      # find_by_user_ids is equivalent to find_by_ids since PK = user_id
      def find_by_user_ids(user_ids)
        return [] if user_ids.nil? || user_ids.empty?

        casts.where(user_id: user_ids).to_a
      end

      def find_gallery_media_ids(cast_user_id)
        cast_gallery_media.where(cast_user_id: cast_user_id).order(:position).pluck(:media_id)
      end

      def save_visibility(user_id, visibility)
        update(user_id, visibility: visibility)
      end

      def public_cast_ids
        casts.where(visibility: "public").pluck(:user_id)
      end

      def save_genres(cast_user_id:, genre_ids:)
        transaction do
          cast_genres.where(cast_user_id: cast_user_id).delete
          genre_ids.each do |genre_id|
            cast_genres.changeset(:create, id: SecureRandom.uuid_v7, cast_user_id: cast_user_id, genre_id: genre_id).commit
          end
        end
      end

      def find_genre_ids(cast_user_id)
        cast_genres.where(cast_user_id: cast_user_id).pluck(:genre_id)
      end
    end
  end
end
```

Note: `#find_area_and_genre_ids` and the standalone `#is_registered?`/`#list_by_visibility` methods from the original file are dropped along with this rewrite — none had a live caller (see spec Evidence section); `find_genre_ids` above covers the one live half of what `find_area_and_genre_ids` used to combine.

- [ ] **Step 4: Run the spec again to confirm it passes**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/repositories/cast_repository_spec.rb`
Expected: 4 examples, 0 failures.

- [ ] **Step 5: Run the full profile-slice spec suite to catch any other caller this plan missed**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile`
Expected: 0 failures. If something fails referencing a method deleted in Step 3, that method had a live caller this plan's static trace missed — stop and re-add just that method rather than proceeding.

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/slices/profile/repositories/cast_repository.rb \
        dystopia/monolith/spec/slices/profile/repositories/cast_repository_spec.rb
git commit -s -m "refactor(dystopia/monolith): narrow CastRepository to its live methods"
```

---

### Task 4: Move "registered" and area filtering onto `ProfileRepository`

**Why this task exists (beyond the spec):** `CastRepository#public_cast_ids` used to also filter out casts with a `nil` `registered_at` — that column no longer exists on `casts` after Task 1 (it now lives only on `profiles`, backfilled with the same values). To keep cast discovery returning the same set of accounts as before, the "registered" check moves to a new `ProfileRepository` method that reads `profiles.registered_at`. `GetPublicCastIdsInPrefecture`'s area filter moves from `cast_areas` to `profiles.prefecture`, per the spec.

**Files:**
- Modify: `dystopia/monolith/slices/profile/repositories/profile_repository.rb`
- Modify: `dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb`
- Modify: `dystopia/monolith/slices/profile/use_cases/cast/queries/get_public_cast_ids.rb`
- Modify: `dystopia/monolith/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture.rb`
- Create: `dystopia/monolith/spec/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture_spec.rb`

**Interfaces:**
- Produces: `ProfileRepository#registered_account_ids -> Array<String>`. `GetPublicCastIds#call -> Array<String>` (unchanged signature). `GetPublicCastIdsInPrefecture#call(prefecture:) -> Array<String>` (unchanged signature).

- [ ] **Step 1: Write the failing spec for `ProfileRepository#registered_account_ids`**

Append to `dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb` (inside the existing `RSpec.describe` block, alongside the other `describe` blocks):

```ruby
  describe "#registered_account_ids" do
    it "returns only accounts with a non-nil registered_at" do
      registered_id = SecureRandom.uuid_v7
      unregistered_id = SecureRandom.uuid_v7
      repo.create(account_id: registered_id, display_name: "Registered", registered_at: Time.now)
      repo.create(account_id: unregistered_id, display_name: "Unregistered")

      expect(repo.registered_account_ids).to include(registered_id)
      expect(repo.registered_account_ids).not_to include(unregistered_id)
    end
  end
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/repositories/profile_repository_spec.rb -e "#registered_account_ids"`
Expected: FAIL with `NoMethodError: undefined method 'registered_account_ids'`.

- [ ] **Step 3: Add the method**

In `dystopia/monolith/slices/profile/repositories/profile_repository.rb`, add this method (e.g. directly below `#account_ids_by_prefecture`):

```ruby
      # Accounts that have completed onboarding, per the same registered_at
      # gate cast discovery has always used (now sourced from profiles
      # instead of the retired profile.casts.registered_at).
      def registered_account_ids
        profiles.exclude(registered_at: nil).pluck(:account_id)
      end
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/repositories/profile_repository_spec.rb`
Expected: all examples pass (including the new one).

- [ ] **Step 5: Rewrite `GetPublicCastIds` to intersect with `registered_account_ids`**

Replace the full contents of `dystopia/monolith/slices/profile/use_cases/cast/queries/get_public_cast_ids.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    module Cast
      module Queries
        # Query for getting IDs of all public, registered casts.
        # Intended for cross-slice communication (e.g., Feed slice).
        class GetPublicCastIds
          include ::Profile::Deps[
            repo: "repositories.cast_repository",
            profile_repository: "repositories.profile_repository"
          ]

          # Get all public, registered cast IDs.
          #
          # @return [Array<String>] array of cast IDs
          def call
            repo.public_cast_ids & profile_repository.registered_account_ids
          end
        end
      end
    end
  end
end
```

- [ ] **Step 6: Write the failing spec for `GetPublicCastIdsInPrefecture`**

Create `dystopia/monolith/spec/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::Cast::Queries::GetPublicCastIdsInPrefecture", type: :database do
  let(:use_case) { Hanami.app.slices[:profile]["use_cases.cast.queries.get_public_cast_ids_in_prefecture"] }
  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  def create_public_registered_cast(prefecture:)
    account_id = SecureRandom.uuid_v7
    cast_repo.create(user_id: account_id, visibility: "public")
    profile_repo.create(
      account_id: account_id,
      display_name: "Cast",
      prefecture: prefecture,
      registered_at: Time.now
    )
    account_id
  end

  it "returns only public, registered casts in the given prefecture" do
    in_prefecture = create_public_registered_cast(prefecture: "東京都")
    other_prefecture = create_public_registered_cast(prefecture: "大阪府")

    result = use_case.call(prefecture: "東京都")

    expect(result).to include(in_prefecture)
    expect(result).not_to include(other_prefecture)
  end

  it "falls back to all public registered cast ids when prefecture is blank" do
    cast_id = create_public_registered_cast(prefecture: "東京都")

    expect(use_case.call(prefecture: nil)).to include(cast_id)
    expect(use_case.call(prefecture: "")).to include(cast_id)
  end

  it "excludes casts that are not registered" do
    account_id = SecureRandom.uuid_v7
    cast_repo.create(user_id: account_id, visibility: "public")
    profile_repo.create(account_id: account_id, display_name: "Cast", prefecture: "東京都")

    expect(use_case.call(prefecture: "東京都")).not_to include(account_id)
  end
end
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture_spec.rb`
Expected: FAIL — the current implementation still calls `repo.area_ids_by_prefecture`/`repo.cast_user_ids_by_area_ids`, which were deleted in Task 3, so this errors with `NoMethodError`.

- [ ] **Step 8: Rewrite `GetPublicCastIdsInPrefecture`**

Replace the full contents of `dystopia/monolith/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    module Cast
      module Queries
        # Query for getting IDs of public, registered casts filtered by prefecture.
        # Falls back to all public, registered cast IDs when no prefecture is specified.
        # Intended for cross-slice communication (e.g., Feed slice).
        class GetPublicCastIdsInPrefecture
          include ::Profile::Deps[
            repo: "repositories.cast_repository",
            profile_repository: "repositories.profile_repository"
          ]

          # Get public, registered cast IDs filtered by prefecture.
          #
          # @param prefecture [String, nil] prefecture name to filter by
          # @return [Array<String>] array of cast IDs
          def call(prefecture:)
            public_registered_ids = repo.public_cast_ids & profile_repository.registered_account_ids
            return public_registered_ids if prefecture.nil? || prefecture.empty?

            account_ids_in_prefecture = profile_repository.account_ids_by_prefecture(prefecture)
            public_registered_ids & account_ids_in_prefecture
          end
        end
      end
    end
  end
end
```

- [ ] **Step 9: Run it to confirm it passes**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture_spec.rb`
Expected: 3 examples, 0 failures.

- [ ] **Step 10: Commit**

```bash
git add dystopia/monolith/slices/profile/repositories/profile_repository.rb \
        dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb \
        dystopia/monolith/slices/profile/use_cases/cast/queries/get_public_cast_ids.rb \
        dystopia/monolith/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture.rb \
        dystopia/monolith/spec/slices/profile/use_cases/cast/queries/get_public_cast_ids_in_prefecture_spec.rb
git commit -s -m "fix(dystopia/monolith): filter cast discovery by profile_areas instead of cast_areas"
```

---

### Task 5: Delete the dead `Cast::SaveProfileContract`

**Files:**
- Delete: `dystopia/monolith/slices/profile/contracts/cast/save_profile_contract.rb`

**Interfaces:**
- Consumes: nothing (zero callers found — see spec Evidence).
- Produces: nothing; this is a pure deletion.

- [ ] **Step 1: Delete the file**

```bash
rm dystopia/monolith/slices/profile/contracts/cast/save_profile_contract.rb
```

- [ ] **Step 2: Run the full profile-slice suite to confirm nothing referenced it**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/profile`
Expected: 0 failures. (No spec file exercised this contract — confirmed during planning.)

- [ ] **Step 3: Commit**

```bash
git add -A dystopia/monolith/slices/profile/contracts
git commit -s -m "refactor(dystopia/monolith): delete the dead cast SaveProfileContract"
```

---

### Task 6: Narrow `Post::Adapters::CastAdapter`

**Files:**
- Modify: `dystopia/monolith/slices/post/adapters/cast_adapter.rb`

**Interfaces:**
- Consumes: `Profile::UseCases::Cast::Queries::GetByUserIds` (unchanged from Task 3/4 — still returns the narrowed `casts` row, which now only carries `user_id`/`visibility`/`created_at`/`updated_at`).
- Produces: `CastAdapter#find_by_user_id(user_id) -> CastInfo | nil`, where `CastInfo = Data.define(:user_id)`. This is the only method that has a live caller (`Post::Grpc::Handler#find_my_cast`, via `find_blocker`/`get_blocked_user_ids`).

- [ ] **Step 1: Replace the full contents of `cast_adapter.rb`**

```ruby
# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for checking cast existence from the Profile slice.
    class CastAdapter
      CastInfo = Data.define(:user_id)

      def find_by_user_id(user_id)
        casts = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if casts.empty?

        CastInfo.new(user_id: casts.first.user_id)
      end

      private

      def get_by_user_ids_query
        @get_by_user_ids_query ||= Profile::Slice["use_cases.cast.queries.get_by_user_ids"]
      end
    end
  end
end
```

This removes `find_by_cast_id`, `find_by_cast_ids`, `find_by_user_ids`, `find_by_id`, `get_user_ids_by_cast_ids`, `public_cast_ids`, and the `get_by_ids_query`/`get_public_cast_ids_query` accessors — none had a live caller once Task 7 removes `load_authors` (see spec Evidence; re-confirmed by grepping `cast_adapter\.` across `dystopia/monolith/slices/post` for every method name before writing this task).

- [ ] **Step 2: Run the post-slice suite**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/post`
Expected: 0 failures. If something fails referencing a deleted `CastAdapter` method, stop and re-add only that method.

- [ ] **Step 3: Commit**

```bash
git add dystopia/monolith/slices/post/adapters/cast_adapter.rb
git commit -s -m "refactor(dystopia/monolith): narrow CastAdapter to an existence check"
```

---

### Task 7: Delete dead comment-author code from `Post::Grpc::Handler`/`CommentHandler`

**Files:**
- Modify: `dystopia/monolith/slices/post/grpc/handler.rb`
- Modify: `dystopia/monolith/slices/post/grpc/comment_handler.rb`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — `CommentHandler#get_comment_author` (the live, `ProfileAuthorAdapter`-based override) is untouched and remains the only `get_comment_author` in the class hierarchy after this task.

- [ ] **Step 1: Remove the dead methods from `handler.rb`**

In `dystopia/monolith/slices/post/grpc/handler.rb`, delete these methods entirely (all confirmed zero-caller in the spec's Evidence section — `get_comment_author` is always shadowed by `CommentHandler`'s override, and the guest-side helper follows the same live/dead split as the cast-side one):

- `find_my_cast!`
- `find_my_guest!`
- `find_blocker!`
- `get_comment_author`
- `load_authors`

Keep `find_my_cast`, `find_my_guest`, `find_blocker`, and `get_blocked_user_ids` — each of those has a live caller (`get_blocked_user_ids` from `comment_handler.rb`, which calls `find_blocker`, which calls `find_my_cast`/`find_my_guest`).

The `cast_adapter`/`guest_adapter`/`account_adapter`/`block_adapter`/`media_adapter` accessor methods and their `require_relative`s at the top of the file are all still needed by the surviving methods — leave them as-is.

- [ ] **Step 2: Remove the dead method from `comment_handler.rb`**

In `dystopia/monolith/slices/post/grpc/comment_handler.rb`, delete `load_media_files_for_comments_with_authors` entirely (zero callers — confirmed in the spec's Evidence section). Keep `get_comment_author` (the live override), `load_media_files_for_comments`, and every RPC method as-is.

- [ ] **Step 3: Run the post-slice suite**

Run: `cd dystopia/monolith && bundle exec rspec spec/slices/post`
Expected: 0 failures.

- [ ] **Step 4: Commit**

```bash
git add dystopia/monolith/slices/post/grpc/handler.rb dystopia/monolith/slices/post/grpc/comment_handler.rb
git commit -s -m "refactor(dystopia/monolith): delete dead cast/guest-adapter comment author code"
```

---

### Task 8: Full regression pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full monolith spec suite**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec`
Expected: 0 failures. Compare the total example count against a pre-change run (from Task 1, before any code changes) — a lower count likely means a describe block was deleted along with live behavior it was covering, not just dead code; investigate any unexplained drop before proceeding.

- [ ] **Step 2: Confirm the frontend has no duplicate Cast-shaped type**

Run: `cd dystopia/frontend && grep -rn "interface Cast\b\|type Cast " src --include=*.ts --include=*.tsx`
Expected: no results duplicating the `Profile`/`ProfileView` shape (this plan's spec flagged this as unverified — none was found during investigation, but re-check here since this backend change is the last point where it'd matter). If a duplicate `Cast` type does turn up, stop and report it rather than silently changing frontend code — it's out of this plan's scope as written and needs its own task.

- [ ] **Step 3: Confirm the frontend is unaffected**

Run: `cd dystopia/frontend && npx pnpm@11.27.0 exec tsc --noEmit -p . && npx pnpm@11.27.0 exec vitest run`
Expected: tsc reports no errors; vitest reports the same pass count as on `main` (this plan makes no frontend changes — this step exists purely to confirm nothing cross-cutting broke).

- [ ] **Step 4: Re-confirm the migration round-trips cleanly one more time end-to-end**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db rollback && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: both succeed. Leave the database migrated (not rolled back) when done.

- [ ] **Step 5: Update the PR description with the backfill's real effect**

Per the spec's Open Questions: note in the PR description whether Task 1's Step 2 migration run actually moved any data (i.e., whether the `UPDATE`/`INSERT` statements affected zero rows against the dev/test database, or some) — this tells reviewers whether the "already dead" assumption held in practice, not just in this plan's static trace.
