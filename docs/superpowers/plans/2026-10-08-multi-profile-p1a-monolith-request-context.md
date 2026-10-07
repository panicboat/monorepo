# Multi Profile P1a: Monolith Profile Model and Request Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monolith の行為者 ID を account から profile に切り替え、1 account が複数の profile を持てるデータモデルとリクエスト文脈を用意する。

**Architecture:** `profile.profiles` を独自の `id` を PK とする表に作り直し、`AuthenticationInterceptor` が `x-user-id`(account)と `x-profile-id`(人格)から `Current.account_id` / `Current.profile_id` を解決する。`current_user_id` は profile の id を返すようになり、全 slice が同じ入口から同じ種類の id を受け取る。role は account にあるので、profile の id から role を得る入口を profile slice に設ける。

**Tech Stack:** Ruby 3.4 / Hanami 3(slice)/ Gruf(gRPC)/ ROM-SQL + Sequel / PostgreSQL / RSpec + database_cleaner-sequel / buf(proto codegen)

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`

この plan は spec の Delivery 段 1 のうち proto と monolith を扱う。段 1 の frontend は別 plan(P1b)で扱い、同じブランチに積む。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-model`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- コマンドは特記が無い限り `dystopia/monolith` で実行する。
- rspec は `HANAMI_ENV=test bundle exec rspec` で実行する。CI は rspec を回さないため、ローカル実行が唯一の判定基準である。
- Task 3 から Task 8 の途中では、他 slice の spec が落ちる。各タスクの完了条件はそのタスクが指定する spec であり、全体の rspec は Task 9 で通す。
- profile の `id` は account の id と一致させない。fixture でも必ず別の値にする。
- 人格数の上限は cast が 5、guest が 1。無効な profile も数に含める。
- `account_id` を返すのは本人向けの identity / billing レスポンスだけとする。`profile.v1.Profile` に account の id を載せない。
- エラーの割り当て: 他人の profile・存在しない profile・無効な profile を `x-profile-id` で指定 → `PERMISSION_DENIED`。行為者が必要な RPC で操作中の profile が無い → `FAILED_PRECONDITION`。上限超過 → `FAILED_PRECONDITION`。
- 既存行の整合は保たない。migration はデータを移行しない。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。一時的な実装には `# TODO:`、エラーを握りつぶす箇所には `# SILENT:` を付ける。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。
- 頼まれた箇所以外をリファクタしない。この plan が挙げていないファイルのカラム名・引数名は変えない(改名は後続の段で行う)。

## Review Focus

spec が含意するが、素直に実装すると抜けやすい入力。各行のテストは括弧内のタスクに入れてある。

1. `x-profile-id` が UUID 形式でない文字列のとき、PostgreSQL の型エラーではなく `PERMISSION_DENIED` になる(Task 4)。
2. `x-user-id` が UUID 形式でないとき、profile の解決が例外にならず「profile なし」として扱われる(Task 3 / Task 4)。
3. 同じ account の別の profile が使っている username を、もう一方の profile が `SaveProfile` で取ろうとしたら拒否される。自分自身の username を保ったままの保存は通る(Task 5)。
4. 上限の境界: cast の 5 個目は作れて 6 個目は拒否される。guest の 2 個目は拒否される。無効な profile も数える(Task 5)。
5. profile を複数持つ account が `x-profile-id` 無しで行為を伴う RPC を呼んだとき、行為者が空のまま処理されず `FAILED_PRECONDITION` になる(Task 4 / Task 6)。

---

### Task 1: Local environment baseline

以降のタスクで「既存の失敗」と「この変更による失敗」を区別するための基準を取る。コードは変更しない。

**Files:** なし

**Interfaces:**
- Consumes: なし
- Produces: 基準となる rspec の結果(examples 数と失敗している example の一覧)。Task 9 が比較に使う。

- [ ] **Step 1: Postgres の起動を確認する**

Run: `pg_isready -h localhost -p 5432`
Expected: `localhost:5432 - accepting connections`

`no response` の場合は `brew services start postgresql@18` を実行し、もう一度確認する。このサービスは開発機で常駐させる前提のもので、作業後も止めない。formula が無い・起動しない場合は、ここで作業を止めて依頼者に報告する。

- [ ] **Step 2: gem と schema を揃える**

Run: `bundle install && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: migrate がエラー無く終わる。`pg_dump` のバージョン不一致による structure.sql の書き出し失敗は無視してよい。

- [ ] **Step 3: 基準の rspec を実行して記録する**

Run: `HANAMI_ENV=test bundle exec rspec 2>&1 | tail -40`
Expected: `N examples, M failures` の行が出る。

`N` と `M`、および `rspec ./spec/...` で始まる失敗行をすべて完了報告に書き写す。`M` が 0 でなくても先へ進む(既存の失敗として扱う)。

---

### Task 2: Proto contract and Ruby stubs

**Files:**
- Modify: `proto/dystopia/profile/v1/service.proto`
- Generate: `dystopia/monolith/stubs/profile/v1/service_pb.rb`, `dystopia/monolith/stubs/profile/v1/service_services_pb.rb`

**Interfaces:**
- Consumes: なし
- Produces:
  - `Profile::V1::Profile` のフィールド 1 が `id`、フィールド 21 が `disabled`(bool)
  - `Profile::V1::GetProfileRequest#profile_id`
  - `Profile::V1::ListMyProfilesRequest`(フィールド無し)/ `ListMyProfilesResponse#profiles`(repeated Profile)
  - `Profile::V1::CreateProfileRequest#display_name` / `#username`、`CreateProfileResponse#profile`
  - `Profile::V1::ProfileService` の RPC `ListMyProfiles` / `CreateProfile`

- [ ] **Step 1: proto を編集する**

`proto/dystopia/profile/v1/service.proto` の `service` ブロックを次に置き換える。

```proto
service ProfileService {
  rpc GetProfile (GetProfileRequest) returns (GetProfileResponse);
  rpc GetProfileByUsername (GetProfileByUsernameRequest) returns (GetProfileResponse);
  rpc ListMyProfiles (ListMyProfilesRequest) returns (ListMyProfilesResponse);
  rpc CreateProfile (CreateProfileRequest) returns (CreateProfileResponse);
  rpc SaveProfile (SaveProfileRequest) returns (SaveProfileResponse);
  rpc CheckUsernameAvailability (CheckUsernameAvailabilityRequest) returns (CheckUsernameAvailabilityResponse);
  rpc SaveProfileMedia (SaveProfileMediaRequest) returns (SaveProfileMediaResponse);
}
```

`message Profile` の 1 行目を改名し、末尾に `disabled` を足す。

```proto
message Profile {
  string id = 1;
```

```proto
  int32 role = 20;
  bool disabled = 21;
}
```

`GetProfileRequest` の行を次に置き換え、その下に 4 つの message を足す。

```proto
message GetProfileRequest { string profile_id = 1; }
```

```proto
message ListMyProfilesRequest {}
message ListMyProfilesResponse { repeated Profile profiles = 1; }

message CreateProfileRequest {
  string display_name = 1;
  string username = 2;
}
message CreateProfileResponse { Profile profile = 1; }
```

- [ ] **Step 2: Ruby の stub を生成する**

Run: `bundle exec bin/codegen`
Expected: `✅ Done.`

`buf generate` は全 package の stub を作り直す。profile 以外に差分が出たら戻す。

Run: `git status --short stubs`
Expected: `stubs/profile/v1/service_pb.rb` と `stubs/profile/v1/service_services_pb.rb` だけが変更されている。それ以外のファイルが出た場合は `git checkout -- <そのファイル>` で戻す。

- [ ] **Step 3: stub の内容を確認する**

Run:
```bash
bundle exec ruby -Istubs -e 'require "profile/v1/service_services_pb"; puts Profile::V1::Profile.descriptor.map(&:name).values_at(0, -1).inspect; puts Profile::V1::GetProfileRequest.descriptor.map(&:name).inspect; puts Profile::V1::ProfileService::Service.rpc_descs.keys.sort.inspect'
```
Expected:
```
["id", "disabled"]
["profile_id"]
[:CheckUsernameAvailability, :CreateProfile, :GetProfile, :GetProfileByUsername, :ListMyProfiles, :SaveProfile, :SaveProfileMedia]
```

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add proto/dystopia/profile/v1/service.proto dystopia/monolith/stubs/profile/v1 && git commit -s -m "feat(dystopia): add profile id and own-profile RPCs to the profile contract" && cd dystopia/monolith
```

---

### Task 3: Schema, relations and repositories

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261008000000_recreate_profiles_keyed_by_id.rb`
- Create: `dystopia/monolith/spec/support/profile_fixtures.rb`
- Modify: `dystopia/monolith/slices/profile/relations/profiles.rb`
- Modify: `dystopia/monolith/slices/profile/relations/casts.rb`
- Modify: `dystopia/monolith/slices/profile/repositories/profile_repository.rb`(全体を置き換える)
- Modify: `dystopia/monolith/slices/profile/repositories/cast_repository.rb`(全体を置き換える)
- Test: `dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb`(全体を置き換える)
- Test: `dystopia/monolith/spec/slices/profile/repositories/cast_repository_spec.rb`(全体を置き換える)
- Test: `dystopia/monolith/spec/slices/profile/relations/casts_spec.rb`

**Interfaces:**
- Consumes: なし
- Produces(`Profile::Slice["repositories.profile_repository"]`):
  - `find_by_id(id) -> struct | nil`(UUID 形式でなければ nil)
  - `find_by_username(username) -> struct | nil`
  - `list_by_account(account_id) -> Array<struct>`(作成順。UUID 形式でなければ `[]`)
  - `enabled_ids_by_account(account_id) -> Array<String>`(UUID 形式でなければ `[]`)
  - `username_available?(username, exclude_profile_id: nil) -> Boolean`
  - `create_within_limit(account_id:, limit:, attrs:) -> struct | nil`(上限に達していれば nil)
  - `update_profile(id, attrs) -> struct`
  - `save_media(profile_id:, avatar_media_id: nil, cover_media_id: nil)`
  - `profile_ids_by_prefecture(prefecture) -> Array<String>`
  - `list_recent(limit:, cursor: nil, exclude_profile_ids: [], role_filter: nil) -> Array<struct>`
  - `search_by_query(query:, limit: 20, cursor: nil, role_filter: nil) -> Array<struct>`
  - `role_of(profile_id) -> Integer | nil`
  - `delete_by_account(account_id)`
  - struct の属性: `id` / `account_id` / `username` / `display_name` / `bio` / `avatar_media_id` / `cover_media_id` / `website` / `prefecture` / `is_private` / `registered_at` / `disabled_at` / `created_at` / `updated_at`
- Produces(`Profile::Slice["repositories.cast_repository"]`):
  - `find_by_profile_id(profile_id) -> struct | nil`
  - `upsert(profile_id:, attrs:)`
  - `delete_by_profile_ids(profile_ids)`
- Produces(spec 用): `ProfileFixtures#create_account(role: 1) -> String`(account の id を返す)と `#create_account_with_profile(role: 1, account_id: nil, **profile_attrs) -> String`(profile の id を返す。`account_id:` を渡すとその account に profile を足し、渡さなければ `role:` の account を新しく作る)

- [ ] **Step 1: spec 用の fixture を作る**

`spec/support/profile_fixtures.rb`:

```ruby
# frozen_string_literal: true

require "securerandom"

module ProfileFixtures
  def create_account(role: 1)
    id = SecureRandom.uuid_v7
    fixture_db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
    id
  end

  def create_account_with_profile(role: 1, account_id: nil, **profile_attrs)
    owner_id = account_id || create_account(role: role)
    profile_id = SecureRandom.uuid_v7
    fixture_db[:profile__profiles].insert(
      { id: profile_id, account_id: owner_id, display_name: "User", is_private: false }.merge(profile_attrs)
    )
    profile_id
  end

  private

  def fixture_db
    Hanami.app["db.gateway"].connection
  end
end

RSpec.configure { |config| config.include ProfileFixtures }
```

- [ ] **Step 2: repository の spec を書く(失敗する)**

`spec/slices/profile/repositories/profile_repository_spec.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::ProfileRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:account_id) { create_account }

  def create_profile(owner: account_id, **attrs)
    repo.create({ id: SecureRandom.uuid_v7, account_id: owner, display_name: "Coco" }.merge(attrs))
  end

  describe "#find_by_id" do
    it "returns the profile by its own id" do
      profile = create_profile(username: "coco")
      expect(repo.find_by_id(profile.id).username).to eq("coco")
    end

    it "does not find a profile by its account id" do
      create_profile
      expect(repo.find_by_id(account_id)).to be_nil
    end

    it "returns nil for a value that is not a UUID" do
      expect(repo.find_by_id("not-a-uuid")).to be_nil
      expect(repo.find_by_id(nil)).to be_nil
    end
  end

  describe "#find_by_username" do
    it "matches case-insensitively" do
      profile = create_profile(username: "Coco")
      expect(repo.find_by_username("COCO").id).to eq(profile.id)
    end

    it "returns nil for blank input" do
      expect(repo.find_by_username("")).to be_nil
    end
  end

  describe "#list_by_account" do
    it "returns every profile of the account in creation order" do
      first = create_profile(created_at: Time.now - 60)
      second = create_profile(created_at: Time.now)
      create_profile(owner: create_account)

      expect(repo.list_by_account(account_id).map(&:id)).to eq([first.id, second.id])
    end

    it "returns an empty list for a value that is not a UUID" do
      expect(repo.list_by_account("sub-1")).to eq([])
    end
  end

  describe "#enabled_ids_by_account" do
    it "excludes disabled profiles" do
      enabled = create_profile
      create_profile(disabled_at: Time.now)

      expect(repo.enabled_ids_by_account(account_id)).to eq([enabled.id])
    end

    it "returns an empty list for a value that is not a UUID" do
      expect(repo.enabled_ids_by_account("sub-1")).to eq([])
    end
  end

  describe "#username_available?" do
    let!(:profile) { create_profile(username: "coco") }

    it "is false when taken (case-insensitive)" do
      expect(repo.username_available?("COCO")).to be false
    end

    it "is true when free" do
      expect(repo.username_available?("freename")).to be true
    end

    it "excludes the given profile so it can keep its own username" do
      expect(repo.username_available?("coco", exclude_profile_id: profile.id)).to be true
    end

    it "stays false for another profile of the same account" do
      sibling = create_profile
      expect(repo.username_available?("coco", exclude_profile_id: sibling.id)).to be false
    end
  end

  describe "#create_within_limit" do
    it "creates a profile with a new id that differs from the account id" do
      profile = repo.create_within_limit(account_id: account_id, limit: 1, attrs: { display_name: "Coco" })

      expect(profile.account_id).to eq(account_id)
      expect(profile.id).not_to eq(account_id)
    end

    it "returns nil without creating when the account is at the limit" do
      create_profile
      result = repo.create_within_limit(account_id: account_id, limit: 1, attrs: { display_name: "Second" })

      expect(result).to be_nil
      expect(repo.list_by_account(account_id).length).to eq(1)
    end

    it "counts disabled profiles toward the limit" do
      create_profile(disabled_at: Time.now)
      expect(repo.create_within_limit(account_id: account_id, limit: 1, attrs: { display_name: "Second" })).to be_nil
    end
  end

  describe "#update_profile" do
    it "updates only the addressed profile" do
      target = create_profile(display_name: "First")
      other = create_profile(display_name: "Other")

      repo.update_profile(target.id, display_name: "Second")

      expect(repo.find_by_id(target.id).display_name).to eq("Second")
      expect(repo.find_by_id(other.id).display_name).to eq("Other")
    end
  end

  describe "#save_media" do
    it "updates avatar and cover media ids" do
      profile = create_profile
      avatar = SecureRandom.uuid_v7
      cover = SecureRandom.uuid_v7

      repo.save_media(profile_id: profile.id, avatar_media_id: avatar, cover_media_id: cover)

      result = repo.find_by_id(profile.id)
      expect(result.avatar_media_id).to eq(avatar)
      expect(result.cover_media_id).to eq(cover)
    end
  end

  describe "#profile_ids_by_prefecture" do
    it "returns profile ids, not account ids" do
      profile = create_profile(prefecture: "東京都")
      create_profile(prefecture: "大阪府")

      expect(repo.profile_ids_by_prefecture("東京都")).to eq([profile.id])
    end
  end

  describe "#list_recent" do
    it "excludes the given profile ids and filters by the owning account's role" do
      cast_account = create_account(role: 2)
      cast_profile = create_profile(owner: cast_account)
      excluded = create_profile(owner: cast_account)
      create_profile

      rows = repo.list_recent(limit: 10, exclude_profile_ids: [excluded.id], role_filter: 2)

      expect(rows.map(&:id)).to eq([cast_profile.id])
    end
  end

  describe "#role_of" do
    it "returns the role of the owning account" do
      cast_account = create_account(role: 2)
      profile = create_profile(owner: cast_account)

      expect(repo.role_of(profile.id)).to eq(2)
    end

    it "returns nil for an unknown profile" do
      expect(repo.role_of(SecureRandom.uuid_v7)).to be_nil
    end
  end

  describe "#delete_by_account" do
    it "deletes every profile of the account and no others" do
      create_profile
      create_profile
      other = create_profile(owner: create_account)

      repo.delete_by_account(account_id)

      expect(repo.list_by_account(account_id)).to eq([])
      expect(repo.find_by_id(other.id)).not_to be_nil
    end
  end
end
```

`spec/slices/profile/repositories/cast_repository_spec.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::CastRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }

  describe "#find_by_profile_id" do
    it "returns nil when the cast row does not exist" do
      expect(repo.find_by_profile_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns the cast row when it exists" do
      profile_id = SecureRandom.uuid_v7
      repo.create(profile_id: profile_id)

      expect(repo.find_by_profile_id(profile_id).profile_id).to eq(profile_id)
    end
  end

  describe "#upsert" do
    it "creates a cast row when one does not exist" do
      profile_id = SecureRandom.uuid_v7

      repo.upsert(profile_id: profile_id, attrs: { age: 24, industry: "fuzoku" })

      cast = repo.find_by_profile_id(profile_id)
      expect(cast.age).to eq(24)
      expect(cast.industry).to eq("fuzoku")
    end

    it "updates the existing cast row instead of creating a second one" do
      profile_id = SecureRandom.uuid_v7
      repo.create(profile_id: profile_id)

      repo.upsert(profile_id: profile_id, attrs: { age: 30 })

      expect(repo.find_by_profile_id(profile_id).age).to eq(30)
    end
  end

  describe "#delete_by_profile_ids" do
    it "deletes only the given cast rows" do
      kept = SecureRandom.uuid_v7
      removed = SecureRandom.uuid_v7
      repo.create(profile_id: kept)
      repo.create(profile_id: removed)

      repo.delete_by_profile_ids([removed])

      expect(repo.find_by_profile_id(removed)).to be_nil
      expect(repo.find_by_profile_id(kept)).not_to be_nil
    end

    it "does nothing for an empty list" do
      expect { repo.delete_by_profile_ids([]) }.not_to raise_error
    end
  end
end
```

`spec/slices/profile/relations/casts_spec.rb` の 1 つ目の example を次に置き換える。

```ruby
  it "defines the narrowed schema" do
    expect(relation.schema.primary_key_name).to eq(:profile_id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to contain_exactly(:profile_id, :sns_links, :age, :body_stats, :industry, :created_at, :updated_at)
  end
```

- [ ] **Step 3: spec が失敗することを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/profile/repositories spec/slices/profile/relations/casts_spec.rb 2>&1 | tail -5`
Expected: FAIL。`find_by_id` などの未定義メソッド、または `id` カラムが無いことによるエラー。

- [ ] **Step 4: migration を書く**

`config/db/migrate/20261008000000_recreate_profiles_keyed_by_id.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"profile__casts", cascade: true
    drop_table :"profile__profiles", cascade: true

    create_table :"profile__profiles" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :username, :varchar, size: 30
      column :display_name, :text, null: false
      column :bio, :text
      column :avatar_media_id, :uuid
      column :cover_media_id, :uuid
      column :website, :text
      column :prefecture, :varchar, size: 50
      column :is_private, :boolean, null: false, default: false
      column :registered_at, :timestamptz
      column :disabled_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      index :account_id, name: :idx_profiles_account_id
    end

    add_index :"profile__profiles", Sequel.function(:lower, :username),
      unique: true, name: :idx_profiles_username_lower,
      where: Sequel.lit("username IS NOT NULL")

    create_table :"profile__casts" do
      column :profile_id, :uuid, null: false
      column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      column :age, :integer
      column :body_stats, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      column :industry, :varchar, size: 50
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:profile_id]
    end
  end

  down do
    raise Sequel::Error, "irreversible: profile rows are not restored"
  end
end
```

Run: `HANAMI_ENV=test bundle exec hanami db migrate`
Expected: エラー無く終わる。

- [ ] **Step 5: relation を更新する**

`slices/profile/relations/profiles.rb` の `schema` ブロックを次に置き換える。

```ruby
      schema(:"profile__profiles", as: :profiles, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :username, Types::String.optional
        attribute :display_name, Types::String
        attribute :bio, Types::String.optional
        attribute :avatar_media_id, Types::String.optional
        attribute :cover_media_id, Types::String.optional
        attribute :website, Types::String.optional
        attribute :prefecture, Types::String.optional
        attribute :is_private, Types::Bool
        attribute :registered_at, Types::Time.optional
        attribute :disabled_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
```

`slices/profile/relations/casts.rb` の `schema` ブロックを次に置き換える。

```ruby
      schema(:"profile__casts", as: :casts, infer: false) do
        attribute :profile_id, Types::String
        attribute :sns_links, Types::Hash
        attribute :age, Types::Integer.optional
        attribute :body_stats, Types::Hash
        attribute :industry, Types::String.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :profile_id
      end
```

- [ ] **Step 6: repository を実装する**

`slices/profile/repositories/profile_repository.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "securerandom"
require "concerns/cursor_pagination"

module Profile
  module Repositories
    class ProfileRepository < Profile::DB::Repo
      include ::Concerns::CursorPagination

      UUID_FORMAT = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

      commands :create, update: :by_pk

      def find_by_id(id)
        return nil unless uuid?(id)

        profiles.by_pk(id).one
      end

      def find_by_username(username)
        return nil if username.nil? || username.strip.empty?

        profiles.where { Sequel.function(:lower, :username) =~ username.downcase }.one
      end

      def list_by_account(account_id)
        return [] unless uuid?(account_id)

        profiles.where(account_id: account_id).order { [created_at.asc, id.asc] }.to_a
      end

      def enabled_ids_by_account(account_id)
        return [] unless uuid?(account_id)

        profiles.where(account_id: account_id, disabled_at: nil).pluck(:id)
      end

      def username_available?(username, exclude_profile_id: nil)
        return false if username.nil? || username.strip.empty?

        scope = profiles.where { Sequel.function(:lower, :username) =~ username.downcase }
        scope = scope.exclude(id: exclude_profile_id) if exclude_profile_id
        !scope.exist?
      end

      def create_within_limit(account_id:, limit:, attrs:)
        profiles.dataset.db.transaction do
          # Lock the account row so concurrent creations cannot both pass the count check.
          profiles.dataset.db[:identity__accounts].where(id: account_id).for_update.first
          next nil if profiles.where(account_id: account_id).count >= limit

          create(attrs.merge(id: SecureRandom.uuid_v7, account_id: account_id))
        end
      end

      def update_profile(id, attrs)
        update(id, attrs.merge(updated_at: Time.now))
      end

      def profile_ids_by_prefecture(prefecture)
        return [] if prefecture.nil? || prefecture.to_s.empty?

        profiles.where(prefecture: prefecture).pluck(:id)
      end

      def save_media(profile_id:, avatar_media_id: nil, cover_media_id: nil)
        attrs = {}
        attrs[:avatar_media_id] = avatar_media_id unless avatar_media_id.nil?
        attrs[:cover_media_id] = cover_media_id unless cover_media_id.nil?
        return if attrs.empty?

        update(profile_id, attrs.merge(updated_at: Time.now))
      end

      def list_recent(limit:, cursor: nil, exclude_profile_ids: [], role_filter: nil)
        scope = profiles
        scope = scope.exclude(id: exclude_profile_ids) unless exclude_profile_ids.empty?
        scope = filter_by_role(scope, role_filter)
        scope = apply_cursor(scope, cursor)

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def search_by_query(query:, limit: 20, cursor: nil, role_filter: nil)
        q = query.to_s.strip
        return [] if q.empty?

        pattern = "%#{q}%"
        scope = profiles.where(
          Sequel.|(
            Sequel.lit("username ILIKE ?", pattern),
            Sequel.lit("display_name ILIKE ?", pattern)
          )
        )
        scope = filter_by_role(scope, role_filter)
        scope = apply_cursor(scope, cursor)

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def role_of(profile_id)
        profile = find_by_id(profile_id)
        return nil unless profile

        profiles.dataset.db[:identity__accounts].where(id: profile.account_id).get(:role)
      end

      def delete_by_account(account_id)
        profiles.dataset.where(account_id: account_id).delete
      end

      private

      def uuid?(value)
        UUID_FORMAT.match?(value.to_s)
      end

      def filter_by_role(scope, role_filter)
        return scope unless role_filter && [1, 2].include?(role_filter)

        scope.where(
          account_id: profiles.dataset.db[:identity__accounts].where(role: role_filter).select(:id)
        )
      end

      def apply_cursor(scope, cursor)
        return scope unless cursor

        decoded = decode_cursor(cursor)
        return scope unless decoded

        scope.where {
          (created_at < decoded[:created_at]) |
            ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
        }
      end
    end
  end
end
```

`filter_by_role` と `apply_cursor` は、`list_recent` と `search_by_query` に重複していた同じ式をまとめたものである。この 2 メソッドは今回キーを `account_id` から `id` に変えるので、変更箇所を 1 つにしている。

`filter_by_role` の結合条件(`profiles.account_id` が該当 role の account に含まれる)は変更前と同じ式である。`account_id` が PK でなくなっても account を指すことは変わらないため、spec の Role resolution が述べる「`role_filter` を改める」作業は、実際にはこの式を保つことで満たされる。

`slices/profile/repositories/cast_repository.rb` を次の内容に置き換える。

```ruby
module Profile
  module Repositories
    class CastRepository < Profile::DB::Repo
      commands :create, update: :by_pk

      def find_by_profile_id(profile_id)
        casts.by_pk(profile_id).one
      end

      def upsert(profile_id:, attrs:)
        if casts.by_pk(profile_id).exist?
          update(profile_id, attrs.merge(updated_at: Time.now))
        else
          create(attrs.merge(profile_id: profile_id))
        end
      end

      def delete_by_profile_ids(profile_ids)
        return if profile_ids.empty?

        casts.dataset.where(profile_id: profile_ids).delete
      end
    end
  end
end
```

- [ ] **Step 7: spec が通ることを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/profile/repositories spec/slices/profile/relations/casts_spec.rb 2>&1 | tail -5`
Expected: `0 failures`

- [ ] **Step 8: Commit**

```bash
git add config/db/migrate/20261008000000_recreate_profiles_keyed_by_id.rb slices/profile/relations slices/profile/repositories spec/support/profile_fixtures.rb spec/slices/profile/repositories spec/slices/profile/relations/casts_spec.rb && git commit -s -m "feat(dystopia/monolith): key profiles by their own id under an owning account"
```

---

### Task 4: Request context

**Files:**
- Modify: `dystopia/monolith/lib/current.rb`(全体を置き換える)
- Modify: `dystopia/monolith/lib/interceptors/authentication_interceptor.rb`(全体を置き換える)
- Modify: `dystopia/monolith/lib/grpc/authenticatable.rb`(全体を置き換える)
- Modify: `dystopia/monolith/lib/interceptors/access_log_interceptor.rb`
- Test: `dystopia/monolith/spec/lib/interceptors/authentication_interceptor_spec.rb`(全体を置き換える)
- Test: `dystopia/monolith/spec/lib/interceptors/access_log_interceptor_spec.rb`
- Test: `dystopia/monolith/spec/lib/grpc/authenticatable_spec.rb`(新規)

**Interfaces:**
- Consumes: Task 3 の `ProfileRepository#find_by_id` / `#enabled_ids_by_account`、`ProfileFixtures`
- Produces:
  - `Current.account_id` / `Current.account_id=` / `Current.profile_id` / `Current.profile_id=` / `Current.request_id` / `Current.clear`。`Current.user_id` は無くなる。
  - `Grpc::Authenticatable#authenticate_account!`(account が無ければ `UNAUTHENTICATED`)
  - `Grpc::Authenticatable#authenticate_user!`(account が無ければ `UNAUTHENTICATED`、操作中の profile が無ければ `FAILED_PRECONDITION`)
  - `Grpc::Authenticatable#current_account_id` / `#current_profile_id`
  - `Grpc::Authenticatable#current_user_id`(`current_profile_id` と同じ値を返す。後続の段で削除する)

- [ ] **Step 1: spec を書く(失敗する)**

`spec/lib/interceptors/authentication_interceptor_spec.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/interceptors/authentication_interceptor"

RSpec.describe Interceptors::AuthenticationInterceptor, type: :database do
  let(:interceptor) { described_class.new(request, error) }
  let(:request) { double(:request, metadata: metadata, context: {}) }
  let(:error) { double(:error) }
  let(:metadata) { {} }
  let(:account_id) { create_account(role: 2) }

  def permission_denied
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::PERMISSION_DENIED) }
  end

  describe "#call" do
    context "when x-user-id metadata is absent" do
      it "leaves the account and the profile empty" do
        interceptor.call do
          expect(Current.account_id).to be_nil
          expect(Current.profile_id).to be_nil
        end
      end
    end

    context "with an Authorization: Bearer header only" do
      let(:metadata) { { "authorization" => "Bearer anything" } }

      it "does not extract an account from Bearer" do
        interceptor.call { expect(Current.account_id).to be_nil }
      end
    end

    context "when x-user-id is present without x-profile-id" do
      let(:metadata) { { "x-user-id" => account_id } }

      it "resolves the only enabled profile of the account" do
        profile_id = create_account_with_profile(account_id: account_id)

        interceptor.call do
          expect(Current.account_id).to eq(account_id)
          expect(Current.profile_id).to eq(profile_id)
        end
      end

      it "ignores disabled profiles when resolving the only enabled one" do
        enabled = create_account_with_profile(account_id: account_id)
        create_account_with_profile(account_id: account_id, disabled_at: Time.now)

        interceptor.call { expect(Current.profile_id).to eq(enabled) }
      end

      it "leaves the profile empty when the account has several enabled profiles" do
        create_account_with_profile(account_id: account_id)
        create_account_with_profile(account_id: account_id)

        interceptor.call do
          expect(Current.account_id).to eq(account_id)
          expect(Current.profile_id).to be_nil
        end
      end

      it "leaves the profile empty when the account has no profile" do
        interceptor.call { expect(Current.profile_id).to be_nil }
      end
    end

    context "when x-user-id is not a UUID" do
      let(:metadata) { { "x-user-id" => "sub-1" } }

      it "keeps the account and resolves no profile" do
        interceptor.call do
          expect(Current.account_id).to eq("sub-1")
          expect(Current.profile_id).to be_nil
        end
      end
    end

    context "when x-profile-id is present" do
      let(:metadata) { { "x-user-id" => account_id, "x-profile-id" => requested } }
      let(:own_profile) { create_account_with_profile(account_id: account_id) }

      context "and it is an enabled profile of the account" do
        let(:requested) { own_profile }

        it "uses the requested profile even when the account has several" do
          create_account_with_profile(account_id: account_id)

          interceptor.call { expect(Current.profile_id).to eq(own_profile) }
        end
      end

      context "and it belongs to another account" do
        let(:requested) { create_account_with_profile }

        it "rejects the call" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it is disabled" do
        let(:requested) { create_account_with_profile(account_id: account_id, disabled_at: Time.now) }

        it "rejects the call" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it does not exist" do
        let(:requested) { SecureRandom.uuid_v7 }

        it "rejects the call" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it is not a UUID" do
        let(:requested) { "'; DROP TABLE profiles; --" }

        it "rejects the call without a database error" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it is an empty string" do
        let(:requested) { "" }

        it "falls back to the only enabled profile" do
          own_profile

          interceptor.call { expect(Current.profile_id).to eq(own_profile) }
        end
      end
    end

    it "propagates or generates a request id" do
      interceptor.call { expect(Current.request_id).not_to be_nil }
    end

    it "clears Current after the block" do
      interceptor.call {}

      expect(Current.account_id).to be_nil
      expect(Current.profile_id).to be_nil
      expect(Current.request_id).to be_nil
    end

    context "when the call is rejected" do
      let(:metadata) { { "x-user-id" => account_id, "x-profile-id" => SecureRandom.uuid_v7 } }

      it "still clears Current" do
        expect { interceptor.call {} }.to raise_error(GRPC::BadStatus)

        expect(Current.account_id).to be_nil
      end
    end
  end
end
```

`spec/lib/grpc/authenticatable_spec.rb` を新規に作る。

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/grpc/authenticatable"

RSpec.describe Grpc::Authenticatable do
  subject(:host) { Class.new { include Grpc::Authenticatable }.new }

  after { Current.clear }

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  describe "#authenticate_account!" do
    it "raises UNAUTHENTICATED without an account" do
      expect { host.authenticate_account! }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end

    it "passes with an account even when no profile is active" do
      Current.account_id = "acc-1"

      expect { host.authenticate_account! }.not_to raise_error
    end
  end

  describe "#authenticate_user!" do
    it "raises UNAUTHENTICATED without an account" do
      expect { host.authenticate_user! }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end

    it "raises FAILED_PRECONDITION with an account but no active profile" do
      Current.account_id = "acc-1"

      expect { host.authenticate_user! }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end

    it "passes with an account and an active profile" do
      Current.account_id = "acc-1"
      Current.profile_id = "prof-1"

      expect { host.authenticate_user! }.not_to raise_error
    end
  end

  it "exposes the account and the profile separately" do
    Current.account_id = "acc-1"
    Current.profile_id = "prof-1"

    expect(host.current_account_id).to eq("acc-1")
    expect(host.current_profile_id).to eq("prof-1")
  end

  it "returns the profile id from current_user_id" do
    Current.account_id = "acc-1"
    Current.profile_id = "prof-1"

    expect(host.current_user_id).to eq("prof-1")
  end
end
```

`spec/lib/interceptors/access_log_interceptor_spec.rb` には `user_id` を含む行が 5 つある。次のように置き換える。

| 変更前 | 変更後 |
|---|---|
| `::Current.user_id = "user-123"` | `::Current.account_id = "user-123"` と `::Current.profile_id = "profile-123"` の 2 行 |
| `expect(log["user_id"]).to eq("user-123")` | `expect(log["account_id"]).to eq("user-123")` と `expect(log["profile_id"]).to eq("profile-123")` の 2 行 |
| `::Current.user_id = "user-456"` | `::Current.account_id = "user-456"` と `::Current.profile_id = "profile-456"` の 2 行 |
| `expect(log["user_id"]).to eq("user-456")` | `expect(log["account_id"]).to eq("user-456")` と `expect(log["profile_id"]).to eq("profile-456")` の 2 行 |
| `expect(log["user_id"]).to be_nil` | `expect(log["account_id"]).to be_nil` と `expect(log["profile_id"]).to be_nil` の 2 行 |

Run: `/usr/bin/grep -n 'user_id' spec/lib/interceptors/access_log_interceptor_spec.rb`
Expected: 出力なし。

- [ ] **Step 2: spec が失敗することを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/lib 2>&1 | tail -5`
Expected: FAIL。`Current.account_id` などの未定義メソッド。

- [ ] **Step 3: `Current` を実装する**

`lib/current.rb` を次の内容に置き換える。

```ruby
module Current
  def self.account_id=(id)
    Thread.current[:monolith_current_account_id] = id
  end

  def self.account_id
    Thread.current[:monolith_current_account_id]
  end

  def self.profile_id=(id)
    Thread.current[:monolith_current_profile_id] = id
  end

  def self.profile_id
    Thread.current[:monolith_current_profile_id]
  end

  def self.request_id=(id)
    Thread.current[:monolith_current_request_id] = id
  end

  def self.request_id
    Thread.current[:monolith_current_request_id]
  end

  def self.clear
    Thread.current[:monolith_current_account_id] = nil
    Thread.current[:monolith_current_profile_id] = nil
    Thread.current[:monolith_current_request_id] = nil
  end
end
```

- [ ] **Step 4: interceptor を実装する**

`lib/interceptors/authentication_interceptor.rb` を次の内容に置き換える。

```ruby
require "gruf"
require "securerandom"

module Interceptors
  class AuthenticationInterceptor < Gruf::Interceptors::ServerInterceptor
    def call
      ::Current.clear

      request_id = request.metadata["x-request-id"] || SecureRandom.uuid
      ::Current.request_id = request_id
      request.context[:request_id] = request_id

      if (account_id = request.metadata["x-user-id"])
        ::Current.account_id = account_id
        ::Current.profile_id = resolve_profile_id(account_id, request.metadata["x-profile-id"])
      end

      yield
    ensure
      ::Current.clear
    end

    private

    def resolve_profile_id(account_id, requested_id)
      if requested_id.nil? || requested_id.empty?
        # Leave the profile empty when ambiguous so a missing header never acts as an unintended profile.
        enabled_ids = profile_repository.enabled_ids_by_account(account_id)
        return enabled_ids.length == 1 ? enabled_ids.first : nil
      end

      profile = profile_repository.find_by_id(requested_id)
      permitted = profile && profile.account_id == account_id && profile.disabled_at.nil?
      unless permitted
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Profile is not available")
      end

      profile.id
    end

    def profile_repository
      @profile_repository ||= ::Profile::Slice["repositories.profile_repository"]
    end
  end
end
```

- [ ] **Step 5: `Authenticatable` を実装する**

`lib/grpc/authenticatable.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

module Grpc
  module Authenticatable
    def authenticate_account!
      return if current_account_id

      raise GRPC::BadStatus.new(
        GRPC::Core::StatusCodes::UNAUTHENTICATED,
        "Authentication required"
      )
    end

    def authenticate_user!
      authenticate_account!
      return if current_profile_id

      raise GRPC::BadStatus.new(
        GRPC::Core::StatusCodes::FAILED_PRECONDITION,
        "Active profile required"
      )
    end

    def current_account_id
      ::Current.account_id
    end

    def current_profile_id
      ::Current.profile_id
    end

    # TODO: Remove once every slice reads current_profile_id.
    def current_user_id
      ::Current.profile_id
    end
  end
end
```

- [ ] **Step 6: access log を更新する**

`lib/interceptors/access_log_interceptor.rb` には `user_id: ::Current.user_id,` の行が 2 箇所ある。両方を次の 2 行に置き換える。

```ruby
        account_id: ::Current.account_id,
        profile_id: ::Current.profile_id,
```

- [ ] **Step 7: spec が通ることを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/lib 2>&1 | tail -5`
Expected: `0 failures`

Run: `/usr/bin/grep -rn 'Current\.user_id' lib`
Expected: 出力なし。

- [ ] **Step 8: Commit**

```bash
git add lib/current.rb lib/interceptors lib/grpc/authenticatable.rb spec/lib && git commit -s -m "feat(dystopia/monolith): resolve the acting profile separately from the account"
```

---

### Task 5: Profile use cases

**Files:**
- Create: `dystopia/monolith/slices/profile/use_cases/get_role.rb`
- Create: `dystopia/monolith/slices/profile/use_cases/list_my_profiles.rb`
- Create: `dystopia/monolith/slices/profile/use_cases/create_profile.rb`
- Create: `dystopia/monolith/slices/profile/use_cases/list_profile_ids_by_prefecture.rb`
- Delete: `dystopia/monolith/slices/profile/use_cases/list_account_ids_by_prefecture.rb`
- Modify: `dystopia/monolith/slices/profile/use_cases/get_profile.rb`
- Modify: `dystopia/monolith/slices/profile/use_cases/save_profile.rb`(全体を置き換える)
- Modify: `dystopia/monolith/slices/profile/use_cases/save_profile_media.rb`
- Modify: `dystopia/monolith/slices/profile/use_cases/check_username_availability.rb`
- Modify: `dystopia/monolith/slices/profile/use_cases/purge_account.rb`
- Test: `dystopia/monolith/spec/slices/profile/use_cases/` 配下(下記)

**Interfaces:**
- Consumes: Task 3 の repository、`ProfileFixtures`
- Produces(`Profile::Slice["use_cases.<name>"]`):
  - `get_profile.call(profile_id:) -> struct | nil`
  - `get_profile_by_username.call(username:) -> struct | nil`(変更なし)
  - `get_role.call(profile_id:) -> Integer | nil`(1 = guest、2 = cast)
  - `list_my_profiles.call(account_id:) -> Array<struct>`
  - `create_profile.call(account_id:, display_name:, username: nil) -> struct`。上限超過で `Profile::UseCases::CreateProfile::LimitExceededError`、入力不正で `Errors::ValidationError`
  - `save_profile.call(profile_id:, display_name:, username: nil, bio: nil, website: nil, sns_links: {}, prefecture: nil, is_private: false, age: nil, body_stats: {}, industry: nil) -> struct | nil`(profile が無ければ nil)
  - `save_profile_media.call(profile_id:, avatar_media_id: nil, cover_media_id: nil) -> struct | nil`
  - `check_username_availability.call(username:, profile_id: nil) -> { available:, message: }`
  - `list_profile_ids_by_prefecture.call(prefecture:) -> Array<String>`
  - `purge_account.call(account_id:) -> nil`(account の全 profile と cast 行を消す)

- [ ] **Step 1: spec を書く(失敗する)**

`spec/slices/profile/use_cases/create_profile_spec.rb`(新規):

```ruby
# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Profile::UseCases::CreateProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.create_profile"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:limit_error) { Profile::UseCases::CreateProfile::LimitExceededError }

  context "for a guest account" do
    let(:account_id) { create_account(role: 1) }

    it "creates the first profile with an id that differs from the account id" do
      profile = uc.call(account_id: account_id, display_name: "Taro", username: "taro_01")

      expect(profile.account_id).to eq(account_id)
      expect(profile.id).not_to eq(account_id)
      expect(profile.username).to eq("taro_01")
    end

    it "rejects a second profile" do
      uc.call(account_id: account_id, display_name: "Taro")

      expect { uc.call(account_id: account_id, display_name: "Taro 2") }.to raise_error(limit_error)
    end
  end

  context "for a cast account" do
    let(:account_id) { create_account(role: 2) }

    it "allows up to five profiles and rejects the sixth" do
      5.times { |i| uc.call(account_id: account_id, display_name: "Persona #{i}") }

      expect(repo.list_by_account(account_id).length).to eq(5)
      expect { uc.call(account_id: account_id, display_name: "Persona 6") }.to raise_error(limit_error)
    end

    it "counts disabled profiles toward the limit" do
      4.times { |i| uc.call(account_id: account_id, display_name: "Persona #{i}") }
      create_account_with_profile(account_id: account_id, disabled_at: Time.now)

      expect { uc.call(account_id: account_id, display_name: "Persona 6") }.to raise_error(limit_error)
    end

    it "rejects a username already used by another profile of the same account" do
      uc.call(account_id: account_id, display_name: "First", username: "shared_name")

      expect {
        uc.call(account_id: account_id, display_name: "Second", username: "SHARED_NAME")
      }.to raise_error(Errors::ValidationError)
    end
  end

  context "when the account row does not exist" do
    it "applies the single-profile limit" do
      account_id = SecureRandom.uuid_v7
      uc.call(account_id: account_id, display_name: "Solo")

      expect { uc.call(account_id: account_id, display_name: "Solo 2") }.to raise_error(limit_error)
    end
  end

  it "rejects a blank or whitespace-only display name" do
    account_id = create_account
    expect { uc.call(account_id: account_id, display_name: "") }.to raise_error(Errors::ValidationError)
    expect { uc.call(account_id: account_id, display_name: "   ") }.to raise_error(Errors::ValidationError)
  end

  it "rejects a display name longer than 50 characters" do
    expect {
      uc.call(account_id: create_account, display_name: "あ" * 51)
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects an invalid username format" do
    expect {
      uc.call(account_id: create_account, display_name: "Coco", username: "ab")
    }.to raise_error(Errors::ValidationError)
  end

  it "does not create a profile when validation fails" do
    account_id = create_account
    expect { uc.call(account_id: account_id, display_name: "") }.to raise_error(Errors::ValidationError)

    expect(repo.list_by_account(account_id)).to eq([])
  end
end
```

`spec/slices/profile/use_cases/save_profile_spec.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Profile::UseCases::SaveProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.save_profile"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }
  let(:account_id) { create_account(role: 1) }
  let(:profile_id) { create_account_with_profile(account_id: account_id, username: "coco_01") }

  it "updates the addressed profile" do
    profile = uc.call(profile_id: profile_id, display_name: "Coco", bio: "hello")

    expect(profile.id).to eq(profile_id)
    expect(profile.display_name).to eq("Coco")
    expect(profile.bio).to eq("hello")
  end

  it "does not touch another profile of the same account" do
    cast_account = create_account(role: 2)
    target = create_account_with_profile(account_id: cast_account, display_name: "Target")
    sibling = create_account_with_profile(account_id: cast_account, display_name: "Sibling")

    uc.call(profile_id: target, display_name: "Renamed")

    expect(repo.find_by_id(sibling).display_name).to eq("Sibling")
  end

  it "returns nil and creates nothing when the profile does not exist" do
    missing = SecureRandom.uuid_v7

    expect(uc.call(profile_id: missing, display_name: "Coco")).to be_nil
    expect(repo.find_by_id(missing)).to be_nil
  end

  it "rejects a missing display_name" do
    expect { uc.call(profile_id: profile_id, display_name: "") }.to raise_error(Errors::ValidationError)
  end

  it "rejects a bio longer than 1000 chars" do
    expect {
      uc.call(profile_id: profile_id, display_name: "Coco", bio: "あ" * 1001)
    }.to raise_error(Errors::ValidationError)
  end

  it "accepts a bio up to 1000 chars" do
    profile = uc.call(profile_id: profile_id, display_name: "Coco", bio: "あ" * 1000)
    expect(profile.bio.length).to eq(1000)
  end

  it "rejects an invalid username format" do
    expect {
      uc.call(profile_id: profile_id, display_name: "Coco", username: "ab")
    }.to raise_error(Errors::ValidationError)
  end

  it "keeps its own username without a conflict" do
    profile = uc.call(profile_id: profile_id, display_name: "Coco", username: "coco_01")
    expect(profile.username).to eq("coco_01")
  end

  it "rejects a username taken by a profile of another account" do
    create_account_with_profile(username: "taken_01")

    expect {
      uc.call(profile_id: profile_id, display_name: "Coco", username: "TAKEN_01")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects a username taken by another profile of the same account" do
    cast_account = create_account(role: 2)
    create_account_with_profile(account_id: cast_account, username: "persona_a")
    other = create_account_with_profile(account_id: cast_account, username: "persona_b")

    expect {
      uc.call(profile_id: other, display_name: "Coco", username: "persona_a")
    }.to raise_error(Errors::ValidationError)
  end

  it "persists cast extras on the cast row of the addressed profile for a cast account" do
    cast_account = create_account(role: 2)
    cast_profile = create_account_with_profile(account_id: cast_account)
    sibling = create_account_with_profile(account_id: cast_account)

    uc.call(
      profile_id: cast_profile, display_name: "Coco", age: 24, industry: "fuzoku",
      sns_links: { "x" => "https://x.com/coco" },
      body_stats: { "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D" }
    )

    cast = cast_repo.find_by_profile_id(cast_profile)
    expect(cast.age).to eq(24)
    expect(cast.industry).to eq("fuzoku")
    expect(cast.sns_links).to eq("x" => "https://x.com/coco")
    expect(cast.body_stats).to eq(
      "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D"
    )
    expect(cast_repo.find_by_profile_id(sibling)).to be_nil
  end

  it "does not create a cast row for a guest account" do
    uc.call(profile_id: profile_id, display_name: "Coco", age: 24, body_stats: { "height_cm" => 158 })

    expect(cast_repo.find_by_profile_id(profile_id)).to be_nil
  end
end
```

`spec/slices/profile/use_cases/get_role_spec.rb`(新規):

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::GetRole", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.get_role"] }

  it "returns the role of the account that owns the profile" do
    expect(uc.call(profile_id: create_account_with_profile(role: 2))).to eq(2)
    expect(uc.call(profile_id: create_account_with_profile(role: 1))).to eq(1)
  end

  it "returns nil when given an account id instead of a profile id" do
    account_id = create_account(role: 2)
    create_account_with_profile(account_id: account_id)

    expect(uc.call(profile_id: account_id)).to be_nil
  end

  it "returns nil for a blank or malformed id" do
    expect(uc.call(profile_id: nil)).to be_nil
    expect(uc.call(profile_id: "viewer-1")).to be_nil
  end
end
```

`spec/slices/profile/use_cases/list_my_profiles_spec.rb`(新規):

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::ListMyProfiles", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.list_my_profiles"] }

  it "returns enabled and disabled profiles of the account and none of other accounts" do
    account_id = create_account(role: 2)
    enabled = create_account_with_profile(account_id: account_id)
    disabled = create_account_with_profile(account_id: account_id, disabled_at: Time.now)
    create_account_with_profile

    expect(uc.call(account_id: account_id).map(&:id)).to contain_exactly(enabled, disabled)
  end

  it "returns an empty list for an account without a profile" do
    expect(uc.call(account_id: create_account)).to eq([])
  end
end
```

`spec/slices/profile/use_cases/get_profile_spec.rb`(新規):

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::GetProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.get_profile"] }

  it "finds a profile by its id" do
    profile_id = create_account_with_profile(username: "coco_u")
    expect(uc.call(profile_id: profile_id).username).to eq("coco_u")
  end

  it "returns nil for a blank id" do
    expect(uc.call(profile_id: nil)).to be_nil
    expect(uc.call(profile_id: "")).to be_nil
  end
end
```

`spec/slices/profile/use_cases/get_profile_by_username_spec.rb` の 1 つ目の example を次に置き換える。

```ruby
  it "finds by username case-insensitively" do
    profile_id = create_account_with_profile(username: "coco_u")
    expect(uc.call(username: "COCO_U").id).to eq(profile_id)
  end
```

同ファイルの `let(:repo)` の行は使わなくなるので削除する。

`spec/slices/profile/use_cases/check_username_availability_spec.rb` の 3 つ目の example を次に置き換え、その下に 1 つ足す。`let(:repo)` の行は削除する。

```ruby
  it "is unavailable when taken (case-insensitive)" do
    create_account_with_profile(username: "dup_name")
    expect(uc.call(username: "DUP_NAME")[:available]).to be false
  end

  it "is available to the profile that already holds the username" do
    profile_id = create_account_with_profile(username: "mine_01")
    expect(uc.call(username: "mine_01", profile_id: profile_id)[:available]).to be true
  end
```

`spec/slices/profile/use_cases/purge_account_spec.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::PurgeAccount", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.purge_account"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }

  it "deletes every profile and cast row of the account and leaves other accounts" do
    account_id = create_account(role: 2)
    first = create_account_with_profile(account_id: account_id)
    second = create_account_with_profile(account_id: account_id)
    cast_repo.create(profile_id: first)
    cast_repo.create(profile_id: second)
    other = create_account_with_profile(role: 2)
    cast_repo.create(profile_id: other)

    uc.call(account_id: account_id)

    expect(repo.list_by_account(account_id)).to eq([])
    expect(cast_repo.find_by_profile_id(first)).to be_nil
    expect(cast_repo.find_by_profile_id(second)).to be_nil
    expect(repo.find_by_id(other)).not_to be_nil
    expect(cast_repo.find_by_profile_id(other)).not_to be_nil
  end

  it "returns nil" do
    expect(uc.call(account_id: create_account)).to be_nil
  end
end
```

- [ ] **Step 2: spec が失敗することを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/profile/use_cases 2>&1 | tail -5`
Expected: FAIL。未登録の use case、または引数名の不一致。

- [ ] **Step 3: use case を実装する**

`slices/profile/use_cases/get_profile.rb` の `call` を次に置き換える。

```ruby
      def call(profile_id:)
        profile_repository.find_by_id(profile_id)
      end
```

`slices/profile/use_cases/get_role.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class GetRole
      include Deps["repositories.profile_repository"]

      def call(profile_id:)
        profile_repository.role_of(profile_id)
      end
    end
  end
end
```

`slices/profile/use_cases/list_my_profiles.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class ListMyProfiles
      include Deps["repositories.profile_repository"]

      def call(account_id:)
        profile_repository.list_by_account(account_id)
      end
    end
  end
end
```

`slices/profile/use_cases/create_profile.rb`:

```ruby
# frozen_string_literal: true

require "errors/validation_error"

module Profile
  module UseCases
    class CreateProfile
      class LimitExceededError < StandardError; end

      include Deps["repositories.profile_repository"]

      ROLE_CAST = 2
      CAST_PROFILE_LIMIT = 5
      SINGLE_PROFILE_LIMIT = 1

      def call(account_id:, display_name:, username: nil)
        validate_display_name!(display_name)
        validate_username!(username) unless username.nil?

        attrs = { display_name: display_name }
        attrs[:username] = username unless username.nil?

        profile = profile_repository.create_within_limit(
          account_id: account_id,
          limit: limit_for(account_id),
          attrs: attrs
        )
        raise LimitExceededError, "作成できるプロフィールの上限に達しています" unless profile

        profile
      end

      private

      def limit_for(account_id)
        role = identity_account_repo.find_by_id(account_id)&.role
        role == ROLE_CAST ? CAST_PROFILE_LIMIT : SINGLE_PROFILE_LIMIT
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def validate_display_name!(value)
        if value.nil? || value.strip.empty?
          raise Errors::ValidationError, "表示名は必須です"
        end
        if value.length > SaveProfile::DISPLAY_NAME_MAX
          raise Errors::ValidationError, "表示名は#{SaveProfile::DISPLAY_NAME_MAX}文字以内で入力してください"
        end
      end

      def validate_username!(value)
        unless value.match?(SaveProfile::USERNAME_FORMAT)
          raise Errors::ValidationError, "ユーザー名は半角英数字とアンダースコア3〜30文字です"
        end
        unless profile_repository.username_available?(value)
          raise Errors::ValidationError, "このユーザー名は使用できません"
        end
      end
    end
  end
end
```

`slices/profile/use_cases/save_profile.rb` を次の内容に置き換える。

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
      ROLE_CAST = 2

      def call(profile_id:, display_name:, username: nil, bio: nil, website: nil,
               sns_links: {}, prefecture: nil, is_private: false, age: nil,
               body_stats: {}, industry: nil)
        return nil unless profile_repository.find_by_id(profile_id)

        validate_display_name!(display_name)
        validate_bio!(bio)
        validate_username!(username, profile_id) unless username.nil?

        attrs = {
          display_name: display_name,
          bio: bio,
          website: website,
          prefecture: prefecture,
          is_private: is_private ? true : false
        }
        attrs[:username] = username unless username.nil?

        profile_repository.update_profile(profile_id, attrs)

        if profile_repository.role_of(profile_id) == ROLE_CAST
          cast_repository.upsert(
            profile_id: profile_id,
            attrs: {
              sns_links: Sequel.pg_jsonb(sns_links || {}),
              age: age,
              body_stats: Sequel.pg_jsonb(body_stats || {}),
              industry: industry
            }
          )
        end

        profile_repository.find_by_id(profile_id)
      end

      private

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

      def validate_username!(value, profile_id)
        unless value.match?(USERNAME_FORMAT)
          raise Errors::ValidationError, "ユーザー名は半角英数字とアンダースコア3〜30文字です"
        end
        unless profile_repository.username_available?(value, exclude_profile_id: profile_id)
          raise Errors::ValidationError, "このユーザー名は使用できません"
        end
      end
    end
  end
end
```

`slices/profile/use_cases/save_profile_media.rb` の `call` を次に置き換える。

```ruby
      def call(profile_id:, avatar_media_id: nil, cover_media_id: nil)
        return nil unless profile_repository.find_by_id(profile_id)

        profile_repository.save_media(
          profile_id: profile_id,
          avatar_media_id: avatar_media_id,
          cover_media_id: cover_media_id
        )
        profile_repository.find_by_id(profile_id)
      end
```

`slices/profile/use_cases/check_username_availability.rb` の `call` を次に置き換える。

```ruby
      def call(username:, profile_id: nil)
        if username.nil? || !username.match?(USERNAME_FORMAT)
          return { available: false, message: "ユーザー名は半角英数字とアンダースコア3〜30文字です" }
        end

        if profile_repository.username_available?(username, exclude_profile_id: profile_id)
          { available: true, message: "" }
        else
          { available: false, message: "このユーザー名は使用されています" }
        end
      end
```

`slices/profile/use_cases/list_account_ids_by_prefecture.rb` を削除し、`slices/profile/use_cases/list_profile_ids_by_prefecture.rb` を作る。

```bash
git rm -q slices/profile/use_cases/list_account_ids_by_prefecture.rb
```

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class ListProfileIdsByPrefecture
      include Deps["repositories.profile_repository"]

      def call(prefecture:)
        profile_repository.profile_ids_by_prefecture(prefecture)
      end
    end
  end
end
```

`slices/profile/use_cases/purge_account.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class PurgeAccount
      include Profile::Deps[
        profile_repo: "repositories.profile_repository",
        cast_repo: "repositories.cast_repository"
      ]

      def call(account_id:)
        profile_ids = profile_repo.list_by_account(account_id).map(&:id)
        cast_repo.delete_by_profile_ids(profile_ids)
        profile_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 4: spec が通ることを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/profile/use_cases spec/slices/profile/repositories 2>&1 | tail -5`
Expected: `0 failures`

- [ ] **Step 5: Commit**

```bash
git add slices/profile/use_cases spec/slices/profile/use_cases && git commit -s -m "feat(dystopia/monolith): create and address profiles by profile id"
```

---

### Task 6: Profile handler and presenter

**Files:**
- Modify: `dystopia/monolith/slices/profile/presenters/profile_presenter.rb`
- Modify: `dystopia/monolith/slices/profile/grpc/profile_handler.rb`
- Test: `dystopia/monolith/spec/slices/profile/presenters/profile_presenter_spec.rb`
- Test: `dystopia/monolith/spec/slices/profile/grpc/profile_handler_spec.rb`(新規)

**Interfaces:**
- Consumes: Task 2 の stub、Task 4 の `authenticate_account!` / `authenticate_user!` / `current_account_id` / `current_profile_id`、Task 5 の use case
- Produces:
  - `Profile::Presenters::ProfilePresenter.to_proto(profile, cast: nil, media_files: {}, role: 0, own: false) -> Profile::V1::Profile`。`id` に profile の id が入る。`disabled` は `own: true` のときだけ実際の状態を返し、それ以外は常に false。
  - gRPC `ListMyProfiles` / `CreateProfile`

- [ ] **Step 1: spec を書く(失敗する)**

`spec/slices/profile/presenters/profile_presenter_spec.rb` の `profile_struct` を次に置き換える。

```ruby
  let(:profile_struct) do
    Struct.new(:id, :account_id, :username, :display_name, :bio, :avatar_media_id, :cover_media_id,
      :website, :prefecture, :is_private, :registered_at, :disabled_at)
  end
```

同ファイルの `profile_struct.new("acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil)` は 3 箇所ある。すべて次に置き換える。

```ruby
profile_struct.new("prof-1", "acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil, nil)
```

`describe ".to_proto"` の末尾に次の example を足す。

```ruby
    it "exposes the profile id and has no field for the account id" do
      profile = profile_struct.new("prof-1", "acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil, nil)

      proto = described_class.to_proto(profile)

      expect(proto.id).to eq("prof-1")
      expect(::Profile::V1::Profile.descriptor.map(&:name)).not_to include("account_id")
      expect(proto.to_h.values).not_to include("acc-1")
    end

    it "reports the disabled state only for the owner" do
      profile = profile_struct.new("prof-1", "acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil, Time.now)

      expect(described_class.to_proto(profile, own: true).disabled).to be true
      expect(described_class.to_proto(profile).disabled).to be false
    end
```

`spec/slices/profile/grpc/profile_handler_spec.rb`(新規):

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/profile/grpc/profile_handler"

RSpec.describe Profile::Grpc::ProfileHandler, type: :database do
  def handler_for(message)
    described_class.new(method_key: :test, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  after { Current.clear }

  describe "#list_my_profiles" do
    let(:handler) { handler_for(::Profile::V1::ListMyProfilesRequest.new) }

    it "returns every profile of the account without requiring an active profile" do
      account_id = create_account(role: 2)
      enabled = create_account_with_profile(account_id: account_id)
      disabled = create_account_with_profile(account_id: account_id, disabled_at: Time.now)
      Current.account_id = account_id

      profiles = handler.list_my_profiles.profiles

      expect(profiles.map(&:id)).to contain_exactly(enabled, disabled)
      expect(profiles.find { |p| p.id == disabled }.disabled).to be true
      expect(profiles.map(&:role).uniq).to eq([2])
    end

    it "raises UNAUTHENTICATED without an account" do
      expect { handler.list_my_profiles }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end
  end

  describe "#create_profile" do
    let(:handler) { handler_for(::Profile::V1::CreateProfileRequest.new(display_name: "Coco", username: "coco_01")) }

    it "creates the first profile for an account that has none" do
      account_id = create_account(role: 1)
      Current.account_id = account_id

      profile = handler.create_profile.profile

      expect(profile.username).to eq("coco_01")
      expect(profile.id).not_to eq(account_id)
    end

    it "raises FAILED_PRECONDITION when the account is at its limit" do
      account_id = create_account(role: 1)
      create_account_with_profile(account_id: account_id)
      Current.account_id = account_id

      expect { handler.create_profile }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end

    it "raises INVALID_ARGUMENT for a taken username" do
      create_account_with_profile(username: "coco_01")
      Current.account_id = create_account(role: 1)

      expect { handler.create_profile }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "#get_profile" do
    it "returns the active profile when the request names none" do
      account_id = create_account(role: 1)
      profile_id = create_account_with_profile(account_id: account_id)
      Current.account_id = account_id
      Current.profile_id = profile_id

      response = handler_for(::Profile::V1::GetProfileRequest.new).get_profile

      expect(response.profile.id).to eq(profile_id)
    end

    it "raises FAILED_PRECONDITION when the account has no active profile" do
      Current.account_id = create_account(role: 2)

      expect {
        handler_for(::Profile::V1::GetProfileRequest.new).get_profile
      }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end

    it "does not report the disabled state of a profile owned by another account" do
      other = create_account_with_profile(disabled_at: Time.now)
      account_id = create_account(role: 1)
      Current.account_id = account_id
      Current.profile_id = create_account_with_profile(account_id: account_id)

      response = handler_for(::Profile::V1::GetProfileRequest.new(profile_id: other)).get_profile

      expect(response.profile.disabled).to be false
    end
  end

  describe "#save_profile" do
    it "updates only the active profile of a multi-profile account" do
      account_id = create_account(role: 2)
      active = create_account_with_profile(account_id: account_id, display_name: "Active")
      sibling = create_account_with_profile(account_id: account_id, display_name: "Sibling")
      Current.account_id = account_id
      Current.profile_id = active

      handler_for(::Profile::V1::SaveProfileRequest.new(display_name: "Renamed")).save_profile

      repo = Hanami.app.slices[:profile]["repositories.profile_repository"]
      expect(repo.find_by_id(active).display_name).to eq("Renamed")
      expect(repo.find_by_id(sibling).display_name).to eq("Sibling")
    end

    it "raises FAILED_PRECONDITION for a multi-profile account without an active profile" do
      Current.account_id = create_account(role: 2)

      expect {
        handler_for(::Profile::V1::SaveProfileRequest.new(display_name: "Renamed")).save_profile
      }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end
  end

  describe "#check_username_availability" do
    it "works for an account that has no profile yet" do
      Current.account_id = create_account(role: 1)

      response = handler_for(::Profile::V1::CheckUsernameAvailabilityRequest.new(username: "fresh_name")).check_username_availability

      expect(response.available).to be true
    end
  end
end
```

- [ ] **Step 2: spec が失敗することを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/profile/presenters spec/slices/profile/grpc 2>&1 | tail -5`
Expected: FAIL。`list_my_profiles` が未定義、または presenter が `account_id=` を呼んで失敗する。

- [ ] **Step 3: presenter を更新する**

`slices/profile/presenters/profile_presenter.rb` の `to_proto` の冒頭 4 行と末尾を次のように変える。

```ruby
        def to_proto(profile, cast: nil, media_files: {}, role: 0, own: false)
          return nil unless profile

          ::Profile::V1::Profile.new(
            id: profile.id.to_s,
```

```ruby
            industry: cast&.industry || "",
            role: role || 0,
            disabled: own && !profile.disabled_at.nil?
          )
        end
```

- [ ] **Step 4: handler を更新する**

`slices/profile/grpc/profile_handler.rb` の `rpc` 宣言に 2 行足す(`GetProfileByUsername` の下)。

```ruby
      rpc :ListMyProfiles, ::Profile::V1::ListMyProfilesRequest, ::Profile::V1::ListMyProfilesResponse
      rpc :CreateProfile, ::Profile::V1::CreateProfileRequest, ::Profile::V1::CreateProfileResponse
```

`include ::Profile::Deps[...]` に 2 行足す。

```ruby
        list_my_profiles_uc: "use_cases.list_my_profiles",
        create_profile_uc: "use_cases.create_profile",
```

`get_profile` から `save_profile_media` までの public メソッドを次に置き換える。

```ruby
      def get_profile
        authenticate_user!

        profile_id = blank_to_nil(request.message.profile_id) || current_profile_id
        profile = get_profile_uc.call(profile_id: profile_id)
        build_response(::Profile::V1::GetProfileResponse, profile)
      end

      def get_profile_by_username
        authenticate_user!

        profile = get_profile_by_username_uc.call(username: request.message.username)
        unless profile
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end
        build_response(::Profile::V1::GetProfileResponse, profile)
      end

      def list_my_profiles
        authenticate_account!

        profiles = list_my_profiles_uc.call(account_id: current_account_id)
        ::Profile::V1::ListMyProfilesResponse.new(profiles: profiles.map { |profile| present(profile) })
      end

      def create_profile
        authenticate_account!

        m = request.message
        profile = create_profile_uc.call(
          account_id: current_account_id,
          display_name: m.display_name,
          username: blank_to_nil(m.username)
        )
        build_response(::Profile::V1::CreateProfileResponse, profile)
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue Profile::UseCases::CreateProfile::LimitExceededError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
      end

      def save_profile
        authenticate_user!

        m = request.message
        profile = save_profile_uc.call(
          profile_id: current_profile_id,
          username: blank_to_nil(m.username),
          display_name: m.display_name,
          bio: blank_to_nil(m.bio),
          website: blank_to_nil(m.website),
          sns_links: sns_links_to_hash(m.sns_links),
          prefecture: blank_to_nil(m.prefecture),
          is_private: m.is_private,
          age: zero_to_nil(m.age),
          body_stats: body_stats_to_hash(m.body_stats),
          industry: blank_to_nil(m.industry)
        )
        build_response(::Profile::V1::SaveProfileResponse, profile)
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def check_username_availability
        authenticate_account!

        result = check_username_uc.call(
          username: blank_to_nil(request.message.username),
          profile_id: current_profile_id
        )
        ::Profile::V1::CheckUsernameAvailabilityResponse.new(
          available: result[:available],
          message: result[:message]
        )
      end

      def save_profile_media
        authenticate_user!

        m = request.message
        profile = save_media_uc.call(
          profile_id: current_profile_id,
          avatar_media_id: blank_to_nil(m.avatar_media_id),
          cover_media_id: blank_to_nil(m.cover_media_id)
        )
        build_response(::Profile::V1::SaveProfileMediaResponse, profile)
      end
```

`check_username_availability` を `authenticate_account!` にしているのは、onboarding が profile を作る前に username の重複確認を呼ぶためである。

private の `present` を次に置き換える。`role_for` は account の id を引数に取るので変更しない。

```ruby
      def present(profile)
        media_files = load_media_files(profile)
        role = role_for(profile.account_id)
        cast = role == 2 ? cast_repository.find_by_profile_id(profile.id) : nil
        Presenter.to_proto(
          profile,
          cast: cast,
          media_files: media_files,
          role: role,
          own: profile.account_id == current_account_id
        )
      end
```

- [ ] **Step 5: spec が通ることを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/profile 2>&1 | tail -5`
Expected: `0 failures`

- [ ] **Step 6: Commit**

```bash
git add slices/profile/presenters slices/profile/grpc spec/slices/profile && git commit -s -m "feat(dystopia/monolith): serve own profiles and present them by profile id"
```

---

### Task 7: Cross-slice consumers

profile slice の外で、profile を account の id で引いている箇所・profile の行から `account_id` を行為者の id として読んでいる箇所・行為者の id で role を引いている箇所を切り替える。この時点で `current_user_id` は profile の id を返しているので、各 slice が持つ「行為者の id」はすべて profile の id である。カラム名・引数名(`viewer_account_id` 等)は変えない。

**Files:**
- Modify(get_profile の引数名。下記 sed の対象): `slices/post/adapters/profile_author_adapter.rb`、`slices/footprints/grpc/footprints_handler.rb`、`slices/discovery/use_cases/suggest_users.rb`、`slices/discovery/use_cases/search_users.rb`、`slices/social/use_cases/blocks/list_blocked.rb`、`slices/social/use_cases/viewer_can_see_post.rb`、`slices/social/use_cases/filter_visible_posts.rb`、`slices/social/use_cases/follows/{list_followers,list_following,list_pending_follow_requests,follow}.rb`、`slices/review/grpc/review_handler.rb`、`slices/review/use_cases/{list_entries_by_target,list_recent_entries,list_entries_by_author}.rb`、`slices/karte/grpc/karte_handler.rb`、`slices/karte/use_cases/{list_entries_by_target,list_recent_entries,list_my_entries}.rb`、`slices/messaging/use_cases/{list_threads,get_or_create_thread}.rb`、`slices/notifications/use_cases/list_notifications.rb`
- Modify(cast の参照): `slices/{footprints/grpc/footprints_handler,discovery/grpc/discovery_handler,social/grpc/block_handler,social/grpc/follow_handler,messaging/grpc/messaging_handler,notifications/grpc/notification_handler}.rb`
- Modify(role の参照): `slices/post/adapters/account_adapter.rb`、`slices/discovery/use_cases/suggest_users.rb`、`slices/review/use_cases/create_entry.rb`、`slices/karte/use_cases/create_entry.rb`、`slices/karte/use_cases/authorize_cast_access.rb`、`slices/messaging/use_cases/authorize_message.rb`
- Modify(その他): `slices/post/use_cases/extract_mentions.rb`、`slices/feed/use_cases/list_feed.rb`
- Test: `spec/slices/{post,social,discovery,karte,review,messaging,notifications,footprints}` 配下(feed slice には spec が無く、Step 6 の変更は Task 9 の全体実行で検証する)

すべて `dystopia/monolith` からの相対パス。

**Interfaces:**
- Consumes: Task 5 の `get_profile.call(profile_id:)` / `get_role.call(profile_id:)` / `list_profile_ids_by_prefecture.call(prefecture:)`、Task 3 の `CastRepository#find_by_profile_id` / `ProfileRepository#list_recent(exclude_profile_ids:)`、`ProfileFixtures`
- Produces: profile slice の外に、`get_profile.call(account_id:)`・`find_by_user_id`・行為者の id による `account_repository.find_by_id` が残っていない状態

- [ ] **Step 1: `get_profile` の引数名を一括で変える**

Run:
```bash
/usr/bin/grep -rlE 'get_profile(_uc)?\.call\(account_id:|use_cases\.get_profile"\]\.call\(account_id:' slices | /usr/bin/grep -v '^slices/profile/' | xargs sed -i '' -E 's/(get_profile(_uc)?\.call\()account_id:/\1profile_id:/g; s/(use_cases\.get_profile"\]\.call\()account_id:/\1profile_id:/g'
```

Run: `/usr/bin/grep -rnE 'get_profile(_uc)?\.call\(account_id:|use_cases\.get_profile"\]\.call\(account_id:' slices`
Expected: 出力なし。

Run: `/usr/bin/grep -rcE 'get_profile(_uc)?\.call\(profile_id:|use_cases\.get_profile"\]\.call\(profile_id:' slices | /usr/bin/awk -F: '{s+=$2} END {print s}'`
Expected: `31`

- [ ] **Step 2: profile の行から行為者の id を読む箇所を `id` に変える**

`slices/post/adapters/profile_author_adapter.rb` の末尾のブロックを次に置き換える。`AuthorInfo` の属性名は変えない。

```ruby
        profiles.each_with_object({}) do |p, hash|
          mf = media[p.avatar_media_id]
          hash[p.id] = AuthorInfo.new(
            account_id: p.id.to_s,
            display_name: p.display_name || "",
            username: p.username || "",
            avatar_url: mf&.url || ""
          )
        end
```

`slices/post/use_cases/extract_mentions.rb` の 27 行目付近を次に置き換える。

```ruby
          { account_id: account.id.to_s, position: match.begin(0), length: match[0].length }
```

`slices/discovery/use_cases/search_users.rb` の 2 行を次に置き換える。

```ruby
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
```

```ruby
        profiles = result[:items].filter_map { |row| get_profile.call(profile_id: row.id) }
```

- [ ] **Step 3: `SuggestUsers` を更新する**

`slices/discovery/use_cases/suggest_users.rb` の `call` と `viewer_role` を次に置き換え、`user_repo` メソッドを削除して `get_role` メソッドを足す。

```ruby
      def call(viewer_account_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        role_filter = OPPOSITE_ROLE[viewer_role(viewer_account_id)]
        exclude_ids = exclusion_ids(viewer_account_id)

        rows = profile_repo.list_recent(
          limit: limit,
          cursor: cursor,
          exclude_profile_ids: exclude_ids,
          role_filter: role_filter
        )

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        profiles = result[:items].filter_map { |row| get_profile.call(profile_id: row.id) }

        { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
      end
```

```ruby
      def viewer_role(viewer_account_id)
        get_role.call(profile_id: viewer_account_id)
      end
```

```ruby
      def get_role
        @get_role ||= Profile::Slice["use_cases.get_role"]
      end
```

- [ ] **Step 4: 6 つの handler の cast 参照を変える**

次の 6 行を置き換える。同じメソッド内の `role_for(profile.account_id)` は account の id を渡しているので変えない。

| ファイル | 変更前 | 変更後 |
|---|---|---|
| `slices/footprints/grpc/footprints_handler.rb` | `cast_repository.find_by_user_id(profile.account_id)` | `cast_repository.find_by_profile_id(profile.id)` |
| `slices/discovery/grpc/discovery_handler.rb` | 同上 | 同上 |
| `slices/social/grpc/block_handler.rb` | 同上 | 同上 |
| `slices/social/grpc/follow_handler.rb` | 同上 | 同上 |
| `slices/notifications/grpc/notification_handler.rb` | 同上 | 同上 |
| `slices/messaging/grpc/messaging_handler.rb` | `cast_repository.find_by_user_id(row.account_id)` | `cast_repository.find_by_profile_id(row.id)` |

Run: `/usr/bin/grep -rn 'find_by_user_id' slices`
Expected: 出力なし。

- [ ] **Step 5: 行為者の id で role を引く箇所を `get_role` に変える**

`slices/post/adapters/account_adapter.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

module Post
  module Adapters
    class AccountAdapter
      ROLE_GUEST = 1
      ROLE_CAST = 2

      def get_user_type(user_id)
        role = get_role.call(profile_id: user_id)
        return nil unless role

        role == ROLE_CAST ? "cast" : "guest"
      end

      def get_user_types_batch(user_ids)
        # FALLBACK: Skip the cross-slice call when no user IDs are provided.
        return {} if user_ids.nil? || user_ids.empty?

        user_ids.each_with_object({}) do |user_id, hash|
          role = get_role.call(profile_id: user_id)
          next unless role

          hash[user_id] = role == ROLE_CAST ? "cast" : "guest"
        end
      end

      def user_exists?(user_id)
        !get_role.call(profile_id: user_id).nil?
      end

      private

      def get_role
        @get_role ||= Profile::Slice["use_cases.get_role"]
      end
    end
  end
end
```

`slices/karte/use_cases/authorize_cast_access.rb` のクラス本体を次に置き換える。

```ruby
    class AuthorizeCastAccess
      ROLE_CAST = 2

      def initialize(get_role: nil, get_my_access: nil)
        @get_role = get_role
        @get_my_access = get_my_access
      end

      def call(viewer_account_id:)
        return false unless get_role.call(profile_id: viewer_account_id) == ROLE_CAST

        get_my_access.call(viewer_account_id: viewer_account_id)[:has_access]
      end

      private

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end

      def get_my_access
        @get_my_access ||= Karte::Slice["use_cases.get_my_access"]
      end
    end
```

`slices/karte/use_cases/create_entry.rb` の `initialize`・`call` の target 検証・private を次のように変える。

```ruby
      def initialize(entry_repo: nil, authorize_cast_access: nil, get_role: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo, authorize_cast_access: authorize_cast_access).compact)
        @get_role = get_role
      end
```

```ruby
        target_role = get_role.call(profile_id: target_account_id)
        raise CreateError, "Target not found" unless target_role
        raise CreateError, "Target must be a guest" unless target_role == 1
```

```ruby
      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end
```

`slices/review/use_cases/create_entry.rb` も同じ形に変える。

```ruby
      def initialize(entry_repo: nil, get_role: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @get_role = get_role
      end
```

```ruby
        target_role = get_role.call(profile_id: target_account_id)
        raise CreateError, "Target not found" unless target_role
        raise CreateError, "Target must be a cast" unless target_role == 2
```

```ruby
      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end
```

`slices/messaging/use_cases/authorize_message.rb` のクラス本体を次に置き換える。

```ruby
    class AuthorizeMessage
      ROLE_CAST = 2

      def initialize(get_role: nil, follow_repo: nil)
        @get_role = get_role
        @follow_repo = follow_repo
      end

      def call(sender_id:, recipient_id:)
        return true if get_role.call(profile_id: sender_id) == ROLE_CAST

        follow = follow_repo.find(follower_id: sender_id, followee_id: recipient_id)
        !!(follow && follow.status == "approved")
      end

      private

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
```

Run: `/usr/bin/grep -rn 'Identity::Slice\["repositories.account_repository"\]' slices | /usr/bin/grep -v '^slices/identity/'`
Expected: 次の 9 ファイルだけが出る(順不同)。いずれも account の id を渡している箇所である。
```
slices/footprints/grpc/footprints_handler.rb
slices/discovery/grpc/discovery_handler.rb
slices/social/grpc/block_handler.rb
slices/social/grpc/follow_handler.rb
slices/profile/grpc/profile_handler.rb
slices/profile/use_cases/create_profile.rb
slices/messaging/grpc/messaging_handler.rb
slices/notifications/grpc/notification_handler.rb
slices/billing/use_cases/create_checkout_session.rb
```

- [ ] **Step 6: feed の都道府県別の参照を変える**

`slices/feed/use_cases/list_feed.rb` で、`list_account_ids_by_prefecture_uc` を 2 箇所とも `list_profile_ids_by_prefecture_uc` に改名し、定義を次に置き換える。

```ruby
      def list_profile_ids_by_prefecture_uc
        @list_profile_ids_by_prefecture_uc ||= Profile::Slice["use_cases.list_profile_ids_by_prefecture"]
      end
```

Run: `/usr/bin/grep -rn 'list_account_ids_by_prefecture' slices spec`
Expected: 出力なし。spec に残っていた場合は、同じ改名を spec にも適用する。

- [ ] **Step 7: spec の double を書き換える**

次の 3 つの規則を機械的に適用する。

**規則 A(get_profile の double)**

`get_profile` の double を持つ 7 ファイルだけを対象にする。`spec/slices` 全体に掛けると、purge の cascade など別の double の `account_id:` まで書き換えてしまう。

Run:
```bash
sed -i '' -E 's/(receive\(:call\)\.with\()account_id:/\1profile_id:/g' \
  spec/slices/karte/use_cases/list_entries_by_target_spec.rb \
  spec/slices/karte/use_cases/list_my_entries_spec.rb \
  spec/slices/karte/use_cases/list_recent_entries_spec.rb \
  spec/slices/messaging/use_cases/get_or_create_thread_spec.rb \
  spec/slices/review/use_cases/list_entries_by_author_spec.rb \
  spec/slices/review/use_cases/list_entries_by_target_spec.rb \
  spec/slices/review/use_cases/list_recent_entries_spec.rb
```

Run: `/usr/bin/grep -rn -E 'get_profile.*account_id:' spec/slices`
Expected: 出力なし。残っている行は、同じ置換を手で適用する。

**規則 B(role の double)**

対象: `spec/slices/karte/use_cases/authorize_cast_access_spec.rb`、`spec/slices/karte/use_cases/create_entry_spec.rb`、`spec/slices/review/use_cases/create_entry_spec.rb`、`spec/slices/messaging/use_cases/authorize_message_spec.rb`。

| 変更前 | 変更後 |
|---|---|
| `let(:user_repo) { double(:user_repository) }` | `let(:get_role) { double(:get_role) }` |
| コンストラクタ引数の `user_repo: user_repo` | `get_role: get_role` |
| `allow(user_repo).to receive(:find_by_id).with(X).and_return(double(:user, role: N))` | `allow(get_role).to receive(:call).with(profile_id: X).and_return(N)` |
| `allow(user_repo).to receive(:find_by_id).with(X).and_return(nil)` | `allow(get_role).to receive(:call).with(profile_id: X).and_return(nil)` |

例(`authorize_cast_access_spec.rb` の 1 つ目の example):

```ruby
  let(:use_case) { described_class.new(get_role: get_role, get_my_access: get_my_access_uc) }
  let(:get_role)         { double(:get_role) }
  let(:get_my_access_uc) { double(:get_my_access) }

  let(:viewer_id) { "viewer-1" }

  it "returns true for a cast with billing access on" do
    allow(get_role).to receive(:call).with(profile_id: viewer_id).and_return(2)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_id)).to be(true)
  end
```

Run: `/usr/bin/grep -rn 'user_repo' spec/slices`
Expected: 出力なし。

**規則 C(profile の行を作る fixture と `Current`)**

対象: `spec/slices/post/grpc/{comment_handler,post_handler,handler}_spec.rb`、`spec/slices/post/use_cases/comments/{list_comments,add_comment,list_replies}_spec.rb`、`spec/slices/post/use_cases/posts/list_posts_by_ids_spec.rb`、`spec/slices/post/use_cases/extract_mentions_spec.rb`、`spec/slices/discovery/use_cases/suggest_users_spec.rb`。

- 行為者の id として使う値は、`create_account_with_profile(role: N, **profile の属性)` の戻り値(profile の id)にする。spec 内にローカル定義された `create_account` ヘルパー(identity の行だけを作って account の id を返すもの)は削除し、呼び出しを `create_account_with_profile` に置き換える。
- `profile_repo.create(account_id: X, display_name: ..., username: ...)` は、`X` を作っている `create_account_with_profile` の引数に `display_name:` / `username:` を移して削除する。
- `Current.user_id = X` は、`Current.account_id = SecureRandom.uuid_v7` と `Current.profile_id = X` の 2 行にする。
- 期待値で profile の `account_id` を読んでいる箇所は `id` にする。

例(`spec/slices/post/grpc/post_handler_spec.rb` の冒頭):

```ruby
  let(:author_id) { create_account_with_profile }
  let(:mentioned_id) { create_account_with_profile(display_name: "Mentioned", username: "mentioned_user") }

  after { Current.clear }

  describe "#save_post mentions" do
    # handler と message の let は変更しない

    before do
      mentioned_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_id
    end
```

Run: `/usr/bin/grep -rn 'Current\.user_id' spec/slices/post spec/slices/discovery`
Expected: 出力なし。

- [ ] **Step 8: 対象 slice の spec が通ることを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/post spec/slices/social spec/slices/discovery spec/slices/karte spec/slices/review spec/slices/messaging spec/slices/notifications spec/slices/footprints 2>&1 | tail -15`
Expected: Task 1 で記録した既存の失敗以外に失敗が無い。

失敗が残る場合は、失敗した spec が上の規則 A〜C のどれに当たるかを確認して適用する。どの規則にも当たらない失敗は、原因を「X が Y を引き起こす。なぜなら Z」の形で特定してから直す。

- [ ] **Step 9: Commit**

```bash
git add slices spec && git commit -s -m "refactor(dystopia/monolith): resolve profiles and roles by profile id across slices"
```

---

### Task 8: Account-scoped call sites and purge fan-out

`current_user_id` が profile の id を返すようになったので、account を必要とする箇所を `current_account_id` に切り替える。退会の purge は、行為者の id で消す slice には account の全 profile の id を渡す。

**Files:**
- Modify: `dystopia/monolith/slices/billing/grpc/billing_handler.rb`
- Modify: `dystopia/monolith/slices/identity/grpc/handler.rb`
- Modify: `dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb`(全体を置き換える)
- Modify: `dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb`
- Test: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb`(全体を置き換える)
- Test: `dystopia/monolith/spec/slices/identity/grpc/handler_spec.rb`
- Test: `dystopia/monolith/spec/slices/billing/grpc/billing_handler_spec.rb`

**Interfaces:**
- Consumes: Task 4 の `authenticate_account!` / `current_account_id` / `Current.account_id`、Task 5 の `list_my_profiles.call(account_id:)`
- Produces: `Identity::UseCases::Account::PurgeIdentity.new(account_repo:, actor_cascades:, account_cascades:, list_profiles: nil)`。`call(sub:)` は、`actor_cascades` の各要素を account の profile ごとに `call(account_id: <profile の id>)` で呼び、その後 `account_cascades` の各要素を `call(account_id: sub)` で呼ぶ。

- [ ] **Step 1: spec を書く(失敗する)**

`spec/slices/identity/use_cases/account/purge_identity_spec.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIdentity do
  let(:use_case) do
    described_class.new(
      account_repo: account_repo,
      actor_cascades: [actor_cascade],
      account_cascades: [account_cascade],
      list_profiles: list_profiles
    )
  end
  let(:account_repo) { double(:account_repository) }
  let(:actor_cascade) { double(:actor_cascade) }
  let(:account_cascade) { double(:account_cascade) }
  let(:list_profiles) { double(:list_profiles) }
  let(:sub) { "sub-purge-1" }
  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    allow(list_profiles).to receive(:call).with(account_id: sub)
      .and_return([double(:profile, id: "prof-a"), double(:profile, id: "prof-b")])
    allow(actor_cascade).to receive(:call)
    allow(account_cascade).to receive(:call)
    allow(account_repo).to receive(:delete).with(sub)
  end

  after { Cognito.reset! }

  it "calls each actor cascade once per profile of the account" do
    expect(actor_cascade).to receive(:call).with(account_id: "prof-a")
    expect(actor_cascade).to receive(:call).with(account_id: "prof-b")

    use_case.call(sub: sub)
  end

  it "never calls an actor cascade with the account id" do
    expect(actor_cascade).not_to receive(:call).with(account_id: sub)

    use_case.call(sub: sub)
  end

  it "calls each account cascade once with the account id, after the actor cascades" do
    expect(actor_cascade).to receive(:call).with(account_id: "prof-a").ordered
    expect(actor_cascade).to receive(:call).with(account_id: "prof-b").ordered
    expect(account_cascade).to receive(:call).with(account_id: sub).ordered

    use_case.call(sub: sub)
  end

  it "keeps purging the remaining profiles when one cascade call fails" do
    allow(actor_cascade).to receive(:call).with(account_id: "prof-a").and_raise(StandardError)
    expect(actor_cascade).to receive(:call).with(account_id: "prof-b")
    expect(account_cascade).to receive(:call).with(account_id: sub)

    use_case.call(sub: sub)
  end

  it "deletes the Cognito user before deleting the identity account" do
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered
    expect(account_repo).to receive(:delete).with(sub).ordered

    use_case.call(sub: sub)
  end

  it "returns nil" do
    expect(use_case.call(sub: sub)).to be_nil
  end
end
```

`spec/slices/identity/grpc/handler_spec.rb` の `Current.user_id = "sub-1"` を `Current.account_id = "sub-1"` に変える。

- [ ] **Step 2: spec が失敗することを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/identity 2>&1 | tail -5`
Expected: FAIL。`unknown keyword: :actor_cascades`、または `Current.user_id` が未定義。

- [ ] **Step 3: `PurgeIdentity` を実装する**

`slices/identity/use_cases/account/purge_identity.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(actor_cascades:, account_cascades:, list_profiles: nil, **kwargs)
          super(**kwargs)
          @actor_cascades = actor_cascades
          @account_cascades = account_cascades
          @list_profiles = list_profiles
        end

        def call(sub:)
          profile_ids = list_profiles.call(account_id: sub).map(&:id)
          @actor_cascades.each do |cascade|
            profile_ids.each { |profile_id| cascade.call(account_id: profile_id) rescue nil } # SILENT: A failed slice purge must not prevent remaining profile data from being removed.
          end
          @account_cascades.each { |cascade| cascade.call(account_id: sub) rescue nil } # SILENT: A failed slice purge must not prevent remaining account data from being removed.
          Cognito.admin_delete_user(sub: sub)
          account_repo.delete(sub)
          nil
        end

        private

        def list_profiles
          @list_profiles ||= ::Profile::Slice["use_cases.list_my_profiles"]
        end
      end
    end
  end
end
```

- [ ] **Step 4: `PurgeDeactivatedAccounts` の配線を変える**

`slices/identity/use_cases/account/purge_deactivated_accounts.rb` の private にある `cascades` メソッドを、次の 2 メソッドに置き換える。

```ruby
        def actor_cascades
          [
            purge_notifications,
            purge_footprints,
            purge_bookmarks,
            purge_messaging,
            purge_social,
            purge_post,
            purge_media,
            purge_schedule
          ]
        end

        def account_cascades
          [
            purge_karte,
            purge_profile
          ]
        end
```

同ファイルの `purge_identity` メソッドを次に置き換える。

```ruby
        def purge_identity
          @purge_identity ||= PurgeIdentity.new(
            account_repo: account_repo,
            actor_cascades: actor_cascades,
            account_cascades: account_cascades
          )
        end
```

`purge_profile` を `account_cascades` の最後に置いているのは、profile の行を消すと `list_profiles` で id を辿れなくなるためである。

- [ ] **Step 5: identity と billing の handler を切り替える**

`slices/identity/grpc/handler.rb` の `deactivate_account` の 1 行目を次に変える。

```ruby
        sub = Current.account_id
```

`slices/billing/grpc/billing_handler.rb` の 3 つの public メソッドで、`authenticate_user!` を `authenticate_account!` に、`current_user_id` を `current_account_id` に変える(各 3 箇所)。

```ruby
      def get_my_subscription
        authenticate_account!
        result = get_uc.call(account_id: current_account_id)
        response = ::Billing::V1::GetMySubscriptionResponse.new
        response.subscription = subscription_to_proto(result) if result
        response
      end

      def create_checkout_session
        authenticate_account!
        result = wrap_errors { checkout_uc.call(account_id: current_account_id) }
        ::Billing::V1::CreateCheckoutSessionResponse.new(url: result[:url])
      end

      def create_customer_portal_session
        authenticate_account!
        result = wrap_errors { portal_uc.call(account_id: current_account_id) }
        ::Billing::V1::CreateCustomerPortalSessionResponse.new(url: result[:url])
      end
```

- [ ] **Step 6: billing が account で動くことの spec を足す**

`spec/slices/billing/grpc/billing_handler_spec.rb` は現在 `STATUS_MAP` の describe だけを持つ。冒頭の `require "spec_helper"` の下に `require "lib/current"` を足し、`STATUS_MAP` の describe の下に次の describe を足す。handler への use case の注入は `spec/slices/identity/grpc/handler_spec.rb` と同じ書き方である。

```ruby
  describe "#get_my_subscription" do
    let(:get_uc) { double(:get_my_subscription) }
    let(:handler) do
      described_class.new(
        method_key: :test,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: ::Billing::V1::GetMySubscriptionRequest.new,
        get_uc: get_uc,
        checkout_uc: double(:create_checkout_session),
        portal_uc: double(:create_customer_portal_session)
      )
    end

    after { Current.clear }

    it "looks up the subscription by the account, not by the active profile" do
      Current.account_id = "acc-1"
      Current.profile_id = "prof-1"
      expect(get_uc).to receive(:call).with(account_id: "acc-1").and_return(nil)

      handler.get_my_subscription
    end

    it "works for an account without an active profile" do
      Current.account_id = "acc-1"
      allow(get_uc).to receive(:call).with(account_id: "acc-1").and_return(nil)

      expect { handler.get_my_subscription }.not_to raise_error
    end

    it "raises UNAUTHENTICATED without an account" do
      expect { handler.get_my_subscription }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end
  end
```

この describe は Step 5 の変更前だと 1 つ目の example が失敗する(`get_uc` が profile の id で呼ばれる)。Step 5 の前に書いて失敗を確認してもよい。

- [ ] **Step 7: spec が通ることを確認する**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/identity spec/slices/billing 2>&1 | tail -5`
Expected: Task 1 で記録した既存の失敗以外に失敗が無い。

Run: `/usr/bin/grep -rn 'Current\.user_id' slices lib spec`
Expected: 出力なし。

- [ ] **Step 8: Commit**

```bash
git add slices/billing slices/identity spec/slices/billing spec/slices/identity && git commit -s -m "fix(dystopia/monolith): keep billing, deactivation and purge scoped to the account"
```

---

### Task 9: Seeds and full-suite gate

**Files:**
- Modify: `dystopia/monolith/config/db/seeds.rb`
- Modify: `dystopia/monolith/config/db/seeds/portfolio/profiles.rb`(全体を置き換える)
- Modify: `dystopia/monolith/config/db/seeds/portfolio/casts.rb`(全体を置き換える)
- Modify: `dystopia/monolith/config/db/seeds/post/posts.rb`、`likes.rb`、`comments.rb`

**Interfaces:**
- Consumes: Task 3 の schema
- Produces: seed 用の定数 `CAST_PROFILE_IDS` / `GUEST_PROFILE_IDS`(profile の id。account の id である `CAST_USER_IDS` / `GUEST_USER_IDS` とは別の値)

- [ ] **Step 1: profile の seed を書き換える**

`config/db/seeds/portfolio/profiles.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

puts "Seeding Portfolio: Profiles..."

# Keep fixed IDs so other development seeds can reference these profiles.
CAST_PROFILE_IDS = %w[
  a1111111-1111-4111-8111-111111111111
  a2222222-2222-4222-8222-222222222222
  a3333333-3333-4333-8333-333333333333
].freeze

GUEST_PROFILE_IDS = %w[
  a4444444-4444-4444-8444-444444444444
  a5555555-5555-4555-8555-555555555555
  a6666666-6666-4666-8666-666666666666
  a7777777-7777-4777-8777-777777777777
].freeze

profiles_data = [
  { id: CAST_PROFILE_IDS[0],  account_id: CAST_USER_IDS[0],  username: "yuna",   display_name: "ゆな",     is_private: false, prefecture: "東京都" },
  { id: CAST_PROFILE_IDS[1],  account_id: CAST_USER_IDS[1],  username: "mio",    display_name: "みお",     is_private: true,  prefecture: "東京都" },
  { id: CAST_PROFILE_IDS[2],  account_id: CAST_USER_IDS[2],  username: "rin",    display_name: "りん",     is_private: false, prefecture: "大阪府" },
  { id: GUEST_PROFILE_IDS[0], account_id: GUEST_USER_IDS[0], username: "taro",   display_name: "たろう",   is_private: false, prefecture: "東京都" },
  { id: GUEST_PROFILE_IDS[1], account_id: GUEST_USER_IDS[1], username: "jiro",   display_name: "じろう",   is_private: false, prefecture: "神奈川県" },
  { id: GUEST_PROFILE_IDS[2], account_id: GUEST_USER_IDS[2], username: "saburo", display_name: "さぶろう", is_private: false, prefecture: "東京都" },
  { id: GUEST_PROFILE_IDS[3], account_id: GUEST_USER_IDS[3], username: "shiro",  display_name: "しろう",   is_private: false, prefecture: "大阪府" },
]

count = 0
profiles_data.each do |data|
  next if Seeds::Helper.db[:profile__profiles].where(id: data[:id]).first

  Seeds::Helper.db[:profile__profiles].insert(data.merge(created_at: Time.now, updated_at: Time.now))
  count += 1
end

puts "  Created #{count} profiles"
```

`config/db/seeds/portfolio/casts.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

puts "Seeding Portfolio: Casts..."

cast_extras = [
  { age: 23, body_stats: { height_cm: 158, cup: "D" }, industry: "デリヘル" },
  { age: 25, body_stats: { height_cm: 162, cup: "C" }, industry: "ソープ" },
  { age: 21, body_stats: { height_cm: 155, cup: "E" }, industry: "個人" },
]

CAST_PROFILE_IDS.each_with_index do |profile_id, idx|
  next if Seeds::Helper.db[:profile__casts].where(profile_id: profile_id).first

  extras = cast_extras[idx] || {}
  Seeds::Helper.db[:profile__casts].insert(
    profile_id: profile_id,
    age: extras[:age],
    body_stats: (extras[:body_stats] || {}).to_json,
    industry: extras[:industry],
    created_at: Time.now,
    updated_at: Time.now,
  )
end

puts "  Created #{CAST_PROFILE_IDS.size} casts"
```

`config/db/seeds.rb` で、casts は profile の id を参照するようになったので読み込み順を入れ替える。

```ruby
require_relative "seeds/portfolio/profiles"
require_relative "seeds/portfolio/casts"
```

- [ ] **Step 2: 投稿系の seed が profile の id を使うようにする**

Run:
```bash
sed -i '' -E 's/CAST_USER_IDS/CAST_PROFILE_IDS/g; s/GUEST_USER_IDS/GUEST_PROFILE_IDS/g' config/db/seeds/post/posts.rb config/db/seeds/post/likes.rb config/db/seeds/post/comments.rb
```

Run: `/usr/bin/grep -rn -E 'CAST_USER_IDS|GUEST_USER_IDS' config/db/seeds`
Expected: `config/db/seeds/identity/users.rb`(定義)と `config/db/seeds/portfolio/profiles.rb`(`account_id` への代入)だけが出る。

- [ ] **Step 3: seed が流れることを確認する**

Run: `bundle exec hanami db seed 2>&1 | tail -20`
Expected: `Seed completed!` が出る。

Run:
```bash
bundle exec ruby -e 'require "hanami/prepare"; db = Hanami.app["db.gateway"].connection; puts db[:profile__profiles].count; puts db[:post__posts].exclude(author_id: db[:profile__profiles].select(:id)).count'
```
Expected: 1 行目が `7`、2 行目が `0`(すべての投稿の著者が profile の id を指している)。

seed が今回の変更と無関係な箇所で失敗する場合は、失敗した行とエラーを完了報告に書き、Step 4 へ進む。

- [ ] **Step 4: 全体の rspec を実行する**

Run: `HANAMI_ENV=test bundle exec rspec 2>&1 | tail -40`
Expected: 失敗している example が、Task 1 で記録した既存の失敗の部分集合である。

新しい失敗がある場合は、原因を「X が Y を引き起こす。なぜなら Z」の形で特定してから直し、もう一度全体を実行する。

- [ ] **Step 5: 残骸が無いことを確認する**

Run:
```bash
/usr/bin/grep -rn -E 'find_by_account_id|find_by_user_id|exclude_account_ids|account_ids_by_prefecture' slices spec | /usr/bin/grep -v '^slices/billing/' | /usr/bin/grep -v '^spec/slices/billing/'
```
Expected: 出力なし。

- [ ] **Step 6: Commit and push**

```bash
git add config/db/seeds.rb config/db/seeds && git commit -s -m "chore(dystopia/monolith): seed profiles with their own ids" && git push
```

---

## Known gaps left for later plans

この plan の完了時点で意図的に残るもの。いずれも同じ stack の後続で解消する。

- frontend は account の id を閲覧者の id として使ったままで、`x-profile-id` を送らない。P1b で対応する。P1b までは「自分の投稿か」の判定が合わない。
- `GET /api/profile` は、profile を持たない account に対して以前の「profile なし」ではなく `FAILED_PRECONDITION` を返す。P1b で onboarding への誘導に置き換える。
- karte の通報(`karte.reports.reporter_account_id`)と記録の著者には profile の id が入る。段 2 で所有権を account に戻す。それまで退会の purge は karte の通報を消さない。
- 各 slice のカラム名・引数名(`author_id`、`viewer_account_id` 等)は account を指す名前のままで、値は profile の id である。段 3〜7 で改名する。
- `current_user_id` と `authenticate_user!` は名前が実態(profile を要求する)と合っていない。段 8 で `current_user_id` を削除する際に合わせて整理する。
- 無効な profile を他人から隠す処理は無い。段 1 の時点では無効化する手段が無いため、無効な profile は存在しない。段 8 で対応する。
