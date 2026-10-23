# Profile P3: unified profiles schema + repository (additive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 統合 `profiles` テーブル（旧 casts+guests を 1 テーブルに、role 別フィールド nullable）+ `profile_areas` join + `areas.region` 列を**追加**し、`ProfileRepository` を実装してテストする。

**Architecture:** **Additive + reseed、build-green**。新テーブル/列/relation/repository を追加するだけ。旧 `portfolio__casts` / `portfolio__guests` / 旧 relation / cast・guest handler（portfolio/v1）/ cross-slice adapter は**一切触らない**ので壊れない。データ backfill は無し（dev は seed 駆動）。ProfileService 実装・旧テーブル drop・postgres schema 名 `portfolio`→`profile` への改名は **P4**。

**Tech Stack:** Ruby / Hanami 2 / ROM-SQL（Sequel migration）/ PostgreSQL（schema `portfolio`）/ RSpec。

**Spec:** `docs/superpowers/specs/2026-06-02-profile-slice-design.md`（§Domain model / §Area / §Monolith profile slice）。前提: P1（profile/v1 proto）・P2（slice rename）完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。monolith app root: `services/monolith/workspace`。branch `feat/profile-slice`。**push しない・PR 作らない**。
- 検索は壊れた wrapper を避け **`/usr/bin/grep`** を使う。
- **DB が要る**: migration と `type: :database` の spec は PostgreSQL に繋ぐ。起動していなければ repo ルートで `docker compose up -d`（`docker-compose.yml`/`compose.yaml` を確認）。
- **dev と test の両方の DB を migrate する**こと（rspec は test DB を使う）。Hanami は env ごとに別 DB:
  - dev: `bundle exec hanami db migrate`
  - test: `HANAMI_ENV=test bundle exec hanami db migrate`
- **build-green 制約（厳守）**: 旧 `portfolio__casts` / `portfolio__guests` / `portfolio__cast_areas` / `portfolio__genres` 等の既存テーブル・relation・repository・handler は **削除も改名もしない**。本 P3 は純粋に追加のみ。
- **postgres schema は `portfolio` のまま**。新テーブルも `portfolio__profiles` / `portfolio__profile_areas`（schema-qualified 名）。schema 名の `profile` への改名は P4。
- relation の書式は既存に倣う（`schema(:"portfolio__x", as: :x, infer: false)` + 明示 attribute）。repository は `Profile::DB::Repo` 継承で root relation をクラス名から導出（`ProfileRepository` → `profiles`）。

## Existing schema facts（参照済）

- `portfolio__casts` PK=`user_id`、`portfolio__guests` PK=`user_id`。username の前例 = `idx_casts_slug_lower`（`add_index Sequel.function(:lower, :slug), unique: true, where: "slug IS NOT NULL"`）。
- `portfolio__areas` = id/prefecture/name/code/sort_order/active/timestamps（**region 列は無い** → 追加する）。
- migration 実行で `config/db/structure.sql` が自動更新される（commit 対象）。

## File Structure

- Create: `config/db/migrate/20260604000001_add_region_to_areas.rb`
- Create: `config/db/migrate/20260604000002_create_profiles.rb`
- Create: `config/db/migrate/20260604000003_create_profile_areas.rb`
- Create: `slices/profile/relations/profiles.rb`
- Create: `slices/profile/relations/profile_areas.rb`
- Modify: `slices/profile/relations/areas.rb`（region attribute + has_many :profile_areas）
- Create: `slices/profile/repositories/profile_repository.rb`
- Create: `spec/slices/profile/repositories/profile_repository_spec.rb`
- Auto-modified: `config/db/structure.sql`（migrate で再生成）

---

## Task 1: マイグレーション 3 本を追加して適用

**Files:** 3 つの migration を作成し、dev/test 両 DB に適用。

- [ ] **Step 1: `config/db/migrate/20260604000001_add_region_to_areas.rb`**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:portfolio__areas) do
      add_column :region, :varchar, size: 50
    end
  end

  down do
    alter_table(:portfolio__areas) do
      drop_column :region
    end
  end
end
```

- [ ] **Step 2: `config/db/migrate/20260604000002_create_profiles.rb`**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table(:portfolio__profiles) do
      column :account_id, :uuid, null: false
      column :username, :varchar, size: 30
      column :display_name, :text, null: false
      column :bio, :text
      column :avatar_media_id, :uuid
      column :cover_media_id, :uuid
      column :website, :text
      column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      column :prefecture, :varchar, size: 50
      column :is_private, :boolean, null: false, default: false
      column :registered_at, "timestamp with time zone"
      column :age, :integer
      column :height_cm, :integer
      column :cup_size, :varchar, size: 10
      column :industry, :varchar, size: 50
      column :shop_id, :uuid
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:account_id]
    end

    add_index :portfolio__profiles, Sequel.function(:lower, :username),
      unique: true, name: :idx_profiles_username_lower,
      where: Sequel.lit("username IS NOT NULL")
  end

  down do
    drop_table(:portfolio__profiles)
  end
end
```

- [ ] **Step 3: `config/db/migrate/20260604000003_create_profile_areas.rb`**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table(:portfolio__profile_areas) do
      column :profile_id, :uuid, null: false
      column :area_id, :uuid, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:profile_id, :area_id]
      foreign_key [:profile_id], :portfolio__profiles, key: [:account_id], on_delete: :cascade
      foreign_key [:area_id], :portfolio__areas, key: [:id], on_delete: :cascade
    end

    add_index :portfolio__profile_areas, :area_id, name: :idx_profile_areas_area_id
  end

  down do
    drop_table(:portfolio__profile_areas)
  end
end
```

- [ ] **Step 4: dev/test 両方へ適用**

Run:
```
cd services/monolith/workspace
bundle exec hanami db migrate
HANAMI_ENV=test bundle exec hanami db migrate
```
Expected: エラーなく完了。`config/db/structure.sql` が自動再生成され、`CREATE TABLE portfolio.profiles`・`CREATE TABLE portfolio.profile_areas`・`portfolio.areas` に `region` 列・`idx_profiles_username_lower` が含まれる。

- [ ] **Step 5: structure.sql に新スキーマが入ったことを確認**

Run: `cd services/monolith/workspace && /usr/bin/grep -nE 'profiles|profile_areas|region|idx_profiles_username_lower' config/db/structure.sql | head`
Expected: 新テーブル/列/index が出力される。

---

## Task 2: relation を追加（profiles / profile_areas / areas に region）

**Files:** Create `slices/profile/relations/profiles.rb`, `slices/profile/relations/profile_areas.rb`; Modify `slices/profile/relations/areas.rb`。

- [ ] **Step 1: `slices/profile/relations/profiles.rb`**

```ruby
module Profile
  module Relations
    class Profiles < Profile::DB::Relation
      schema(:"portfolio__profiles", as: :profiles, infer: false) do
        attribute :account_id, Types::String       # UUID, PK = identity.Account
        attribute :username, Types::String.optional
        attribute :display_name, Types::String
        attribute :bio, Types::String.optional
        attribute :avatar_media_id, Types::String.optional
        attribute :cover_media_id, Types::String.optional
        attribute :website, Types::String.optional
        attribute :sns_links, Types::Hash          # JSONB
        attribute :prefecture, Types::String.optional
        attribute :is_private, Types::Bool
        attribute :registered_at, Types::Time.optional
        attribute :age, Types::Integer.optional
        attribute :height_cm, Types::Integer.optional
        attribute :cup_size, Types::String.optional
        attribute :industry, Types::String.optional
        attribute :shop_id, Types::String.optional
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

- [ ] **Step 2: `slices/profile/relations/profile_areas.rb`**

```ruby
module Profile
  module Relations
    class ProfileAreas < Profile::DB::Relation
      schema(:"portfolio__profile_areas", as: :profile_areas, infer: false) do
        attribute :profile_id, Types::String
        attribute :area_id, Types::String
        attribute :created_at, Types::Time

        associations do
          belongs_to :profile, foreign_key: :profile_id
          belongs_to :area, foreign_key: :area_id
        end
      end
    end
  end
end
```

- [ ] **Step 3: `slices/profile/relations/areas.rb` に region と profile_areas を追加**

`attribute :code, Types::String` の直後に region を追加:

```ruby
        attribute :code, Types::String
        attribute :region, Types::String.optional
```

`associations do` ブロックに 1 行追加:

```ruby
        associations do
          has_many :cast_areas, foreign_key: :area_id
          has_many :profile_areas, foreign_key: :area_id
        end
```

- [ ] **Step 4: boot で定数/relation 解決を確認**

Run: `cd services/monolith/workspace && bundle exec ruby -e "require './config/app'; Hanami.app.prepare; p Hanami.app.slices[:profile]['relations.profiles']; p Hanami.app.slices[:profile]['relations.profile_areas']; puts 'ok'" 2>&1 | tail -6`
Expected: 2 つの relation オブジェクトが表示され `ok`。`uninitialized constant` / relation 未登録エラーが出ないこと。

---

## Task 3: ProfileRepository（TDD）

**Files:** Test `spec/slices/profile/repositories/profile_repository_spec.rb`; Create `slices/profile/repositories/profile_repository.rb`。

- [ ] **Step 1: 失敗するテストを書く**

Create `spec/slices/profile/repositories/profile_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::ProfileRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  describe "#find_by_account_id" do
    it "returns nil when the profile does not exist" do
      expect(repo.find_by_account_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns the profile after create" do
      repo.create(account_id: account_id, display_name: "Coco", username: "coco")
      result = repo.find_by_account_id(account_id)
      expect(result).not_to be_nil
      expect(result.display_name).to eq("Coco")
      expect(result.username).to eq("coco")
    end
  end

  describe "#find_by_username" do
    it "matches case-insensitively" do
      repo.create(account_id: account_id, display_name: "Coco", username: "Coco")
      expect(repo.find_by_username("coco")).not_to be_nil
      expect(repo.find_by_username("COCO").account_id).to eq(account_id)
    end

    it "returns nil for blank input" do
      expect(repo.find_by_username("")).to be_nil
    end
  end

  describe "#username_available?" do
    before { repo.create(account_id: account_id, display_name: "Coco", username: "coco") }

    it "is false when taken (case-insensitive)" do
      expect(repo.username_available?("COCO")).to be false
    end

    it "is true when free" do
      expect(repo.username_available?("freename")).to be true
    end

    it "excludes the owner so they can keep their own username" do
      expect(repo.username_available?("coco", exclude_account_id: account_id)).to be true
    end
  end

  describe "#upsert" do
    it "creates then updates the same row" do
      repo.upsert(account_id: account_id, attrs: { display_name: "First", username: "first" })
      repo.upsert(account_id: account_id, attrs: { display_name: "Second" })
      result = repo.find_by_account_id(account_id)
      expect(result.display_name).to eq("Second")
      expect(result.username).to eq("first")
    end
  end

  describe "#save_areas / #find_area_ids" do
    let(:area_a) { SecureRandom.uuid_v7 }
    let(:area_b) { SecureRandom.uuid_v7 }

    before do
      repo.create(account_id: account_id, display_name: "Coco")
      areas = Hanami.app.slices[:profile]["relations.areas"]
      [area_a, area_b].each_with_index do |id, i|
        areas.changeset(:create, id: id, prefecture: "東京都", name: "エリア#{i}", code: "tokyo-#{i}").commit
      end
    end

    it "replaces the area set" do
      repo.save_areas(account_id: account_id, area_ids: [area_a, area_b])
      expect(repo.find_area_ids(account_id)).to contain_exactly(area_a, area_b)

      repo.save_areas(account_id: account_id, area_ids: [area_a])
      expect(repo.find_area_ids(account_id)).to contain_exactly(area_a)
    end
  end

  describe "#save_media" do
    let(:avatar) { SecureRandom.uuid_v7 }
    let(:cover) { SecureRandom.uuid_v7 }

    before { repo.create(account_id: account_id, display_name: "Coco") }

    it "updates avatar and cover media ids" do
      repo.save_media(account_id: account_id, avatar_media_id: avatar, cover_media_id: cover)
      result = repo.find_by_account_id(account_id)
      expect(result.avatar_media_id).to eq(avatar)
      expect(result.cover_media_id).to eq(cover)
    end
  end
end
```

- [ ] **Step 2: 失敗を確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile/repositories/profile_repository_spec.rb 2>&1 | tail -8`
Expected: FAIL（`repositories.profile_repository` が未登録 → `Dry::Container::KeyError` 等）。

- [ ] **Step 3: `slices/profile/repositories/profile_repository.rb` を実装**

```ruby
# frozen_string_literal: true

module Profile
  module Repositories
    class ProfileRepository < Profile::DB::Repo
      commands :create, update: :by_pk

      def find_by_account_id(account_id)
        profiles.by_pk(account_id).one
      end

      def find_by_username(username)
        return nil if username.nil? || username.strip.empty?

        profiles.where { Sequel.function(:lower, :username) =~ username.downcase }.one
      end

      def username_available?(username, exclude_account_id: nil)
        return false if username.nil? || username.strip.empty?

        scope = profiles.where { Sequel.function(:lower, :username) =~ username.downcase }
        scope = scope.exclude(account_id: exclude_account_id) if exclude_account_id
        !scope.exist?
      end

      def upsert(account_id:, attrs:)
        if profiles.by_pk(account_id).exist?
          update(account_id, attrs.merge(updated_at: Time.now))
        else
          create(attrs.merge(account_id: account_id))
        end
      end

      def save_areas(account_id:, area_ids:)
        transaction do
          profile_areas.where(profile_id: account_id).delete
          (area_ids || []).each do |area_id|
            profile_areas.changeset(:create, profile_id: account_id, area_id: area_id).commit
          end
        end
      end

      def find_area_ids(account_id)
        profile_areas.where(profile_id: account_id).pluck(:area_id)
      end

      def save_media(account_id:, avatar_media_id: nil, cover_media_id: nil)
        attrs = {}
        attrs[:avatar_media_id] = avatar_media_id unless avatar_media_id.nil?
        attrs[:cover_media_id] = cover_media_id unless cover_media_id.nil?
        return if attrs.empty?

        update(account_id, attrs.merge(updated_at: Time.now))
      end
    end
  end
end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile/repositories/profile_repository_spec.rb 2>&1 | tail -8`
Expected: PASS（全 example green）。`ProfileRepository` の root relation がクラス名から `profiles` に導出されること（`create`/`update :by_pk` が profiles を対象にする）をこの実行で確認。失敗時は relation 登録名（`as: :profiles`）と repo クラス名の対応を確認。

---

## Task 4: 全体検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: profile スライス全体で回帰が無いこと**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile 2>&1 | tail -6`
Expected: 既存 124 examples / 14 failures（pre-existing）+ 新規 ProfileRepository の examples が**すべて pass**。新規失敗ゼロ。旧 cast/guest 系 spec は不変（追加のみのため）。

- [ ] **Step 2: db prepare が green（seed 含め通る）**

Run: `cd services/monolith/workspace && bundle exec hanami db prepare 2>&1 | tail -6`
Expected: 成功（既存 seed は不変。新テーブルは空のまま。region 列は null 許容なので既存 area seed もそのまま通る）。

- [ ] **Step 3: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/monolith/workspace
git add config/db/migrate config/db/structure.sql slices/profile/relations slices/profile/repositories spec/slices/profile/repositories
git commit -s -m "feat(profile): add unified profiles schema and repository (additive)"
```
（structure.sql が worktree ルート基準で別パスの場合は `git add -A` で拾う。push しない。）

---

## Deferred（P3 では実施しない）

- **profiles / areas.region の seed データ投入**: 消費側（ProfileService / ListAreas）が出来る P4 で、rx-sns の area 3 階層（`region`）と profile seed を投入。
- **ProfileService 実装**（handler/use_cases/presenters を profile/v1 へ）+ 旧 cast/guest handler・`portfolio/v1`・旧テーブル（casts/guests/genres/cast_genres/plans/schedules/guest_prefectures）の drop + postgres schema `portfolio`→`profile` 改名 + `portfolio__`→`profile__` リネーム → **P4**。
- **frontend module rename + 統合 Profile 型 + 編集フォーム** → **P5**。
- bio 160 文字・area 最大 2・username reuse cooldown 等のドメイン検証は **contract / use_case 層（P4）** で実装（repository は永続化に専念）。

## Self-Review（作成者チェック済）

- **Spec coverage（P3 範囲）**: §Monolith profile slice の「relations: profiles（統合）/ areas / profile_areas」「username LOWER unique」を満たす（`idx_profiles_username_lower`）。共通 + cast extras 全フィールド（display_name/bio/avatar/cover/website/sns_links/prefecture/is_private/registered_at/age/height_cm/cup_size/industry/shop_id）を profiles に定義。§Area の region 列を areas に追加。drop 対象（blood_type/3sizes/tags/plans/schedules/genres）は新スキーマに含めず。
- **Additive で build-green**: 旧テーブル・relation・handler・cross-slice adapter は無改変。新規追加のみ。dev/test 両 DB migrate を明記（test DB 漏れの gotcha 対策）。
- **Placeholder 無し**: migration・relation・repository・spec すべて完全なコード。
- **型/命名整合**: relation `as: :profiles` / `as: :profile_areas`、repo `ProfileRepository`→root `profiles`、PK `account_id`、join `profile_id`/`area_id`。spec の `repositories.profile_repository` / `relations.profiles` / `relations.areas` コンテナキーと一致。`upsert(account_id:, attrs:)` / `save_areas(account_id:, area_ids:)` / `save_media(account_id:, avatar_media_id:, cover_media_id:)` のシグネチャは spec と一致。
