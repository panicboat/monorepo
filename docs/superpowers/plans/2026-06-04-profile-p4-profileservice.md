# Profile P4: ProfileService implementation (additive) + seeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `profile/v1` の `ProfileService`（GetProfile / GetProfileByUsername / SaveProfile / CheckUsernameAvailability / SaveProfileMedia / ListAreas）を、P3 の `profiles` テーブル + `ProfileRepository` を背景に**追加実装**し、gRPC サーバに登録する。dev seed に region と profiles を投入。

**Architecture:** **Additive、build-green**。新 use_cases / presenter / handler / 1 RPC サービスを追加するだけ。旧 cast/guest handler・`portfolio/v1`・旧テーブルは**残す**（offer/post/feed と frontend が依存中のため drop 不可）。新 ProfileService は旧サービスと並走し、frontend は P5 で乗り換える。旧群の drop・schema 改名は downstream 再構築後の cleanup フェーズへ。

**Tech Stack:** Ruby / Hanami 2 / ROM / gruf（gRPC）/ RSpec。proto stub = `Profile::V1::*`（P1 で生成済 `profile/v1`）。

**Spec:** `docs/superpowers/specs/2026-06-02-profile-slice-design.md`（§API contract / §Domain model / §Area）。前提: P1（proto）・P2（slice rename）・P3（profiles schema + ProfileRepository）完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。app root: `services/monolith/workspace`。branch `feat/profile-slice`。**push しない・PR 作らない**。
- 検索は **`/usr/bin/grep`**、`/usr/bin/find` を使う（shell wrapper が壊れている）。
- **DB が要る**（migration 適用済 / `type: :database` spec）。起動していなければ repo ルートで `colima start`（macOS）→ `docker compose up -d`（または `docker-compose up -d db`）。`hanami db` 実行時に `pg_dump` バージョン不整合が出たら postgres@18 を PATH 前置（`PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"`）。
- **build-green / additive**: 旧 `cast_handler` / `guest_handler` / `portfolio/v1` / 旧テーブル・relation・cross-slice adapter は**削除も改名もしない**。本 P4 は追加のみ（既存変更は `bin/grpc` と seed の 2 箇所だけ）。

### 既知の重要事項（探索で確定）

1. **`bin/grpc` が P2 リネームで壊れている（このタスクで修正する）**: `bin/grpc` は handler を明示 require するが、`require_relative "../slices/portfolio/grpc/handler"` 等の **`portfolio` パスが P2 で `profile` に rename されて存在しない**。P2 の boot 検証は `Hanami.app.prepare` で、gRPC entrypoint(`bin/grpc`) を読まないため見逃した。本 P4 で `portfolio`→`profile` に直す + 新 require を足す。
2. **use_cases は `use_cases/` 直下に置く（`profile/` サブディレクトリを作らない）**: P2 で判明した通り、`use_cases/cast/profile/` のような **`profile` という名のディレクトリは内側に `Profile` module を生み、`Deps` 定数が shadowing される**。新サービスの use_cases は `use_cases/get_profile.rb` 等の**直下**に置き（namespace `Profile::UseCases::GetProfile`）、bare `Deps[...]` を使う（既存 `use_cases/save_cast_visibility.rb` と同じ階層）。
3. **proto stub の namespace は `Profile::V1`**（P1 で `profile/v1` を生成済）。slice module `Profile` と同居するが、`Profile::V1::*`（proto）と `Profile::UseCases::*` / `Profile::Slice`（slice）は別サブ定数なので衝突しない。presenter/handler では `::Profile::V1::Profile` 等とトップレベル明示で参照する。
4. **handler 登録方式**: gruf は `bind` 済みのハンドラクラスが**ロードされていれば**サービスを serve する。`bin/grpc` が各 handler を `require_relative` でロードしている。新 `profile_handler` も同様に require する。

### 参照テンプレート（既存コードのパターン）

- gruf handler: `slices/profile/grpc/guest_handler.rb`（service_name / bind / rpc_descs.clear / rpc / Deps / `authenticate_user!` / `current_user_id` / `request.message` / 例外→`GRPC::BadStatus`）。base = `slices/profile/grpc/handler.rb`（`Grpc::Authenticatable` を include、`media_adapter` を提供）。
- use_case: `slices/profile/use_cases/guest/save_profile.rb`（`include Deps[...]` / `require "errors/validation_error"` / `raise Errors::ValidationError`）。
- presenter: `slices/profile/presenters/guest/profile_presenter.rb`（`to_proto`、`media_files[id]&.url`）。
- repository（P3）: `ProfileRepository` = `find_by_account_id` / `find_by_username` / `username_available?(u, exclude_account_id:)` / `upsert(account_id:, attrs:)` / `save_areas(account_id:, area_ids:)` / `find_area_ids` / `save_media(account_id:, avatar_media_id:, cover_media_id:)`。`AreaRepository` = `list_all` / `list_by_prefecture` / `find_by_ids`。
- seed: `Seeds::Helper.db[:table]`（Sequel dataset）。`CAST_USER_IDS` / `GUEST_USER_IDS` は **account id(UUID) 文字列の配列**（`insert_unless_exists` の戻りが id 値）。

## File Structure

- Create: `slices/profile/use_cases/get_profile.rb`, `get_profile_by_username.rb`, `check_username_availability.rb`, `list_areas.rb`, `save_profile.rb`, `save_profile_media.rb`
- Create: `slices/profile/presenters/profile_presenter.rb`
- Create: `slices/profile/grpc/profile_handler.rb`
- Modify: `bin/grpc`（stale path 修正 + profile/v1 require + profile_handler require）
- Modify: `config/db/seeds/portfolio/areas.rb`（region 追加）, `config/db/seeds.rb`（profiles seed を require）
- Create: `config/db/seeds/portfolio/profiles.rb`
- Test: `spec/slices/profile/use_cases/{save_profile,check_username_availability,list_areas,get_profile_by_username}_spec.rb`

> **ドメイン deferred（P4 では実装しない）**: username の再利用ポリシー（cooldown + 元所有者優先）は専用の予約テーブルが要るため別増分。本 P4 の username 検証は **形式 + LOWER unique 空き確認**のみ。

---

## Task 1: 読み取り系 use_cases（get_profile / get_profile_by_username / check_username_availability / list_areas）+ specs

**Files:** Test 2 spec ファイル; Create 4 use_case。

- [ ] **Step 1: 失敗するテストを書く**

Create `spec/slices/profile/use_cases/check_username_availability_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::CheckUsernameAvailability", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.check_username_availability"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  it "is available for a fresh valid username" do
    expect(uc.call(username: "fresh_name")[:available]).to be true
  end

  it "is unavailable for an invalid format" do
    expect(uc.call(username: "x")[:available]).to be false
  end

  it "is unavailable when taken (case-insensitive)" do
    repo.create(account_id: SecureRandom.uuid_v7, display_name: "X", username: "dup_name")
    expect(uc.call(username: "DUP_NAME")[:available]).to be false
  end
end
```

Create `spec/slices/profile/use_cases/list_areas_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::ListAreas", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.list_areas"] }
  let(:areas) { Hanami.app.slices[:profile]["relations.areas"] }

  before do
    areas.changeset(:create, id: SecureRandom.uuid_v7, prefecture: "東京都", name: "渋谷", code: "shibuya_t", region: "関東", sort_order: 1, active: true).commit
    areas.changeset(:create, id: SecureRandom.uuid_v7, prefecture: "大阪府", name: "難波", code: "namba_t", region: "関西", sort_order: 2, active: true).commit
  end

  it "lists all active areas" do
    expect(uc.call.map(&:code)).to include("shibuya_t", "namba_t")
  end

  it "filters by prefecture" do
    result = uc.call(prefecture: "大阪府")
    expect(result.map(&:code)).to include("namba_t")
    expect(result.map(&:prefecture).uniq).to eq(["大阪府"])
  end
end
```

Create `spec/slices/profile/use_cases/get_profile_by_username_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::GetProfileByUsername", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.get_profile_by_username"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  it "finds by username case-insensitively" do
    id = SecureRandom.uuid_v7
    repo.create(account_id: id, display_name: "Coco", username: "coco_u")
    expect(uc.call(username: "COCO_U").account_id).to eq(id)
  end

  it "returns nil for an unknown username" do
    expect(uc.call(username: "nobody_here")).to be_nil
  end
end
```

- [ ] **Step 2: 失敗を確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile/use_cases/check_username_availability_spec.rb spec/slices/profile/use_cases/list_areas_spec.rb spec/slices/profile/use_cases/get_profile_by_username_spec.rb 2>&1 | tail -8`
Expected: FAIL（`use_cases.*` が未登録）。

- [ ] **Step 3: 4 つの use_case を実装**

Create `slices/profile/use_cases/get_profile.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class GetProfile
      include Deps["repositories.profile_repository"]

      def call(account_id:)
        return nil if account_id.nil? || account_id.to_s.empty?

        profile_repository.find_by_account_id(account_id)
      end
    end
  end
end
```

Create `slices/profile/use_cases/get_profile_by_username.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class GetProfileByUsername
      include Deps["repositories.profile_repository"]

      def call(username:)
        profile_repository.find_by_username(username)
      end
    end
  end
end
```

Create `slices/profile/use_cases/check_username_availability.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class CheckUsernameAvailability
      include Deps["repositories.profile_repository"]

      USERNAME_FORMAT = /\A[A-Za-z0-9_]{3,30}\z/

      def call(username:, account_id: nil)
        if username.nil? || !username.match?(USERNAME_FORMAT)
          return { available: false, message: "ユーザー名は半角英数字とアンダースコア3〜30文字です" }
        end

        if profile_repository.username_available?(username, exclude_account_id: account_id)
          { available: true, message: "" }
        else
          { available: false, message: "このユーザー名は使用されています" }
        end
      end
    end
  end
end
```

Create `slices/profile/use_cases/list_areas.rb`:

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class ListAreas
      include Deps["repositories.area_repository"]

      def call(prefecture: nil)
        if prefecture && !prefecture.to_s.empty?
          area_repository.list_by_prefecture(prefecture)
        else
          area_repository.list_all
        end
      end
    end
  end
end
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile/use_cases/check_username_availability_spec.rb spec/slices/profile/use_cases/list_areas_spec.rb spec/slices/profile/use_cases/get_profile_by_username_spec.rb 2>&1 | tail -8`
Expected: PASS（全 example green）。

---

## Task 2: 書き込み系 use_cases（save_profile / save_profile_media）+ spec

**Files:** Test `spec/slices/profile/use_cases/save_profile_spec.rb`; Create `save_profile.rb`, `save_profile_media.rb`。

- [ ] **Step 1: 失敗するテストを書く**

Create `spec/slices/profile/use_cases/save_profile_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::SaveProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.save_profile"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  it "creates a profile with required fields" do
    profile = uc.call(account_id: account_id, display_name: "Coco", username: "coco_01")
    expect(profile.display_name).to eq("Coco")
    expect(profile.username).to eq("coco_01")
  end

  it "rejects a missing display_name" do
    expect { uc.call(account_id: account_id, display_name: "") }.to raise_error(Errors::ValidationError)
  end

  it "rejects a bio longer than 160 chars" do
    expect {
      uc.call(account_id: account_id, display_name: "Coco", bio: "あ" * 161)
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects an invalid username format" do
    expect {
      uc.call(account_id: account_id, display_name: "Coco", username: "ab")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects a username already taken by another account" do
    repo.create(account_id: SecureRandom.uuid_v7, display_name: "Other", username: "taken_01")
    expect {
      uc.call(account_id: account_id, display_name: "Coco", username: "TAKEN_01")
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects more than two areas" do
    expect {
      uc.call(account_id: account_id, display_name: "Coco",
        area_ids: [SecureRandom.uuid_v7, SecureRandom.uuid_v7, SecureRandom.uuid_v7])
    }.to raise_error(Errors::ValidationError)
  end

  it "persists up to two areas" do
    a1 = SecureRandom.uuid_v7
    a2 = SecureRandom.uuid_v7
    areas = Hanami.app.slices[:profile]["relations.areas"]
    [a1, a2].each_with_index do |id, i|
      areas.changeset(:create, id: id, prefecture: "東京都", name: "e#{i}", code: "c#{i}").commit
    end
    uc.call(account_id: account_id, display_name: "Coco", area_ids: [a1, a2])
    expect(repo.find_area_ids(account_id)).to contain_exactly(a1, a2)
  end
end
```

- [ ] **Step 2: 失敗を確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile/use_cases/save_profile_spec.rb 2>&1 | tail -8`
Expected: FAIL（`use_cases.save_profile` 未登録）。

- [ ] **Step 3: `slices/profile/use_cases/save_profile.rb` を実装**

```ruby
# frozen_string_literal: true

require "errors/validation_error"

module Profile
  module UseCases
    class SaveProfile
      include Deps["repositories.profile_repository"]

      DISPLAY_NAME_MAX = 50
      BIO_MAX = 160
      USERNAME_FORMAT = /\A[A-Za-z0-9_]{3,30}\z/
      AREAS_MAX = 2

      def call(account_id:, display_name:, username: nil, bio: nil, website: nil,
               sns_links: {}, prefecture: nil, is_private: false, age: nil,
               height_cm: nil, cup_size: nil, industry: nil, area_ids: [], shop_id: nil)
        validate_display_name!(display_name)
        validate_bio!(bio)
        validate_username!(username, account_id) unless username.nil?
        validate_areas!(area_ids)

        attrs = {
          display_name: display_name,
          bio: bio,
          website: website,
          sns_links: sns_links || {},
          prefecture: prefecture,
          is_private: is_private ? true : false,
          age: age,
          height_cm: height_cm,
          cup_size: cup_size,
          industry: industry,
          shop_id: shop_id
        }
        attrs[:username] = username unless username.nil?

        profile_repository.upsert(account_id: account_id, attrs: attrs)
        profile_repository.save_areas(account_id: account_id, area_ids: area_ids || [])
        profile_repository.find_by_account_id(account_id)
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

- [ ] **Step 4: `slices/profile/use_cases/save_profile_media.rb` を実装**

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    class SaveProfileMedia
      include Deps["repositories.profile_repository"]

      def call(account_id:, avatar_media_id: nil, cover_media_id: nil)
        profile_repository.save_media(
          account_id: account_id,
          avatar_media_id: avatar_media_id,
          cover_media_id: cover_media_id
        )
        profile_repository.find_by_account_id(account_id)
      end
    end
  end
end
```

- [ ] **Step 5: テストが通ることを確認**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile/use_cases/save_profile_spec.rb 2>&1 | tail -8`
Expected: PASS（全 example green）。

---

## Task 3: ProfilePresenter

**Files:** Create `slices/profile/presenters/profile_presenter.rb`。

- [ ] **Step 1: presenter を実装**

```ruby
# frozen_string_literal: true

module Profile
  module Presenters
    class ProfilePresenter
      class << self
        def to_proto(profile, area_records: [], media_files: {})
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
            sns_links: sns_links_proto(profile.sns_links),
            prefecture: profile.prefecture || "",
            is_private: profile.is_private ? true : false,
            registered_at: profile.registered_at ? profile.registered_at.iso8601 : "",
            age: profile.age || 0,
            height_cm: profile.height_cm || 0,
            cup_size: profile.cup_size || "",
            industry: profile.industry || "",
            areas: area_records.map { |a| area_to_proto(a) },
            shop_id: profile.shop_id || ""
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
            line: h["line"] || h[:line] || ""
          )
        end
      end
    end
  end
end
```

- [ ] **Step 2: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/profile/presenters/profile_presenter.rb`
Expected: `Syntax OK`。

---

## Task 4: ProfileHandler + bin/grpc 登録（P2 regression 修正含む）

**Files:** Create `slices/profile/grpc/profile_handler.rb`; Modify `bin/grpc`。

- [ ] **Step 1: `slices/profile/grpc/profile_handler.rb` を実装**

```ruby
# frozen_string_literal: true

require "profile/v1/service_services_pb"
require_relative "handler"

module Profile
  module Grpc
    class ProfileHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "profile.v1.ProfileService"

      bind ::Profile::V1::ProfileService::Service

      self.rpc_descs.clear

      rpc :GetProfile, ::Profile::V1::GetProfileRequest, ::Profile::V1::GetProfileResponse
      rpc :GetProfileByUsername, ::Profile::V1::GetProfileByUsernameRequest, ::Profile::V1::GetProfileResponse
      rpc :SaveProfile, ::Profile::V1::SaveProfileRequest, ::Profile::V1::SaveProfileResponse
      rpc :CheckUsernameAvailability, ::Profile::V1::CheckUsernameAvailabilityRequest, ::Profile::V1::CheckUsernameAvailabilityResponse
      rpc :SaveProfileMedia, ::Profile::V1::SaveProfileMediaRequest, ::Profile::V1::SaveProfileMediaResponse
      rpc :ListAreas, ::Profile::V1::ListAreasRequest, ::Profile::V1::ListAreasResponse

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

      def get_profile
        authenticate_user!

        account_id = blank_to_nil(request.message.account_id) || current_user_id
        profile = get_profile_uc.call(account_id: account_id)
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

      def save_profile
        authenticate_user!

        m = request.message
        profile = save_profile_uc.call(
          account_id: current_user_id,
          username: blank_to_nil(m.username),
          display_name: m.display_name,
          bio: blank_to_nil(m.bio),
          website: blank_to_nil(m.website),
          sns_links: sns_links_to_hash(m.sns_links),
          prefecture: blank_to_nil(m.prefecture),
          is_private: m.is_private,
          age: zero_to_nil(m.age),
          height_cm: zero_to_nil(m.height_cm),
          cup_size: blank_to_nil(m.cup_size),
          industry: blank_to_nil(m.industry),
          area_ids: m.area_ids.to_a,
          shop_id: blank_to_nil(m.shop_id)
        )
        build_response(::Profile::V1::SaveProfileResponse, profile)
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def check_username_availability
        authenticate_user!

        result = check_username_uc.call(
          username: blank_to_nil(request.message.username),
          account_id: current_user_id
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
          account_id: current_user_id,
          avatar_media_id: blank_to_nil(m.avatar_media_id),
          cover_media_id: blank_to_nil(m.cover_media_id)
        )
        build_response(::Profile::V1::SaveProfileMediaResponse, profile)
      end

      def list_areas
        authenticate_user!

        areas = list_areas_uc.call(prefecture: blank_to_nil(request.message.prefecture))
        ::Profile::V1::ListAreasResponse.new(
          areas: areas.map { |a| Presenter.area_to_proto(a) }
        )
      end

      private

      Presenter = Profile::Presenters::ProfilePresenter

      def build_response(klass, profile)
        klass.new(profile: profile ? present(profile) : nil)
      end

      def present(profile)
        area_ids = profile_repository.find_area_ids(profile.account_id)
        area_records = area_repository.find_by_ids(area_ids)
        media_files = load_media_files(profile)
        Presenter.to_proto(profile, area_records: area_records, media_files: media_files)
      end

      def load_media_files(profile)
        ids = [profile.avatar_media_id, profile.cover_media_id].compact
        return {} if ids.empty?

        media_adapter.find_by_ids(ids)
      end

      def sns_links_to_hash(sns)
        return {} unless sns

        {
          "x" => sns.x,
          "instagram" => sns.instagram,
          "tiktok" => sns.tiktok,
          "bluesky" => sns.bluesky,
          "line" => sns.line
        }.reject { |_, v| v.nil? || v.empty? }
      end

      def blank_to_nil(value)
        s = value.to_s
        s.empty? ? nil : s
      end

      def zero_to_nil(value)
        value.nil? || value.zero? ? nil : value
      end
    end
  end
end
```

- [ ] **Step 2: `bin/grpc` を修正（stale path 修正 + 新 require 追加）**

`require "portfolio/v1/guest_service_services_pb"` の直後の行に追加:

```ruby
require "portfolio/v1/guest_service_services_pb"
require "profile/v1/service_services_pb"
```

handler ロード部の `portfolio` パス 3 行を `profile` に直し、profile_handler を追加:

```ruby
require_relative "../slices/profile/grpc/handler"
require_relative "../slices/profile/grpc/cast_handler"
require_relative "../slices/profile/grpc/guest_handler"
require_relative "../slices/profile/grpc/profile_handler"
```

（`../slices/portfolio/grpc/...` → `../slices/profile/grpc/...`。`portfolio/v1/...` の **proto require（line 38-40 付近）はそのまま**。proto は portfolio/v1 のまま残す。）

- [ ] **Step 3: gRPC ロードチェック（bin/grpc と同じ require セットが解決することを確認）**

Run:
```
cd services/monolith/workspace && bundle exec ruby -e '
$LOAD_PATH.unshift(File.expand_path("stubs"), File.expand_path("lib"))
require "./config/app"; Hanami.app.prepare
require_relative "./slices/profile/grpc/handler"
require_relative "./slices/profile/grpc/cast_handler"
require_relative "./slices/profile/grpc/guest_handler"
require_relative "./slices/profile/grpc/profile_handler"
puts Profile::Grpc::ProfileHandler.service_name
puts "grpc load ok"
' 2>&1 | tail -10
```
Expected: `profile.v1.ProfileService` と `grpc load ok`。`LoadError`（旧 portfolio パス未修正）/ `uninitialized constant` が出ないこと。

---

## Task 5: seed（areas に region / profiles seed）

**Files:** Modify `config/db/seeds/portfolio/areas.rb`, `config/db/seeds.rb`; Create `config/db/seeds/portfolio/profiles.rb`。

- [ ] **Step 1: `config/db/seeds/portfolio/areas.rb` の各 area 行に `region:` を追加**

`areas_data` の各ハッシュに `region:` を足す。prefecture→region の対応（spec の 8 地方）:

| prefecture | region |
|---|---|
| 東京都 / 神奈川県 / 埼玉県 | 関東 |
| 大阪府 | 関西 |
| 愛知県 | 東海 |
| 福岡県 | 九州・沖縄 |

例（東京/大阪/福岡の行）:

```ruby
  { prefecture: "東京都", name: "渋谷", code: "shibuya", sort_order: 1, region: "関東" },
  ...
  { prefecture: "大阪府", name: "難波", code: "namba", sort_order: 20, region: "関西" },
  ...
  { prefecture: "愛知県", name: "栄", code: "sakae", sort_order: 30, region: "東海" },
  ...
  { prefecture: "福岡県", name: "中洲", code: "nakasu", sort_order: 40, region: "九州・沖縄" },
  ...
  { prefecture: "神奈川県", name: "横浜", code: "yokohama", sort_order: 50, region: "関東" },
  ...
  { prefecture: "埼玉県", name: "大宮", code: "omiya", sort_order: 60, region: "関東" },
```

`insert` は既に `data.merge(...)` なので、`data` に `region:` を含めれば自動で入る（追加の insert 改変は不要）。全 26 行に上表に従って `region:` を付与すること。

- [ ] **Step 2: `config/db/seeds/portfolio/profiles.rb` を作成**

```ruby
# frozen_string_literal: true

puts "Seeding Portfolio: Profiles..."

profiles_data = [
  { account_id: CAST_USER_IDS[0],  username: "yuna",   display_name: "ゆな",     is_private: false, age: 23, height_cm: 158, cup_size: "D", prefecture: "東京都", industry: "デリヘル" },
  { account_id: CAST_USER_IDS[1],  username: "mio",    display_name: "みお",     is_private: true,  age: 25, height_cm: 162, cup_size: "C", prefecture: "東京都", industry: "ソープ" },
  { account_id: CAST_USER_IDS[2],  username: "rin",    display_name: "りん",     is_private: false, age: 21, height_cm: 155, cup_size: "E", prefecture: "大阪府", industry: "個人" },
  { account_id: GUEST_USER_IDS[0], username: "taro",   display_name: "たろう",   is_private: false, prefecture: "東京都" },
  { account_id: GUEST_USER_IDS[1], username: "jiro",   display_name: "じろう",   is_private: false, prefecture: "神奈川県" },
  { account_id: GUEST_USER_IDS[2], username: "saburo", display_name: "さぶろう", is_private: false, prefecture: "東京都" },
  { account_id: GUEST_USER_IDS[3], username: "shiro",  display_name: "しろう",   is_private: false, prefecture: "大阪府" },
]

count = 0
profiles_data.each do |data|
  account_id = data[:account_id]
  next unless account_id

  existing = Seeds::Helper.db[:portfolio__profiles].where(account_id: account_id).first
  next if existing

  Seeds::Helper.db[:portfolio__profiles].insert(
    account_id: account_id,
    username: data[:username],
    display_name: data[:display_name],
    is_private: data[:is_private],
    age: data[:age],
    height_cm: data[:height_cm],
    cup_size: data[:cup_size],
    prefecture: data[:prefecture],
    industry: data[:industry],
    created_at: Time.now,
    updated_at: Time.now
  )
  count += 1
end

puts "  Created #{count} profiles"
```

（`sns_links` は DB default `'{}'` に任せて省略。`CAST_USER_IDS`/`GUEST_USER_IDS` は identity/users.rb が定義する account id 配列。）

- [ ] **Step 3: `config/db/seeds.rb` に profiles seed を登録**

`require_relative "seeds/portfolio/guests"` の直後に追加:

```ruby
require_relative "seeds/portfolio/guests"
require_relative "seeds/portfolio/profiles"
```

- [ ] **Step 4: seed が通ることを確認**

Run: `cd services/monolith/workspace && bundle exec hanami db seed 2>&1 | tail -8`
Expected: `Seeding Portfolio: Profiles...` と `Created N profiles` が出て成功。`bundle exec ruby -e 'require "./config/app"; Hanami.app.prepare; p Hanami.app.slices[:profile]["relations.profiles"].count; p Hanami.app.slices[:profile]["relations.areas"].exclude(region: nil).count'` で profiles と region 付き areas が 1 以上であることを確認。

---

## Task 6: 全体検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: profile スライス全体で回帰が無いこと**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile 2>&1 | tail -6`
Expected: P3 時点（134 examples / 14 pre-existing failures）に新規 use_case examples が加算され、**新規失敗ゼロ**。旧 cast/guest spec は不変。

- [ ] **Step 2: gRPC ロードチェック再確認（Task 4 Step 3 と同じ）**

Run: Task 4 Step 3 のコマンド
Expected: `profile.v1.ProfileService` / `grpc load ok`。

- [ ] **Step 3: db prepare が green**

Run: `cd services/monolith/workspace && bundle exec hanami db prepare 2>&1 | tail -8`
Expected: 成功（profiles/region seed 含む）。

- [ ] **Step 4: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/monolith/workspace
git add slices/profile/use_cases slices/profile/presenters slices/profile/grpc/profile_handler.rb bin/grpc config/db/seeds spec/slices/profile/use_cases
git commit -s -m "feat(profile): implement ProfileService (additive) and fix grpc handler paths"
```
（push しない。`bin/grpc` の P2 stale-path 修正も同コミットに含む旨を本文に書いてよい。）

---

## Deferred（P4 では実施しない）

- **旧群の drop**（cast/guest handler・`portfolio/v1` proto+stub・旧テーブル casts/guests/genres/cast_genres/plans/schedules/guest_prefectures/cast_areas/cast_gallery_media）+ **postgres schema `portfolio`→`profile` 改名** + `portfolio__`→`profile__` リネーム → **後段スライス（posts/feed/social/offer）と frontend が ProfileService に乗り換えた後の cleanup フェーズ**。今は offer/post/feed adapter と frontend 21 ファイルが旧群依存。
- **username 再利用ポリシー**（cooldown + 元所有者優先、予約テーブル要）。
- **area マスタの rx-sns 全国 3 階層フル投入**（本 P4 は既存 seed への region 付与 + 代表エリアのみ）。
- **frontend**（module rename・統合 Profile 型・編集フォーム・`/u/<username>`）→ **P5**。
- gruf handler の統合 spec（リクエスト経由）は P5 の frontend 結合で担保。

## Self-Review（作成者チェック済）

- **Spec coverage（P4 範囲）**: §API の 6 RPC（GetProfile/GetProfileByUsername/SaveProfile/CheckUsernameAvailability/SaveProfileMedia/ListAreas）を handler + use_cases で実装。Profile message（共通 + cast extras + areas + sns_links）を presenter で構築。bio 160 / username 形式+LOWER unique / area 最大 2 を use_case で検証（spec で網羅）。Area の region を seed + presenter に反映。
- **Additive で build-green**: 旧 handler・portfolio/v1・旧テーブル・cross-slice adapter 無改変。既存変更は `bin/grpc`（P2 regression 修正 + 追加 require）と seed のみ。
- **Deps shadowing 回避**: use_cases は `use_cases/` 直下（`profile/` サブディレクトリを作らない）に置き bare `Deps` を使用。handler は `::Profile::Deps`（既存 handler と同様トップレベル明示）。
- **proto 参照**: `::Profile::V1::*`（profile/v1、P1 生成）をトップレベル明示。slice module `Profile` と同居するが別サブ定数で衝突しない。
- **Placeholder 無し**: use_cases / presenter / handler / seed / spec すべて完全コード。area seed の region のみ表＋例行で全 26 行への決定的付与を指示。
- **型/命名整合**: container キー `use_cases.{get_profile,get_profile_by_username,save_profile,save_profile_media,check_username_availability,list_areas}` / `repositories.{profile_repository,area_repository}` / `relations.areas`。handler の Deps キーと use_case ファイルパスが一致。`save_profile_uc.call` の引数と SaveProfile#call のシグネチャ一致。presenter の proto フィールドは P1 proto（account_id/username/.../areas/shop_id, SnsLinks{x,instagram,tiktok,bluesky,line}, Area{id,region,prefecture,name,code}）と一致。
