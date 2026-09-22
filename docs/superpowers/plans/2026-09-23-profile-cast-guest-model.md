# Re-scope profile.casts / retire profile.guests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move cast-only fields (`sns_links`/`age`/`body_stats`/`industry`) from `profile.profiles` to `profile.casts`, retire `profile.guests` entirely, and make the `post` slice's cast/guest detection use `identity.accounts.role` (which already works) instead of `profile.casts`/`profile.guests` row existence (which doesn't, since nothing creates those rows).

**Architecture:** Two tasks. Task 1 moves the cast-only fields end to end (schema, write path via `SaveProfile`, read path via `ProfilePresenter` and every gRPC handler that renders a `Profile` proto) so nothing regresses mid-task. Task 2 is independent cleanup: it removes the now-redundant `profile.casts`/`profile.guests` existence-check path from the `post` slice and physically drops `profile.guests`.

**Tech Stack:** Ruby / Hanami 3 / ROM-SQL (Sequel migrations) / RSpec, `dystopia/monolith`.

**Spec:** `docs/superpowers/specs/2026-09-23-profile-cast-guest-model-design.md` (and its predecessor `docs/superpowers/specs/2026-09-21-unify-cast-profile-model-design.md`, which this plan continues).

## Global Constraints

- No production data exists yet (confirmed with the user) — migrations do not need expand/contract phasing across deploys, but each **task** in this plan must still leave `bundle exec rspec` green, run from `dystopia/monolith`.
- Ruby style: `# frozen_string_literal: true` at the top of every new/rewritten file (match existing files in the touched directories).
- Follow existing patterns exactly: ROM relation attribute style (`Types::String`, `Types::Hash`, etc.), `commands :create, update: :by_pk` + hand-written `upsert` (see `ProfileRepository#upsert`), cross-slice access via `::Identity::Slice["repositories.account_repository"]` / `::Profile::Slice["repositories.cast_repository"]` (not via `Deps[]`, which is reserved for same-slice dependencies in this codebase).
- Do not touch `profile.cast_genres`, `profile.cast_gallery_media`, `profile.guest_prefectures`, `offer.plans`, `profile.genres`, or any code referencing them — out of scope (tracked separately as "project B" per the spec).
- Do not touch `profile.profile_areas`/`profile.areas` — explicitly out of scope per the spec.
- Migration filenames follow the existing `YYYYMMDDHHMMSS_description.rb` convention (see `config/db/migrate/`).

---

## Task 1: Move cast-only fields from `profiles` to `casts`

**Files:**
- Create: `config/db/migrate/20260923120000_move_cast_extras_from_profiles_to_casts.rb`
- Modify: `slices/profile/relations/casts.rb`
- Modify: `slices/profile/relations/profiles.rb`
- Modify: `slices/profile/repositories/cast_repository.rb`
- Modify: `slices/profile/use_cases/save_profile.rb`
- Modify: `slices/profile/presenters/profile_presenter.rb`
- Modify: `slices/profile/grpc/profile_handler.rb`
- Modify: `slices/footprints/grpc/footprints_handler.rb`
- Modify: `slices/discovery/grpc/discovery_handler.rb`
- Modify: `slices/social/grpc/block_handler.rb`
- Modify: `slices/social/grpc/follow_handler.rb`
- Test: `spec/slices/profile/relations/casts_spec.rb`
- Test: `spec/slices/profile/repositories/cast_repository_spec.rb`
- Test: `spec/slices/profile/use_cases/save_profile_spec.rb`
- Test: `spec/slices/profile/presenters/profile_presenter_spec.rb`

**Interfaces:**
- Produces: `Profile::Repositories::CastRepository#upsert(user_id:, attrs:)` — creates or updates a `profile.casts` row.
- Produces: `Profile::Presenters::ProfilePresenter.to_proto(profile, cast: nil, area_records: [], media_files: {}, role: 0)` — `cast:` is a new optional keyword; when `nil`, `sns_links`/`age`/`body_stats`/`industry` render as empty/zero (unchanged behavior for guests).
- Consumes (all pre-existing, unchanged signatures): `Profile::Repositories::ProfileRepository#upsert(account_id:, attrs:)`, `#find_by_account_id(account_id)`, `::Identity::Slice["repositories.account_repository"].find_by_id(id)` returning an object with `#role` (`1` = GUEST, `2` = CAST).

Why five gRPC handlers beyond `profile_handler.rb`: `footprints_handler.rb`, `discovery_handler.rb`, `social/block_handler.rb`, and `social/follow_handler.rb` each have their own `present_profile(profile)` that already resolves `role_for(profile.account_id)` and calls `ProfilePresenter.to_proto`. Without updating them too, cast-extras would silently render empty in footprints/discovery/block/follow lists for real casts — a functional regression, not just a wiring gap.

- [ ] **Step 1: Write the migration**

`config/db/migrate/20260923120000_move_cast_extras_from_profiles_to_casts.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"profile__casts" do
      add_column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :age, :integer
      add_column :body_stats, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :industry, :varchar, size: 50
    end

    run <<~SQL
      UPDATE profile.casts c
      SET sns_links = p.sns_links, age = p.age, body_stats = p.body_stats, industry = p.industry
      FROM profile.profiles p
      JOIN identity.accounts a ON a.id = p.account_id
      WHERE c.user_id = p.account_id AND a.role = 2
    SQL

    alter_table :"profile__casts" do
      drop_column :visibility
    end

    alter_table :"profile__profiles" do
      drop_column :sns_links
      drop_column :age
      drop_column :body_stats
      drop_column :industry
    end
  end

  down do
    alter_table :"profile__profiles" do
      add_column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :age, :integer
      add_column :body_stats, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :industry, :varchar, size: 50
    end

    alter_table :"profile__casts" do
      add_column :visibility, :text, default: "offline"
      drop_column :sns_links
      drop_column :age
      drop_column :body_stats
      drop_column :industry
    end
  end
end
```

No data-restoring `down` beyond structure — matches this repo's established destroy-and-recreate convention (see `20260921120000_unify_cast_profile_model.rb`).

- [ ] **Step 2: Run the migration**

Run: `cd dystopia/monolith && bundle exec hanami db migrate --no-dump` (pending billing settings env vars aren't needed once this is the only pending migration; if the command complains about `stripe_*`/`billing_*` settings, prefix with dummy values as done earlier in this session: `STRIPE_API_KEY=sk_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy STRIPE_PRICE_ID_GUEST=price_dummy STRIPE_PRICE_ID_CAST=price_dummy BILLING_SUCCESS_URL=http://localhost/success BILLING_CANCEL_URL=http://localhost/cancel BILLING_PORTAL_RETURN_URL=http://localhost/return`)

Expected: `database monolith migrated` and `database monolith_test migrated`.

- [ ] **Step 3: Update the `casts` relation**

`slices/profile/relations/casts.rb` — full replacement:

```ruby
module Profile
  module Relations
    class Casts < Profile::DB::Relation
      schema(:"profile__casts", as: :casts, infer: false) do
        attribute :user_id, Types::String  # UUID
        attribute :sns_links, Types::Hash          # JSONB
        attribute :age, Types::Integer.optional
        attribute :body_stats, Types::Hash          # JSONB: height_cm/bust/waist/hip/cup
        attribute :industry, Types::String.optional
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

- [ ] **Step 4: Update the `profiles` relation**

`slices/profile/relations/profiles.rb` — remove the `sns_links`/`age`/`body_stats`/`industry` lines so it reads:

```ruby
module Profile
  module Relations
    class Profiles < Profile::DB::Relation
      schema(:"profile__profiles", as: :profiles, infer: false) do
        attribute :account_id, Types::String       # UUID, PK = identity.Account
        attribute :username, Types::String.optional
        attribute :display_name, Types::String
        attribute :bio, Types::String.optional
        attribute :avatar_media_id, Types::String.optional
        attribute :cover_media_id, Types::String.optional
        attribute :website, Types::String.optional
        attribute :prefecture, Types::String.optional
        attribute :is_private, Types::Bool
        attribute :registered_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :account_id

        associations do
          has_many :profile_areas, foreign_key: :profile_id
        end
      end
    end
  end
end
```

- [ ] **Step 5: Update `casts_spec.rb` for the new attribute list**

`spec/slices/profile/relations/casts_spec.rb` line 11 — change:

```ruby
    expect(attribute_names).to contain_exactly(:user_id, :visibility, :created_at, :updated_at)
```

to:

```ruby
    expect(attribute_names).to contain_exactly(:user_id, :sns_links, :age, :body_stats, :industry, :created_at, :updated_at)
```

- [ ] **Step 6: Run the relation spec to confirm the schema matches**

Run: `bundle exec rspec spec/slices/profile/relations/casts_spec.rb -f doc`
Expected: all 3 examples PASS.

- [ ] **Step 7: Add `CastRepository#upsert`, fix the `visibility` reference in its spec**

`slices/profile/repositories/cast_repository.rb` — add this method (keep every existing method as-is, including `find_by_id`/`find_by_ids`/`find_by_user_ids`, which Task 2 removes):

```ruby
      def upsert(user_id:, attrs:)
        if casts.by_pk(user_id).exist?
          update(user_id, attrs.merge(updated_at: Time.now))
        else
          create(attrs.merge(user_id: user_id))
        end
      end
```

Insert it directly after `find_by_user_ids` and before `find_gallery_media_ids`.

`spec/slices/profile/repositories/cast_repository_spec.rb` — the existing "returns the cast row when it exists" example calls `repo.create(user_id: user_id, visibility: "public")`, which now fails since `visibility` no longer exists. Replace the whole file:

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
      repo.create(user_id: user_id)

      expect(repo.find_by_user_id(user_id).user_id).to eq(user_id)
    end
  end

  describe "#upsert" do
    it "creates a cast row when one does not exist" do
      user_id = SecureRandom.uuid_v7

      repo.upsert(user_id: user_id, attrs: { age: 24, industry: "fuzoku" })

      cast = repo.find_by_user_id(user_id)
      expect(cast.age).to eq(24)
      expect(cast.industry).to eq("fuzoku")
    end

    it "updates the existing cast row instead of creating a second one" do
      user_id = SecureRandom.uuid_v7
      repo.create(user_id: user_id)

      repo.upsert(user_id: user_id, attrs: { age: 30 })

      expect(repo.find_by_user_id(user_id).age).to eq(30)
    end
  end
end
```

- [ ] **Step 8: Run the repository spec**

Run: `bundle exec rspec spec/slices/profile/repositories/cast_repository_spec.rb -f doc`
Expected: all 4 examples PASS.

- [ ] **Step 9: Cut `SaveProfile` over to writing cast-extras into `casts`**

`slices/profile/use_cases/save_profile.rb` — full replacement:

```ruby
# frozen_string_literal: true

require "errors/validation_error"

module Profile
  module UseCases
    class SaveProfile
      include Deps["repositories.profile_repository", "repositories.cast_repository"]

      DISPLAY_NAME_MAX = 50
      BIO_MAX = 1000
      USERNAME_FORMAT = /\A[A-Za-z0-9_]{3,30}\z/
      AREAS_MAX = 2
      ROLE_CAST = 2

      def call(account_id:, display_name:, username: nil, bio: nil, website: nil,
               sns_links: {}, prefecture: nil, is_private: false, age: nil,
               body_stats: {}, industry: nil, area_ids: [])
        validate_display_name!(display_name)
        validate_bio!(bio)
        validate_username!(username, account_id) unless username.nil?
        validate_areas!(area_ids)

        attrs = {
          display_name: display_name,
          bio: bio,
          website: website,
          prefecture: prefecture,
          is_private: is_private ? true : false
        }
        attrs[:username] = username unless username.nil?

        profile_repository.upsert(account_id: account_id, attrs: attrs)
        profile_repository.save_areas(account_id: account_id, area_ids: area_ids || [])

        if cast_account?(account_id)
          cast_repository.upsert(
            user_id: account_id,
            attrs: {
              sns_links: Sequel.pg_jsonb(sns_links || {}),
              age: age,
              body_stats: Sequel.pg_jsonb(body_stats || {}),
              industry: industry
            }
          )
        end

        profile_repository.find_by_account_id(account_id)
      end

      private

      def cast_account?(account_id)
        identity_account_repo.find_by_id(account_id)&.role == ROLE_CAST
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def validate_display_name!(value)
        if value.nil? || value.strip.empty?
          raise Errors::ValidationError, "表示名は必須です"
        end
        if value.length > DISPLAY_NAME_MAX
          raise Errors::ValidationError, "表示名は#{DISPLAY_NAME_MAX}文字以内で入力してください"
        end
      end

      def validate_bio!(value)
        return if value.nil?

        if value.length > BIO_MAX
          raise Errors::ValidationError, "自己紹介は#{BIO_MAX}文字以内で入力してください"
        end
      end

      def validate_username!(value, account_id)
        unless value.match?(USERNAME_FORMAT)
          raise Errors::ValidationError, "ユーザー名は半角英数字とアンダースコア3〜30文字です"
        end
        unless profile_repository.username_available?(value, exclude_account_id: account_id)
          raise Errors::ValidationError, "このユーザー名は使用できません"
        end
      end

      def validate_areas!(ids)
        return if ids.nil?

        if ids.size > AREAS_MAX
          raise Errors::ValidationError, "活動エリアは#{AREAS_MAX}件まで選択できます"
        end
      end
    end
  end
end
```

- [ ] **Step 10: Update `save_profile_spec.rb`'s body_stats test to target the cast row, add a guest-does-not-get-a-cast-row test**

`spec/slices/profile/use_cases/save_profile_spec.rb` — replace the `"persists body_stats as a jsonb hash"` example (lines 32-40) and add two new examples right after it:

```ruby
  it "persists cast-extras (body_stats, age, industry, sns_links) onto the cast row for a CAST account" do
    accounts = Identity::Slice["relations.accounts"]
    accounts.dataset.insert(id: account_id, role: 2, created_at: Time.now, updated_at: Time.now)
    cast_repo = Hanami.app.slices[:profile]["repositories.cast_repository"]

    uc.call(
      account_id: account_id, display_name: "Coco", age: 24, industry: "fuzoku",
      sns_links: { "x" => "https://x.com/coco" },
      body_stats: { "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D" }
    )

    cast = cast_repo.find_by_user_id(account_id)
    expect(cast.age).to eq(24)
    expect(cast.industry).to eq("fuzoku")
    expect(cast.sns_links).to eq("x" => "https://x.com/coco")
    expect(cast.body_stats).to eq(
      "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D"
    )
  end

  it "does not create a cast row for a GUEST account" do
    accounts = Identity::Slice["relations.accounts"]
    accounts.dataset.insert(id: account_id, role: 1, created_at: Time.now, updated_at: Time.now)
    cast_repo = Hanami.app.slices[:profile]["repositories.cast_repository"]

    uc.call(account_id: account_id, display_name: "Coco", age: 24, body_stats: { "height_cm" => 158 })

    expect(cast_repo.find_by_user_id(account_id)).to be_nil
  end

  it "does not create a cast row when the account does not exist (unknown role)" do
    cast_repo = Hanami.app.slices[:profile]["repositories.cast_repository"]

    uc.call(account_id: account_id, display_name: "Coco", age: 24)

    expect(cast_repo.find_by_user_id(account_id)).to be_nil
  end
```

- [ ] **Step 11: Run the use case spec**

Run: `bundle exec rspec spec/slices/profile/use_cases/save_profile_spec.rb -f doc`
Expected: all examples PASS (original 9 minus the removed one, plus 3 new = 11 total).

- [ ] **Step 12: Cut `ProfilePresenter` over to reading cast-extras from a `cast:` argument**

`slices/profile/presenters/profile_presenter.rb` — full replacement:

```ruby
# frozen_string_literal: true

module Profile
  module Presenters
    class ProfilePresenter
      class << self
        def to_proto(profile, cast: nil, area_records: [], media_files: {}, role: 0)
          return nil unless profile

          ::Profile::V1::Profile.new(
            account_id: profile.account_id.to_s,
            username: profile.username || "",
            display_name: profile.display_name || "",
            bio: profile.bio || "",
            avatar_media_id: profile.avatar_media_id || "",
            avatar_url: media_files[profile.avatar_media_id]&.url || "",
            cover_media_id: profile.cover_media_id || "",
            cover_url: media_files[profile.cover_media_id]&.url || "",
            website: profile.website || "",
            sns_links: sns_links_proto(cast&.sns_links),
            prefecture: profile.prefecture || "",
            is_private: profile.is_private ? true : false,
            registered_at: profile.registered_at ? profile.registered_at.iso8601 : "",
            age: cast&.age || 0,
            body_stats: body_stats_proto(cast&.body_stats),
            industry: cast&.industry || "",
            areas: area_records.map { |a| area_to_proto(a) },
            role: role || 0
          )
        end

        def area_to_proto(area)
          ::Profile::V1::Area.new(
            id: area.id.to_s,
            region: area.respond_to?(:region) ? (area.region || "") : "",
            prefecture: area.prefecture || "",
            name: area.name || "",
            code: area.code || ""
          )
        end

        private

        def sns_links_proto(hash)
          h = hash || {}
          ::Profile::V1::SnsLinks.new(
            x: h["x"] || h[:x] || "",
            instagram: h["instagram"] || h[:instagram] || "",
            tiktok: h["tiktok"] || h[:tiktok] || "",
            bluesky: h["bluesky"] || h[:bluesky] || "",
            line: h["line"] || h[:line] || "",
            cityheaven: h["cityheaven"] || h[:cityheaven] || ""
          )
        end

        def body_stats_proto(hash)
          h = hash || {}
          ::Profile::V1::BodyStats.new(
            height_cm: h["height_cm"] || h[:height_cm] || 0,
            bust_cm: h["bust"] || h[:bust] || 0,
            waist_cm: h["waist"] || h[:waist] || 0,
            hip_cm: h["hip"] || h[:hip] || 0,
            cup: h["cup"] || h[:cup] || ""
          )
        end
      end
    end
  end
end
```

Only the `to_proto` signature and the three lines feeding `sns_links:`/`age:`/`body_stats:`/`industry:` changed — everything else, including `sns_links_proto`/`body_stats_proto`, is untouched (they already accept a plain hash, nil-safely).

- [ ] **Step 13: Update `profile_presenter_spec.rb` to pass a separate cast struct**

`spec/slices/profile/presenters/profile_presenter_spec.rb` — full replacement:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "profile/v1/service_pb"
require "slices/profile/presenters/profile_presenter"

RSpec.describe Profile::Presenters::ProfilePresenter do
  let(:profile_struct) do
    Struct.new(:account_id, :username, :display_name, :bio, :avatar_media_id, :cover_media_id,
      :website, :prefecture, :is_private, :registered_at)
  end

  let(:cast_struct) do
    Struct.new(:sns_links, :age, :body_stats, :industry)
  end

  describe ".to_proto" do
    it "maps body_stats into a BodyStats proto" do
      profile = profile_struct.new("acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil)
      cast = cast_struct.new(
        {}, 24, { "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D" }, nil
      )

      proto = described_class.to_proto(profile, cast: cast)

      expect(proto.body_stats.height_cm).to eq(158)
      expect(proto.body_stats.bust_cm).to eq(88)
      expect(proto.body_stats.waist_cm).to eq(58)
      expect(proto.body_stats.hip_cm).to eq(86)
      expect(proto.body_stats.cup).to eq("D")
    end

    it "defaults body_stats and age fields to zero/empty when cast is nil" do
      profile = profile_struct.new("acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil)

      proto = described_class.to_proto(profile, cast: nil)

      expect(proto.body_stats.height_cm).to eq(0)
      expect(proto.body_stats.cup).to eq("")
      expect(proto.age).to eq(0)
    end

    it "maps the cityheaven sns link" do
      profile = profile_struct.new("acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil)
      cast = cast_struct.new({ "cityheaven" => "https://www.cityheaven.net/example/" }, nil, {}, nil)

      proto = described_class.to_proto(profile, cast: cast)

      expect(proto.sns_links.cityheaven).to eq("https://www.cityheaven.net/example/")
    end

    it "no longer exposes cup_size, height_cm, or shop_id on the proto" do
      expect(::Profile::V1::Profile.descriptor.map(&:name)).not_to include("cup_size", "height_cm", "shop_id")
    end
  end
end
```

- [ ] **Step 14: Run the presenter spec**

Run: `bundle exec rspec spec/slices/profile/presenters/profile_presenter_spec.rb -f doc`
Expected: all 4 examples PASS.

- [ ] **Step 15: Wire `cast_repository` into `profile_handler.rb#present`**

`slices/profile/grpc/profile_handler.rb`:

Change the `Deps[...]` block (around line 24) from:

```ruby
      include ::Profile::Deps[
        get_profile_uc: "use_cases.get_profile",
        get_profile_by_username_uc: "use_cases.get_profile_by_username",
        save_profile_uc: "use_cases.save_profile",
        check_username_uc: "use_cases.check_username_availability",
        save_media_uc: "use_cases.save_profile_media",
        list_areas_uc: "use_cases.list_areas",
        profile_repository: "repositories.profile_repository",
        area_repository: "repositories.area_repository"
      ]
```

to:

```ruby
      include ::Profile::Deps[
        get_profile_uc: "use_cases.get_profile",
        get_profile_by_username_uc: "use_cases.get_profile_by_username",
        save_profile_uc: "use_cases.save_profile",
        check_username_uc: "use_cases.check_username_availability",
        save_media_uc: "use_cases.save_profile_media",
        list_areas_uc: "use_cases.list_areas",
        profile_repository: "repositories.profile_repository",
        area_repository: "repositories.area_repository",
        cast_repository: "repositories.cast_repository"
      ]
```

Change `#present` (around line 118) from:

```ruby
      def present(profile)
        area_ids = profile_repository.find_area_ids(profile.account_id)
        area_records = area_repository.find_by_ids(area_ids)
        media_files = load_media_files(profile)
        role = role_for(profile.account_id)
        Presenter.to_proto(profile, area_records: area_records, media_files: media_files, role: role)
      end
```

to:

```ruby
      def present(profile)
        area_ids = profile_repository.find_area_ids(profile.account_id)
        area_records = area_repository.find_by_ids(area_ids)
        media_files = load_media_files(profile)
        role = role_for(profile.account_id)
        cast = role == 2 ? cast_repository.find_by_user_id(profile.account_id) : nil
        Presenter.to_proto(profile, cast: cast, area_records: area_records, media_files: media_files, role: role)
      end
```

- [ ] **Step 16: Wire cast-extras into the four other `present_profile` call sites**

Each of these four files has the identical shape. For each, add a `cast_repository` accessor next to the existing `identity_account_repo` accessor, and update `present_profile` to fetch the cast row when `role == 2`.

`slices/footprints/grpc/footprints_handler.rb` — change:

```ruby
      def present_profile(profile)
        return nil unless profile
        ::Profile::Presenters::ProfilePresenter.to_proto(
          profile,
          role: role_for(profile.account_id)
        )
      end

      def role_for(account_id)
        identity_account_repo.find_by_id(account_id)&.role || 0
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
```

to:

```ruby
      def present_profile(profile)
        return nil unless profile
        role = role_for(profile.account_id)
        cast = role == 2 ? cast_repository.find_by_user_id(profile.account_id) : nil
        ::Profile::Presenters::ProfilePresenter.to_proto(
          profile,
          cast: cast,
          role: role
        )
      end

      def role_for(account_id)
        identity_account_repo.find_by_id(account_id)&.role || 0
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def cast_repository
        @cast_repository ||= ::Profile::Slice["repositories.cast_repository"]
      end
```

`slices/discovery/grpc/discovery_handler.rb` — change:

```ruby
      def present_profile(profile)
        ::Profile::Presenters::ProfilePresenter.to_proto(
          profile,
          role: role_for(profile.account_id)
        )
      end

      def role_for(account_id)
        identity_account_repo.find_by_id(account_id)&.role || 0
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
```

to:

```ruby
      def present_profile(profile)
        role = role_for(profile.account_id)
        cast = role == 2 ? cast_repository.find_by_user_id(profile.account_id) : nil
        ::Profile::Presenters::ProfilePresenter.to_proto(
          profile,
          cast: cast,
          role: role
        )
      end

      def role_for(account_id)
        identity_account_repo.find_by_id(account_id)&.role || 0
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def cast_repository
        @cast_repository ||= ::Profile::Slice["repositories.cast_repository"]
      end
```

`slices/social/grpc/block_handler.rb` — same transformation as `discovery_handler.rb` above (identical shape), applied around line 68.

`slices/social/grpc/follow_handler.rb` — same transformation as `discovery_handler.rb` above (identical shape), applied around line 147.

- [ ] **Step 17: Run the full monolith suite**

Run: `cd dystopia/monolith && bundle exec rspec`
Expected: 0 failures. If `spec/slices/discovery`, `spec/slices/social`, or `spec/slices/footprints` have fixtures for cast profiles that now need an `identity.accounts` row to resolve `role: 2` correctly, they already had to set one up to get `role_for` working pre-change — no new fixture setup should be needed there, since `role_for`'s behavior is unchanged.

- [ ] **Step 18: Commit**

```bash
git add config/db/migrate/20260923120000_move_cast_extras_from_profiles_to_casts.rb \
  slices/profile/relations/casts.rb slices/profile/relations/profiles.rb \
  slices/profile/repositories/cast_repository.rb slices/profile/use_cases/save_profile.rb \
  slices/profile/presenters/profile_presenter.rb slices/profile/grpc/profile_handler.rb \
  slices/footprints/grpc/footprints_handler.rb slices/discovery/grpc/discovery_handler.rb \
  slices/social/grpc/block_handler.rb slices/social/grpc/follow_handler.rb \
  spec/slices/profile/relations/casts_spec.rb spec/slices/profile/repositories/cast_repository_spec.rb \
  spec/slices/profile/use_cases/save_profile_spec.rb spec/slices/profile/presenters/profile_presenter_spec.rb
git commit -s -m "$(cat <<'EOF'
feat(dystopia/monolith): move cast-extras fields from profiles to casts

sns_links/age/body_stats/industry only ever hold values for CAST
accounts (proto already grouped them as "cast extras"); keeping them on
the shared profiles table meant every guest row carried four always-null
columns. SaveProfile now upserts them onto profile.casts, gated on
identity.accounts.role, using the same upsert pattern already used for
profiles.
EOF
)"
```

---

## Task 2: Simplify post-slice cast/guest detection, retire `profile.guests`

**Files:**
- Create: `config/db/migrate/20260923130000_drop_guests_table.rb`
- Modify: `slices/profile/repositories/cast_repository.rb`
- Modify: `slices/post/grpc/handler.rb`
- Delete: `slices/profile/relations/guests.rb`
- Delete: `slices/profile/repositories/guest_repository.rb`
- Delete: `slices/profile/use_cases/guest/queries/get_by_ids.rb`
- Delete: `slices/profile/use_cases/guest/queries/get_by_user_ids.rb`
- Delete: `slices/profile/use_cases/cast/queries/get_by_ids.rb`
- Delete: `slices/profile/use_cases/cast/queries/get_by_user_ids.rb`
- Delete: `slices/post/adapters/cast_adapter.rb`
- Delete: `slices/post/adapters/guest_adapter.rb`
- Delete: `slices/profile/policies/profile_access_policy.rb`
- Delete: `spec/slices/profile/policies/profile_access_policy_spec.rb`
- Test: `spec/slices/post/grpc/handler_spec.rb` (new)

**Interfaces:**
- Consumes: `Post::Adapters::BlockAdapter#blocked_ids(account_id:)` (unchanged), `current_user_id` (unchanged, existing `Grpc::Authenticatable` method available in `Post::Grpc::Handler`).
- Produces: nothing new — this task only removes now-redundant code paths. `CastRepository#find_by_user_id`/`#upsert` (produced in Task 1) remain; `#find_by_id`/`#find_by_ids`/`#find_by_user_ids` are removed here since their only callers (`Cast::Queries::GetByIds`/`GetByUserIds`, in turn only called by `CastAdapter`) are removed in this same task.

- [ ] **Step 1: Write and run the migration to drop `profile.guests`**

`config/db/migrate/20260923130000_drop_guests_table.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # cascade: also drops the FK from profile.guest_prefectures (a separately
    # dead table, out of scope here) — it does not drop guest_prefectures itself.
    drop_table :"profile__guests", cascade: true
  end

  down do
    create_table :"profile__guests" do
      column :user_id, :uuid, null: false
      column :name, :text, null: false
      column :avatar_media_id, :uuid
      column :tagline, :varchar, size: 100
      column :bio, :text
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:user_id]
    end
    add_index :"profile__guests", :avatar_media_id, name: :portfolio_guests_avatar_media_id_index
  end
end
```

Run: `cd dystopia/monolith && bundle exec hanami db migrate --no-dump` (same dummy billing env vars as Task 1 Step 2 if prompted).
Expected: `database monolith migrated` and `database monolith_test migrated`.

- [ ] **Step 2: Delete the guest relation, repository, and its query use cases**

```bash
rm slices/profile/relations/guests.rb
rm slices/profile/repositories/guest_repository.rb
rm slices/profile/use_cases/guest/queries/get_by_ids.rb
rm slices/profile/use_cases/guest/queries/get_by_user_ids.rb
rmdir slices/profile/use_cases/guest/queries slices/profile/use_cases/guest 2>/dev/null || true
```

- [ ] **Step 3: Delete the now-orphaned cast query use cases**

These wrap `CastRepository#find_by_ids`/`#find_by_user_ids`, whose only caller (`CastAdapter`) is deleted in Step 5 below.

```bash
rm slices/profile/use_cases/cast/queries/get_by_ids.rb
rm slices/profile/use_cases/cast/queries/get_by_user_ids.rb
rmdir slices/profile/use_cases/cast/queries slices/profile/use_cases/cast 2>/dev/null || true
```

- [ ] **Step 4: Remove the now-dead finder methods from `CastRepository`**

`slices/profile/repositories/cast_repository.rb` — remove `find_by_id`, `find_by_ids`, and `find_by_user_ids` (keep `find_by_user_id`, `upsert`, `find_gallery_media_ids`, `save_genres`, `find_genre_ids` untouched — the last three are out of scope, tracked separately). Full replacement:

```ruby
module Profile
  module Repositories
    class CastRepository < Profile::DB::Repo
      commands :create, update: :by_pk

      # PK is user_id (no separate id column)
      def find_by_user_id(user_id)
        casts.by_pk(user_id).one
      end

      def upsert(user_id:, attrs:)
        if casts.by_pk(user_id).exist?
          update(user_id, attrs.merge(updated_at: Time.now))
        else
          create(attrs.merge(user_id: user_id))
        end
      end

      def find_gallery_media_ids(cast_user_id)
        cast_gallery_media.where(cast_user_id: cast_user_id).order(:position).pluck(:media_id)
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

- [ ] **Step 5: Delete `CastAdapter` and `GuestAdapter`**

```bash
rm slices/post/adapters/cast_adapter.rb
rm slices/post/adapters/guest_adapter.rb
```

- [ ] **Step 6: Simplify `Post::Grpc::Handler`'s block-filtering to use `current_user_id` directly**

`slices/post/grpc/handler.rb` — full replacement:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require "storage"
require_relative "../adapters/account_adapter"
require_relative "../adapters/block_adapter"
require_relative "../adapters/media_adapter"

module Post
  module Grpc
    # Base handler class for Post gRPC services.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include ::Concerns::CursorPagination

      include Post::Deps[
        post_repo: "repositories.post_repository",
        like_repo: "repositories.like_repository",
        comment_repo: "repositories.comment_repository"
      ]

      protected

      PostPresenter = Post::Presenters::PostPresenter
      CommentPresenter = Post::Presenters::CommentPresenter

      def account_adapter
        @account_adapter ||= Post::Adapters::AccountAdapter.new
      end

      def block_adapter
        @block_adapter ||= Post::Adapters::BlockAdapter.new
      end

      def media_adapter
        @media_adapter ||= Post::Adapters::MediaAdapter.new
      end

      def get_blocked_user_ids
        return [] unless current_user_id

        block_adapter.blocked_ids(account_id: current_user_id)
      end
    end
  end
end
```

`find_my_cast`/`find_my_guest`/`find_blocker` are gone: their only purpose was picking a user_id to pass to `block_adapter.blocked_ids`, and that id was always `current_user_id` (the `type: "cast"/"guest"` half of the old `find_blocker` result was never read anywhere). `account_adapter` accessor is kept even though nothing in this file calls it yet — it was already unused before this change (pre-existing, out of scope; see the design spec's Evidence section) and removing it is not part of this task's goal.

- [ ] **Step 7: Add a handler-level regression spec for `get_blocked_user_ids`**

This codebase has exactly one existing precedent for instantiating a Gruf controller directly in a spec: `spec/slices/identity/grpc/handler_spec.rb`. It passes `method_key:, service:, rpc_desc:, active_call:, message:` as doubles (Gruf's `Controllers::Base#initialize` only stores them on `@request`, which `get_blocked_user_ids` never touches) plus overrides for any `Deps[]`-injected dependencies it exercises. `Post::Grpc::Handler`'s own `Deps["repositories.post_repository", ...]` aren't touched by this test, so they're left at their container-resolved defaults.

Create `spec/slices/post/grpc/handler_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/handler"

RSpec.describe Post::Grpc::Handler, type: :database do
  let(:handler) do
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: double(:message)
    )
  end
  let(:block_repo) { Social::Slice["repositories.block_repository"] }

  after { Current.clear }

  describe "#get_blocked_user_ids" do
    it "returns an empty array without a current user" do
      expect(handler.send(:get_blocked_user_ids)).to eq([])
    end

    it "returns ids blocked by the current user, using identity.accounts.role rather than a profile.casts/profile.guests row" do
      blocker_id = SecureRandom.uuid_v7
      blocked_id = SecureRandom.uuid_v7
      block_repo.block(blocker_id: blocker_id, blocked_id: blocked_id)
      Current.user_id = blocker_id

      expect(handler.send(:get_blocked_user_ids)).to contain_exactly(blocked_id)
    end
  end
end
```

The second example is the regression the design spec asked for: it authenticates as `blocker_id` — an account with no `profile.casts` or `profile.guests` row at all (none is created anywhere in this test) — and confirms block-filtering still returns the correct result, because `get_blocked_user_ids` no longer looks at those tables.

- [ ] **Step 8: Run the new handler spec**

Run: `bundle exec rspec spec/slices/post/grpc/handler_spec.rb -f doc`
Expected: both examples PASS.

- [ ] **Step 9: Delete `ProfileAccessPolicy` and its spec**

```bash
rm slices/profile/policies/profile_access_policy.rb
rm spec/slices/profile/policies/profile_access_policy_spec.rb
rmdir slices/profile/policies 2>/dev/null || true
```

- [ ] **Step 10: Run the full monolith suite**

Run: `cd dystopia/monolith && bundle exec rspec`
Expected: 0 failures.

- [ ] **Step 11: Confirm nothing still references the deleted files**

Run: `grep -rn "CastAdapter\|GuestAdapter\|ProfileAccessPolicy\|relations.guests\|repositories.guest_repository\|use_cases.guest\.\|use_cases.cast.queries" slices spec --include="*.rb"`
Expected: no output (empty).

- [ ] **Step 12: Commit**

```bash
git add config/db/migrate/20260923130000_drop_guests_table.rb \
  slices/profile/repositories/cast_repository.rb slices/post/grpc/handler.rb \
  spec/slices/post/grpc/handler_spec.rb
git add -u slices/profile/relations/guests.rb slices/profile/repositories/guest_repository.rb \
  slices/profile/use_cases/guest slices/profile/use_cases/cast \
  slices/post/adapters/cast_adapter.rb slices/post/adapters/guest_adapter.rb \
  slices/profile/policies spec/slices/profile/policies
git commit -s -m "$(cat <<'EOF'
refactor(dystopia/monolith): retire profile.guests, use role for cast/guest detection

post/grpc/handler.rb determined "is this account a cast or guest" by
checking whether a profile.casts/profile.guests row exists, but nothing
in the codebase ever created those rows for real signups (only seed
data). identity.accounts.role already answers the same question
correctly (see Post::Adapters::AccountAdapter, already used elsewhere),
so block-filtering now uses current_user_id directly. profile.guests
carried no data profile.profiles didn't already have, so it's dropped
entirely rather than fixed.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Every "Consumer changes by slice" bullet and the Testing strategy's "regression spec confirming block-filtering works via identity.accounts.role even without casts/guests rows" now have a corresponding step. Initial planning missed that `spec/slices/identity/grpc/handler_spec.rb` already establishes exactly the pattern needed to instantiate a Gruf controller in a spec (`described_class.new(method_key: :test, service: double, rpc_desc: double, active_call: double, message: ...)`); Task 2 Step 7 reuses it for `Post::Grpc::Handler` rather than inventing a new one.
- The five `present_profile` call sites (only one of which — `profile_handler.rb` — is named explicitly in the spec's consumer list) were discovered during planning by grepping all callers of `ProfilePresenter.to_proto`; the spec's own "Evidence" section already established the method for finding them (grep before assuming).
- **Placeholder scan:** No TBD/TODO. Every step shows complete file contents or precise before/after diffs.
- **Type consistency:** `ProfilePresenter.to_proto(profile, cast: nil, area_records: [], media_files: {}, role: 0)` — the same signature is used identically in Task 1 Steps 12, 15, and 16. `CastRepository#upsert(user_id:, attrs:)` matches between Task 1 Step 7 (added) and Task 2 Step 4 (kept as-is in the full-file replacement).
- **Out-of-scope guard:** Task 2 Step 4's full-file replacement of `cast_repository.rb` explicitly preserves `find_gallery_media_ids`/`save_genres`/`find_genre_ids` verbatim — these belong to the separately-tracked dead-table cleanup (project B) and must not be touched here.
