# Area Search Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** エリア検索を拡張し、都道府県レベルの選択、ゲストのエリア情報、件数表示、Timeline のエリアフィルターを実装する。

**Architecture:** Backend は Proto → DB Migration → Relation → Repository → Use Case → Handler の順に積み上げ。Frontend は API Route → Types → Hooks → Components の順。Feed service の `ListGuestFeed` にエリアフィルターを追加し、ゲスト Timeline の "All" タブをエリアで絞り込む。

**Tech Stack:** Ruby/Hanami 2.x + gRPC, Next.js + React 19 + Zustand, ConnectRPC, PostgreSQL

---

## Task 1: Proto Changes

Proto ファイルの変更と両サービスのコード生成。

**Files:**
- Modify: `proto/portfolio/v1/guest_service.proto`
- Modify: `proto/portfolio/v1/cast_service.proto`
- Modify: `proto/feed/v1/feed_service.proto`

**Step 1: Modify guest_service.proto**

`GuestProfile` に `prefecture` フィールドを追加（field 7）、`SaveGuestProfileRequest` にも追加（field 5）:

```proto
message GuestProfile {
  string user_id = 1;
  string name = 2;
  string avatar_url = 3;
  string avatar_media_id = 4;
  string tagline = 5;
  string bio = 6;
  string prefecture = 7;  // Guest's prefecture (e.g. "東京都")
}

message SaveGuestProfileRequest {
  string name = 1;
  string avatar_media_id = 2;
  string tagline = 3;
  string bio = 4;
  string prefecture = 5;  // Guest's prefecture (e.g. "東京都")
}
```

**Step 2: Modify cast_service.proto**

`ListCastsRequest` に `prefecture` を追加（field 9）。`GetCastCount` RPC と関連メッセージを追加:

```proto
service CastService {
  // ... existing RPCs ...
  rpc GetCastCount(GetCastCountRequest) returns (GetCastCountResponse);
}

message ListCastsRequest {
  CastVisibility visibility_filter = 1;
  string genre_id = 2;
  string tag = 3;
  CastStatusFilter status_filter = 4;
  string area_id = 5;
  int32 limit = 6;
  string cursor = 7;
  string query = 8;
  string prefecture = 9;  // Filter by prefecture (broader than area_id)
}

message GetCastCountRequest {
  string prefecture = 1;
  string area_id = 2;
  CastStatusFilter status_filter = 3;
  string genre_id = 4;
  string query = 5;
}

message GetCastCountResponse {
  int32 count = 1;
}
```

**Step 3: Modify feed_service.proto**

`ListGuestFeedRequest` に `prefecture` を追加（field 4）:

```proto
message ListGuestFeedRequest {
  FeedFilter filter = 1;
  int32 limit = 2;
  string cursor = 3;
  string prefecture = 4;  // Filter "all" tab by cast area prefecture
}
```

**Step 4: Generate backend proto code**

```bash
cd services/monolith/workspace && ./bin/codegen
```

Expected: Ruby proto files regenerated under `lib/` directories.

**Step 5: Generate frontend proto code**

```bash
cd services/nyx/workspace && pnpm proto:gen
```

Expected: TypeScript proto files regenerated under `src/stub/`.

**Step 6: Commit**

```bash
git add proto/ services/monolith/workspace/lib/ services/nyx/workspace/src/stub/
git commit -m "feat(proto): add prefecture support to guest, cast search, and feed"
```

---

## Task 2: Backend - Guest Prefecture Data Layer

DB テーブル、Relation、Repository の作成。

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/YYYYMMDD_create_guest_prefectures.rb`
- Create: `services/monolith/workspace/slices/portfolio/relations/guest_prefectures.rb`
- Modify: `services/monolith/workspace/slices/portfolio/repositories/guest_repository.rb`

**Step 1: Write migration test (verify table does not exist)**

```bash
cd services/monolith/workspace
docker-compose exec db psql -U postgres -d monolith -c "SELECT 1 FROM portfolio.guest_prefectures LIMIT 1;" 2>&1
```

Expected: ERROR (relation does not exist).

**Step 2: Create migration file**

タイムスタンプは実行時に決定。ファイル名例: `20260307000000_create_guest_prefectures.rb`

```ruby
ROM::SQL.migration do
  up do
    create_table(:portfolio__guest_prefectures) do
      column :guest_user_id, :uuid, null: false
      column :prefecture, :varchar, size: 50, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:guest_user_id, :prefecture]
      foreign_key [:guest_user_id], :portfolio__guests, key: [:user_id], on_delete: :cascade
    end

    add_index :portfolio__guest_prefectures, :prefecture, name: :idx_guest_prefectures_prefecture
  end

  down do
    drop_table(:portfolio__guest_prefectures)
  end
end
```

**Step 3: Run migration**

```bash
cd services/monolith/workspace && bundle exec hanami db migrate
```

Expected: Migration applied successfully.

**Step 4: Verify table exists**

```bash
docker-compose exec db psql -U postgres -d monolith -c "\d portfolio.guest_prefectures"
```

Expected: Table structure shown with `guest_user_id`, `prefecture`, `created_at`.

**Step 5: Create GuestPrefectures relation**

File: `services/monolith/workspace/slices/portfolio/relations/guest_prefectures.rb`

```ruby
module Portfolio
  module Relations
    class GuestPrefectures < Portfolio::DB::Relation
      schema(:"portfolio__guest_prefectures", as: :guest_prefectures, infer: false) do
        attribute :guest_user_id, Types::String
        attribute :prefecture, Types::String
        attribute :created_at, Types::Time

        associations do
          belongs_to :guest, foreign_key: :guest_user_id
        end
      end
    end
  end
end
```

**Step 6: Add prefecture methods to GuestRepository**

Modify: `services/monolith/workspace/slices/portfolio/repositories/guest_repository.rb`

既存メソッドの下に追加:

```ruby
def find_prefecture(user_id)
  guest_prefectures.where(guest_user_id: user_id).pluck(:prefecture).first
end

def save_prefecture(user_id:, prefecture:)
  transaction do
    guest_prefectures.where(guest_user_id: user_id).delete
    if prefecture && !prefecture.strip.empty?
      guest_prefectures.changeset(:create, guest_user_id: user_id, prefecture: prefecture).commit
    end
  end
end
```

**Step 7: Write repository test**

File: `services/monolith/workspace/spec/slices/portfolio/repositories/guest_repository_prefecture_spec.rb`

```ruby
RSpec.describe "GuestRepository prefecture methods", type: :database do
  let(:repo) { Hanami.app.slices[:portfolio]["repositories.guest_repository"] }
  let(:db) { Hanami.app.slices[:portfolio]["db.rom"].gateways[:default].connection }
  let(:user_id) { SecureRandom.uuid }

  before do
    db[:portfolio__guests].insert(user_id: user_id, name: "Test Guest", created_at: Time.now, updated_at: Time.now)
  end

  after do
    db[:portfolio__guest_prefectures].where(guest_user_id: user_id).delete
    db[:portfolio__guests].where(user_id: user_id).delete
  end

  describe "#save_prefecture / #find_prefecture" do
    it "saves and retrieves prefecture" do
      repo.save_prefecture(user_id: user_id, prefecture: "東京都")
      expect(repo.find_prefecture(user_id)).to eq("東京都")
    end

    it "replaces existing prefecture" do
      repo.save_prefecture(user_id: user_id, prefecture: "東京都")
      repo.save_prefecture(user_id: user_id, prefecture: "大阪府")
      expect(repo.find_prefecture(user_id)).to eq("大阪府")
    end

    it "returns nil when no prefecture set" do
      expect(repo.find_prefecture(user_id)).to be_nil
    end

    it "clears prefecture when empty string given" do
      repo.save_prefecture(user_id: user_id, prefecture: "東京都")
      repo.save_prefecture(user_id: user_id, prefecture: "")
      expect(repo.find_prefecture(user_id)).to be_nil
    end
  end
end
```

**Step 8: Run test**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/repositories/guest_repository_prefecture_spec.rb -v
```

Expected: All tests pass.

**Step 9: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/ services/monolith/workspace/slices/portfolio/relations/guest_prefectures.rb services/monolith/workspace/slices/portfolio/repositories/guest_repository.rb services/monolith/workspace/spec/
git commit -m "feat(portfolio): add guest_prefectures table, relation, and repository methods"
```

---

## Task 3: Backend - Guest Profile Use Cases + Handler

SaveProfile と GetProfile の use case を更新し、prefecture を扱えるようにする。

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/use_cases/guest/save_profile.rb`
- Modify: `services/monolith/workspace/slices/portfolio/use_cases/guest/get_profile.rb`
- Modify: `services/monolith/workspace/slices/portfolio/presenters/guest/profile_presenter.rb`
- Modify: `services/monolith/workspace/slices/portfolio/grpc/guest_handler.rb`
- Modify: `services/monolith/workspace/spec/slices/portfolio/use_cases/guest/save_profile_spec.rb`

**Step 1: Write failing test for SaveProfile with prefecture**

既存の `save_profile_spec.rb` に追加:

```ruby
context "with prefecture" do
  it "saves prefecture via repository" do
    allow(guest_repository).to receive(:find_by_user_id).and_return(nil)
    allow(guest_repository).to receive(:create).and_return(guest)
    allow(guest_repository).to receive(:save_prefecture)
    allow(guest_repository).to receive(:find_prefecture).and_return("東京都")

    result = use_case.call(user_id: user_id, name: "Test", prefecture: "東京都")

    expect(guest_repository).to have_received(:save_prefecture).with(user_id: user_id, prefecture: "東京都")
  end
end
```

**Step 2: Run test to verify it fails**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/use_cases/guest/save_profile_spec.rb -v
```

Expected: FAIL (unexpected keyword: prefecture).

**Step 3: Update SaveProfile use case**

Modify `services/monolith/workspace/slices/portfolio/use_cases/guest/save_profile.rb`:

`call` メソッドに `prefecture: nil` キーワード引数を追加。メソッド末尾に prefecture 保存を追加:

```ruby
def call(user_id:, name:, avatar_media_id: nil, tagline: nil, bio: nil, prefecture: nil)
  # ... existing validation and upsert logic ...

  saved_guest = guest_repository.find_by_user_id(user_id)

  # Save prefecture if provided
  unless prefecture.nil?
    guest_repository.save_prefecture(user_id: user_id, prefecture: prefecture)
  end

  saved_guest
end
```

**Step 4: Run test to verify it passes**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/use_cases/guest/save_profile_spec.rb -v
```

Expected: PASS.

**Step 5: Update GetProfile to return prefecture**

`get_profile.rb` は使い方を変えず、presenter で prefecture を付与する形にする。現在の `get_profile.rb` はリポジトリを呼ぶだけなので変更不要。

**Step 6: Update GuestPresenter to include prefecture**

Modify `services/monolith/workspace/slices/portfolio/presenters/guest/profile_presenter.rb`:

`to_proto` メソッドに `prefecture:` キーワード引数を追加:

```ruby
def to_proto(guest, media_files: {}, prefecture: nil)
  return empty_profile unless guest

  avatar_media = media_files[guest.avatar_media_id]
  avatar_url = avatar_media&.url || ""

  ::Portfolio::V1::GuestProfile.new(
    user_id: guest.user_id.to_s,
    name: guest.name || "",
    avatar_url: avatar_url,
    avatar_media_id: guest.avatar_media_id || "",
    tagline: guest.respond_to?(:tagline) ? (guest.tagline || "") : "",
    bio: guest.respond_to?(:bio) ? (guest.bio || "") : "",
    prefecture: prefecture || ""
  )
end
```

`empty_profile` にも `prefecture: ""` を追加。

**Step 7: Update GuestHandler**

Modify `services/monolith/workspace/slices/portfolio/grpc/guest_handler.rb`:

`get_guest_profile` メソッドで prefecture を取得して渡す:

```ruby
def get_guest_profile
  authenticate_user!

  result = get_profile_uc.call(user_id: current_user_id)
  media_files = load_media_files_for_guest(result)
  prefecture = result ? guest_repository.find_prefecture(current_user_id) : nil

  ::Portfolio::V1::GetGuestProfileResponse.new(
    profile: result ? GuestPresenter.to_proto(result, media_files: media_files, prefecture: prefecture) : nil
  )
end
```

`save_guest_profile` メソッドで prefecture を渡す:

```ruby
def save_guest_profile
  authenticate_user!

  prefecture_value = request.message.prefecture.to_s.empty? ? nil : request.message.prefecture

  result = save_profile_uc.call(
    user_id: current_user_id,
    name: request.message.name,
    avatar_media_id: request.message.avatar_media_id.to_s.empty? ? nil : request.message.avatar_media_id,
    tagline: request.message.tagline.to_s.empty? ? nil : request.message.tagline,
    bio: request.message.bio.to_s.empty? ? nil : request.message.bio,
    prefecture: prefecture_value
  )

  media_files = load_media_files_for_guest(result)
  prefecture = guest_repository.find_prefecture(current_user_id)

  ::Portfolio::V1::SaveGuestProfileResponse.new(
    profile: GuestPresenter.to_proto(result, media_files: media_files, prefecture: prefecture)
  )
rescue Errors::ValidationError => e
  raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
end
```

Handler に `guest_repository` の依存注入を追加:

```ruby
include Portfolio::Deps[
  get_profile_uc: "use_cases.guest.get_profile",
  get_profile_by_id_uc: "use_cases.guest.get_profile_by_id",
  save_profile_uc: "use_cases.guest.save_profile",
  guest_repository: "repositories.guest_repository"
]
```

**Step 8: Run all guest-related tests**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/ -v
```

Expected: All tests pass.

**Step 9: Commit**

```bash
git add services/monolith/workspace/slices/portfolio/
git commit -m "feat(portfolio): add prefecture to guest profile save/get/presenter/handler"
```

---

## Task 4: Backend - Cast Search with Prefecture Filter + GetCastCount

CastRepository に都道府県フィルター追加、GetCastCount use case を新規作成。

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/repositories/cast_repository.rb`
- Create: `services/monolith/workspace/slices/portfolio/use_cases/cast/listing/get_cast_count.rb`
- Modify: `services/monolith/workspace/slices/portfolio/use_cases/cast/listing/list_casts.rb`
- Modify: `services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb`
- Create: `services/monolith/workspace/spec/slices/portfolio/use_cases/cast/listing/get_cast_count_spec.rb`

**Step 1: Write failing test for GetCastCount**

File: `services/monolith/workspace/spec/slices/portfolio/use_cases/cast/listing/get_cast_count_spec.rb`

```ruby
RSpec.describe Portfolio::UseCases::Cast::Listing::GetCastCount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  it "returns count from repo" do
    allow(repo).to receive(:count_casts_with_filters).with(
      prefecture: "東京都", area_id: nil, status_filter: nil, genre_id: nil, query: nil
    ).and_return(15)

    result = use_case.call(prefecture: "東京都")
    expect(result).to eq(15)
  end

  it "passes area_id when provided" do
    allow(repo).to receive(:count_casts_with_filters).with(
      prefecture: nil, area_id: "area-1", status_filter: nil, genre_id: nil, query: nil
    ).and_return(5)

    result = use_case.call(area_id: "area-1")
    expect(result).to eq(5)
  end
end
```

**Step 2: Run test to verify it fails**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/use_cases/cast/listing/get_cast_count_spec.rb -v
```

Expected: FAIL (uninitialized constant).

**Step 3: Add `count_casts_with_filters` to CastRepository**

Modify `services/monolith/workspace/slices/portfolio/repositories/cast_repository.rb`:

`list_casts_with_filters` メソッドの下に追加:

```ruby
def count_casts_with_filters(prefecture: nil, area_id: nil, status_filter: nil, genre_id: nil, query: nil)
  scope = casts.exclude(registered_at: nil)

  if query && !query.strip.empty?
    q = "%#{query.strip}%"
    scope = scope.where {
      (Sequel.ilike(:name, q)) |
      (Sequel.ilike(:tagline, q)) |
      Sequel.pg_jsonb(:tags).contains(Sequel.pg_jsonb([query.strip]))
    }
  end

  if genre_id && !genre_id.empty?
    cast_user_ids_with_genre = cast_genres.where(genre_id: genre_id).pluck(:cast_user_id)
    scope = scope.where(user_id: cast_user_ids_with_genre)
  end

  # area_id takes precedence over prefecture
  if area_id && !area_id.empty?
    cast_user_ids_with_area = cast_areas.where(area_id: area_id).pluck(:cast_user_id)
    scope = scope.where(user_id: cast_user_ids_with_area)
  elsif prefecture && !prefecture.empty?
    area_ids_in_prefecture = areas.where(prefecture: prefecture, active: true).pluck(:id)
    if area_ids_in_prefecture.any?
      cast_user_ids_in_prefecture = cast_areas.where(area_id: area_ids_in_prefecture).pluck(:cast_user_id).uniq
      scope = scope.where(user_id: cast_user_ids_in_prefecture)
    else
      return 0
    end
  end

  if status_filter
    case status_filter
    when "online"
      scope = scope.where(user_id: online_cast_ids)
    when "new"
      scope = scope.where { created_at > Time.now - 7 * 24 * 60 * 60 }
    end
  end

  scope.count
end
```

**Step 4: Add prefecture filter to `list_casts_with_filters`**

既存の `list_casts_with_filters` メソッドに `prefecture:` パラメータを追加。`area_id` フィルターの直後に:

```ruby
def list_casts_with_filters(visibility_filter: nil, genre_id: nil, tag: nil, status_filter: nil, area_id: nil, prefecture: nil, query: nil, limit: nil, cursor: nil, registered_only: false)
  # ... existing code ...

  if area_id && !area_id.empty?
    cast_user_ids_with_area = cast_areas.where(area_id: area_id).pluck(:cast_user_id)
    scope = scope.where(user_id: cast_user_ids_with_area)
  elsif prefecture && !prefecture.empty?
    area_ids_in_prefecture = areas.where(prefecture: prefecture, active: true).pluck(:id)
    if area_ids_in_prefecture.any?
      cast_user_ids_in_prefecture = cast_areas.where(area_id: area_ids_in_prefecture).pluck(:cast_user_id).uniq
      scope = scope.where(user_id: cast_user_ids_in_prefecture)
    else
      return []
    end
  end

  # ... rest of existing code ...
end
```

**Step 5: Create GetCastCount use case**

File: `services/monolith/workspace/slices/portfolio/use_cases/cast/listing/get_cast_count.rb`

```ruby
# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Listing
        class GetCastCount
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(prefecture: nil, area_id: nil, status_filter: nil, genre_id: nil, query: nil)
            repo.count_casts_with_filters(
              prefecture: prefecture,
              area_id: area_id,
              status_filter: status_filter,
              genre_id: genre_id,
              query: query
            )
          end
        end
      end
    end
  end
end
```

**Step 6: Update ListCasts use case**

Modify `services/monolith/workspace/slices/portfolio/use_cases/cast/listing/list_casts.rb`:

`call` メソッドに `prefecture:` パラメータを追加して repo に渡す:

```ruby
def call(visibility_filter: nil, genre_id: nil, tag: nil, status_filter: nil, area_id: nil, prefecture: nil, query: nil, limit: DEFAULT_LIMIT, cursor: nil, registered_only: false)
  # ... existing code ...
  casts = repo.list_casts_with_filters(
    # ... existing params ...
    prefecture: prefecture,
    # ...
  )
  # ... rest unchanged ...
end
```

**Step 7: Update CastHandler**

Modify `services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb`:

`list_casts` メソッドで `prefecture` を取り出して use case に渡す:

```ruby
# Extract prefecture from request (alongside existing area_id extraction)
prefecture = request.message.prefecture.to_s.empty? ? nil : request.message.prefecture

result = list_casts_uc.call(
  # ... existing params ...
  prefecture: prefecture,
  # ...
)
```

`get_cast_count` メソッドを追加（RPC 定義の更新も必要）:

```ruby
rpc :GetCastCount, ::Portfolio::V1::GetCastCountRequest, ::Portfolio::V1::GetCastCountResponse

include Portfolio::Deps[
  # ... existing deps ...
  get_cast_count_uc: "use_cases.cast.listing.get_cast_count"
]

def get_cast_count
  prefecture = request.message.prefecture.to_s.empty? ? nil : request.message.prefecture
  area_id = request.message.area_id.to_s.empty? ? nil : request.message.area_id
  genre_id = request.message.genre_id.to_s.empty? ? nil : request.message.genre_id
  query = request.message.query.to_s.empty? ? nil : request.message.query

  status_filter = case request.message.status_filter
  when :CAST_STATUS_FILTER_ONLINE then "online"
  when :CAST_STATUS_FILTER_NEW then "new"
  else nil
  end

  count = get_cast_count_uc.call(
    prefecture: prefecture,
    area_id: area_id,
    status_filter: status_filter,
    genre_id: genre_id,
    query: query
  )

  ::Portfolio::V1::GetCastCountResponse.new(count: count)
end
```

**Step 8: Run tests**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/ -v
```

Expected: All tests pass.

**Step 9: Commit**

```bash
git add services/monolith/workspace/slices/portfolio/ services/monolith/workspace/spec/
git commit -m "feat(portfolio): add prefecture filter to cast search and GetCastCount RPC"
```

---

## Task 5: Backend - Feed Area Filtering

Feed service の ListGuestFeed に都道府県フィルターを追加。

**Files:**
- Modify: `services/monolith/workspace/slices/feed/adapters/cast_adapter.rb`
- Modify: `services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb`
- Modify: `services/monolith/workspace/slices/feed/grpc/handler.rb`
- Modify: `services/monolith/workspace/spec/slices/feed/use_cases/list_guest_feed_spec.rb`

**Step 1: Add area-filtered cast IDs method to Feed CastAdapter**

Modify `services/monolith/workspace/slices/feed/adapters/cast_adapter.rb`:

```ruby
def public_cast_ids_in_prefecture(prefecture)
  get_public_cast_ids_in_prefecture_query.call(prefecture: prefecture)
end

private

def get_public_cast_ids_in_prefecture_query
  @get_public_cast_ids_in_prefecture_query ||= Portfolio::Slice["use_cases.cast.queries.get_public_cast_ids_in_prefecture"]
end
```

**Step 2: Create query use case in Portfolio slice**

File: `services/monolith/workspace/slices/portfolio/use_cases/cast/queries/get_public_cast_ids_in_prefecture.rb`

既存の `get_public_cast_ids.rb` を参考にする。まず既存ファイルを確認:

```bash
cat services/monolith/workspace/slices/portfolio/use_cases/cast/queries/get_public_cast_ids.rb
```

同じパターンで prefecture フィルター付きのクエリを作成:

```ruby
# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Queries
        class GetPublicCastIdsInPrefecture
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(prefecture:)
            return repo.public_cast_ids if prefecture.nil? || prefecture.empty?

            area_ids = repo.area_ids_by_prefecture(prefecture)
            return [] if area_ids.empty?

            cast_user_ids_in_prefecture = repo.cast_user_ids_by_area_ids(area_ids)
            public_ids = repo.public_cast_ids
            public_ids & cast_user_ids_in_prefecture
          end
        end
      end
    end
  end
end
```

**Step 3: Add helper methods to CastRepository**

Modify `services/monolith/workspace/slices/portfolio/repositories/cast_repository.rb`:

```ruby
def public_cast_ids
  casts.where(visibility: "public").exclude(registered_at: nil).pluck(:user_id)
end

def area_ids_by_prefecture(prefecture)
  areas.where(prefecture: prefecture, active: true).pluck(:id)
end

def cast_user_ids_by_area_ids(area_ids)
  return [] if area_ids.empty?
  cast_areas.where(area_id: area_ids).pluck(:cast_user_id).uniq
end
```

注: `public_cast_ids` は既存の `get_public_cast_ids` query use case が呼んでいるものと同じロジック。そのファイルを確認して実装を合わせること。

**Step 4: Update ListGuestFeed use case**

Modify `services/monolith/workspace/slices/feed/use_cases/list_guest_feed.rb`:

`call` メソッドに `prefecture:` パラメータを追加:

```ruby
def call(guest_id:, filter:, limit: DEFAULT_LIMIT, cursor: nil, prefecture: nil)
  limit = normalize_limit(limit)
  decoded_cursor = decode_cursor(cursor)

  blocked_by_cast_ids = @block_adapter.blocker_cast_ids_for_guest(guest_user_id: guest_id)

  posts, authors = case filter
  when "all"
    list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_by_cast_ids, prefecture: prefecture)
  when "following"
    list_following_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_by_cast_ids)
  else
    list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_by_cast_ids, prefecture: prefecture)
  end

  # ... rest unchanged ...
end
```

`list_all_posts` を更新:

```ruby
def list_all_posts(guest_id:, limit:, cursor:, exclude_cast_ids: [], prefecture: nil)
  public_cast_user_ids = if prefecture && !prefecture.empty?
    @cast_adapter.public_cast_ids_in_prefecture(prefecture)
  else
    @cast_adapter.public_cast_ids
  end

  followed_cast_user_ids = @follow_adapter.following_cast_user_ids(guest_user_id: guest_id)

  posts = @post_adapter.list_all_for_authenticated(
    public_cast_user_ids: public_cast_user_ids,
    followed_cast_user_ids: followed_cast_user_ids,
    limit: limit,
    cursor: cursor,
    exclude_cast_user_ids: exclude_cast_ids
  )

  authors = load_authors(posts)
  [posts, authors]
end
```

**Step 5: Update Feed handler**

Modify `services/monolith/workspace/slices/feed/grpc/handler.rb`:

`list_guest_feed` メソッドで prefecture を取り出す:

```ruby
def list_guest_feed
  authenticate_user!
  guest = find_my_guest!

  filter = case request.message.filter
  when :FEED_FILTER_ALL then "all"
  when :FEED_FILTER_FOLLOWING then "following"
  else "all"
  end

  limit = request.message.limit.zero? ? 20 : request.message.limit
  cursor = request.message.cursor.empty? ? nil : request.message.cursor
  prefecture = request.message.prefecture.to_s.empty? ? nil : request.message.prefecture

  result = list_guest_feed_uc.call(
    guest_id: guest.user_id,
    filter: filter,
    limit: limit,
    cursor: cursor,
    prefecture: prefecture
  )

  # ... rest unchanged (engagement data, presenter, response) ...
end
```

**Step 6: Run feed tests**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/feed/ -v
```

Expected: All tests pass.

**Step 7: Commit**

```bash
git add services/monolith/workspace/slices/feed/ services/monolith/workspace/slices/portfolio/ services/monolith/workspace/spec/
git commit -m "feat(feed): add prefecture filter to guest feed all tab"
```

---

## Task 6: Frontend - API Routes

バックエンドの新しいエンドポイントに対応する API Routes を更新・作成。

**Files:**
- Modify: `services/nyx/workspace/src/app/api/guest/profile/route.ts`
- Modify: `services/nyx/workspace/src/app/api/guest/search/route.ts`
- Create: `services/nyx/workspace/src/app/api/guest/search/count/route.ts`
- Modify: `services/nyx/workspace/src/app/api/feed/guest/route.ts`

**Step 1: Update /api/guest/profile to handle prefecture**

Modify `services/nyx/workspace/src/app/api/guest/profile/route.ts`:

GET レスポンスに `prefecture` を含める:

```ts
// In GET handler, after getting response:
const profile = response.profile;
return NextResponse.json({
  profile: {
    userId: profile?.userId || "",
    name: profile?.name || "",
    avatarUrl: profile?.avatarUrl || "",
    avatarMediaId: profile?.avatarMediaId || "",
    tagline: profile?.tagline || "",
    bio: profile?.bio || "",
    prefecture: profile?.prefecture || "",
  },
});
```

PUT リクエストで `prefecture` を渡す:

```ts
// In PUT handler:
const { name, avatarMediaId, tagline, bio, prefecture } = body;
const response = await guestClient.saveGuestProfile(
  { name, avatarMediaId, tagline, bio, prefecture: prefecture || "" },
  { headers: buildGrpcHeaders(req.headers) }
);
```

**Step 2: Update /api/guest/search to handle prefecture**

Modify `services/nyx/workspace/src/app/api/guest/search/route.ts`:

```ts
// Add prefecture extraction:
const prefecture = searchParams.get("prefecture") || "";

const response = await castClient.listCasts(
  {
    // ... existing params ...
    prefecture,
  },
  { headers: buildGrpcHeaders(req.headers) }
);
```

**Step 3: Create /api/guest/search/count route**

File: `services/nyx/workspace/src/app/api/guest/search/count/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { castClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { CastStatusFilter } from "@/stub/portfolio/v1/cast_service_pb";
import { handleApiError } from "@/lib/api-helpers";

function parseStatusFilter(status: string | null): CastStatusFilter {
  switch (status?.toLowerCase()) {
    case "online": return CastStatusFilter.ONLINE;
    case "new": return CastStatusFilter.NEW;
    default: return CastStatusFilter.UNSPECIFIED;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefecture = searchParams.get("prefecture") || "";
    const areaId = searchParams.get("areaId") || "";
    const status = searchParams.get("status");
    const genreId = searchParams.get("genreId") || "";
    const query = searchParams.get("query") || "";

    const response = await castClient.getCastCount(
      {
        prefecture,
        areaId,
        statusFilter: parseStatusFilter(status),
        genreId,
        query,
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ count: response.count || 0 });
  } catch (error: unknown) {
    return handleApiError(error, "GetCastCount");
  }
}
```

**Step 4: Update /api/feed/guest to handle prefecture**

Modify `services/nyx/workspace/src/app/api/feed/guest/route.ts`:

```ts
const prefecture = searchParams.get("prefecture") || "";

const response = await feedClient.listGuestFeed(
  {
    cursor,
    limit,
    filter: filterValue,
    prefecture,
  },
  { headers: buildGrpcHeaders(req.headers) }
);
```

**Step 5: Commit**

```bash
git add services/nyx/workspace/src/app/api/
git commit -m "feat(nyx): update API routes for prefecture support and add cast count route"
```

---

## Task 7: Frontend - Guest Profile with Prefecture

ゲストのプロフィールフォームに都道府県選択を追加。

**Files:**
- Modify: `services/nyx/workspace/src/modules/portfolio/types.ts`
- Modify: `services/nyx/workspace/src/modules/portfolio/hooks/useGuestData.ts`
- Modify: `services/nyx/workspace/src/modules/portfolio/components/guest/GuestProfileForm.tsx`
- Modify: `services/nyx/workspace/src/modules/portfolio/components/guest/GuestOnboarding.tsx`

**Step 1: Update types**

Modify `services/nyx/workspace/src/modules/portfolio/types.ts`:

`useGuestData.ts` の `GuestProfileFormData` を確認して `prefecture` を追加:

```ts
// In useGuestData.ts (GuestProfileFormData):
export interface GuestProfileFormData {
  name: string;
  avatarMediaId: string;
  tagline: string;
  bio: string;
  prefecture: string;  // Add
}
```

**Step 2: Update useGuestData hook**

Modify `services/nyx/workspace/src/modules/portfolio/hooks/useGuestData.ts`:

`INITIAL_PROFILE` に `prefecture: ""` を追加。`saveProfile` の PUT ボディに `prefecture` を含める。API レスポンスから `prefecture` を取り出す。

**Step 3: Update GuestProfileForm**

Modify `services/nyx/workspace/src/modules/portfolio/components/guest/GuestProfileForm.tsx`:

都道府県セレクトを追加。`useAreas` フックの `prefectures` を使う:

```tsx
import { useAreas } from "@/modules/portfolio/hooks/useAreas";

// Inside component:
const { prefectures } = useAreas();
const [prefecture, setPrefecture] = useState(initialData?.prefecture || "");

// In the form JSX, add before submit button:
<div className="space-y-2">
  <label className="text-sm font-medium text-text-secondary">エリア</label>
  <select
    value={prefecture}
    onChange={(e) => setPrefecture(e.target.value)}
    className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary"
  >
    <option value="">選択してください</option>
    {prefectures.map((pref) => (
      <option key={pref} value={pref}>{pref}</option>
    ))}
  </select>
</div>
```

`handleSubmit` で `prefecture` を含める:

```ts
await onSubmit({ name, avatarMediaId, tagline, bio, prefecture });
```

**Step 4: Update GuestOnboarding for required prefecture**

Modify `services/nyx/workspace/src/modules/portfolio/components/guest/GuestOnboarding.tsx`:

`GuestProfileForm` に `requirePrefecture` prop を渡すか、またはフォーム内のバリデーションで対応。

`GuestProfileForm` にバリデーション追加（`props.requirePrefecture` が true の場合）:

```tsx
// GuestProfileForm props に追加:
requirePrefecture?: boolean;

// バリデーションに追加:
if (requirePrefecture && !prefecture) {
  setError("エリアを選択してください");
  return;
}
```

`GuestOnboarding`:

```tsx
<GuestProfileForm
  // ... existing props ...
  submitLabel="はじめる"
  requirePrefecture={true}  // Add
/>
```

**Step 5: Commit**

```bash
git add services/nyx/workspace/src/modules/portfolio/
git commit -m "feat(nyx): add prefecture selector to guest profile form and onboarding"
```

---

## Task 8: Frontend - Search Filter Enhancement

検索フィルターの都道府県選択と件数表示を実装。

**Files:**
- Modify: `services/nyx/workspace/src/modules/portfolio/hooks/useInfiniteCasts.ts`
- Modify: `services/nyx/workspace/src/app/(guest)/search/SearchFilterOverlay.tsx`
- Modify: `services/nyx/workspace/src/app/(guest)/search/page.tsx`

**Step 1: Update useInfiniteCasts to accept prefecture**

Modify `services/nyx/workspace/src/modules/portfolio/hooks/useInfiniteCasts.ts`:

```ts
interface UseInfiniteCastsOptions {
  genreId?: string;
  tag?: string;
  status?: StatusFilter;
  query?: string;
  areaId?: string;
  prefecture?: string;  // Add
}

// In buildParams:
if (options.prefecture) params.set("prefecture", options.prefecture);
```

`buildParams` の依存配列にも `options.prefecture` を追加。

**Step 2: Update FilterState type and SearchFilterOverlay**

Modify `services/nyx/workspace/src/app/(guest)/search/SearchFilterOverlay.tsx`:

`FilterState` に `prefecture` を追加:

```ts
type FilterState = {
  query: string;
  genreId: string;
  status: StatusFilter;
  areaId: string;
  prefecture: string;  // Add
};
```

都道府県の選択とエリアの展開を分離する UI 変更:

```tsx
// State に prefecture を追加:
const [prefecture, setPrefecture] = useState(initialFilters.prefecture);

// エリアセクションの UI を変更:
// - 都道府県名クリック → その都道府県全体を選択
// - 展開ボタン（ChevronDown）クリック → 地区リスト展開 → 特定地区を選択

{prefectures.map((pref) => (
  <div key={pref}>
    <div className="flex items-center">
      {/* Prefecture name: selects the prefecture */}
      <button
        onClick={() => {
          if (prefecture === pref && !areaId) {
            setPrefecture("");  // Deselect
          } else {
            setPrefecture(pref);
            setAreaId("");  // Clear area when selecting prefecture
          }
        }}
        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
          ${prefecture === pref && !areaId
            ? "bg-info/10 text-info border border-info/30"
            : "text-text-secondary hover:bg-surface-secondary"}`}
      >
        {pref}
      </button>
      {/* Expand button: toggles area list */}
      <button
        onClick={() => togglePrefecture(pref)}
        className="p-2 text-text-muted hover:text-text-secondary"
      >
        <ChevronDown
          size={16}
          className={`transition-transform ${expandedPrefectures.has(pref) ? "rotate-180" : ""}`}
        />
      </button>
    </div>
    {/* Area grid (expanded) */}
    {expandedPrefectures.has(pref) && (
      <div className="grid grid-cols-3 gap-2 mt-2 pl-2">
        {(areasByPrefecture.get(pref) || []).map((area) => (
          <button key={area.id}
            onClick={() => {
              setAreaId(areaId === area.id ? "" : area.id);
              setPrefecture(areaId === area.id ? "" : pref);
            }}
            className={`px-2 py-1.5 rounded-md text-xs ...
              ${areaId === area.id ? "bg-info/10 text-info ..." : "..."}`}
          >
            {area.name}
          </button>
        ))}
      </div>
    )}
  </div>
))}
```

**Step 3: Replace count preview with dedicated API call**

現在の `fetchResultCount` は `/api/guest/search?limit=1` を呼んでおり、正確な件数を返さない。`/api/guest/search/count` を使うように変更:

```tsx
const fetchResultCount = useCallback(async () => {
  // Only fetch count when area/prefecture is selected
  if (!prefecture && !areaId) {
    setResultCount(null);
    return;
  }

  setLoadingCount(true);
  try {
    const params = new URLSearchParams();
    if (prefecture) params.set("prefecture", prefecture);
    if (areaId) params.set("areaId", areaId);
    if (query.trim()) params.set("query", query.trim());
    if (genreId) params.set("genreId", genreId);
    if (status !== "all") params.set("status", status);

    const res = await fetch(`/api/guest/search/count?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setResultCount(data.count);
    }
  } catch {
    // SILENT: Result count is a non-critical UI hint
    setResultCount(null);
  } finally {
    setLoadingCount(false);
  }
}, [query, genreId, status, areaId, prefecture]);
```

適用ボタンに件数を表示:

```tsx
<Button onClick={handleApply} className="flex-1 bg-info text-white hover:bg-info-hover">
  {loadingCount
    ? "読み込み中..."
    : resultCount !== null
      ? resultCount === 0
        ? "該当なし"
        : `適用する (${resultCount}件)`
      : "適用する"}
</Button>
```

**Step 4: Update handleApply and handleReset**

```tsx
const handleReset = () => {
  setQuery(""); setGenreId(""); setStatus("all"); setAreaId(""); setPrefecture("");
};
const handleApply = () => {
  onApply({ query, genreId, status, areaId, prefecture });
  onClose();
};
const activeFilterCount = (query.trim() ? 1 : 0) + (genreId ? 1 : 0) + (status !== "all" ? 1 : 0) + (areaId || prefecture ? 1 : 0);
```

**Step 5: Update search page**

Modify `services/nyx/workspace/src/app/(guest)/search/page.tsx`:

`FilterState` に `prefecture` を追加:

```ts
const [filters, setFilters] = useState<FilterState>({
  query: "", genreId: "", status: "all", areaId: "", prefecture: ""
});
```

`useInfiniteCasts` に `prefecture` を渡す:

```ts
const { casts, ... } = useInfiniteCasts({
  genreId: filters.genreId,
  tag: activeTag,
  status: filters.status,
  query: filters.query,
  areaId: filters.areaId,
  prefecture: filters.prefecture,
});
```

アクティブフィルターバッジに都道府県名を表示:

```tsx
{filters.prefecture && !filters.areaId && (
  <span className="...badge...">
    {filters.prefecture}
    <button onClick={() => setFilters(prev => ({ ...prev, prefecture: "" }))}>
      <X size={12} />
    </button>
  </span>
)}
```

**Step 6: Commit**

```bash
git add services/nyx/workspace/src/
git commit -m "feat(nyx): add prefecture selection and cast count to search filter"
```

---

## Task 9: Frontend - Timeline Area Filter

ゲスト Timeline の "All" タブにエリアフィルターを自動適用。

**Files:**
- Modify: `services/nyx/workspace/src/modules/post/hooks/useTimeline.ts`
- Modify: `services/nyx/workspace/src/modules/feed/components/feed/TimelineFeed.tsx`
- Modify: `services/nyx/workspace/src/app/(guest)/page.tsx`

**Step 1: Update useTimeline to support prefecture and Feed API**

Modify `services/nyx/workspace/src/modules/post/hooks/useTimeline.ts`:

`useTimeline` に `prefecture` option を追加。`castId` がない場合（ゲストフィード）は `/api/feed/guest` を使用:

```ts
interface UseTimelineOptions {
  castId?: string;
  filter?: string;
  prefecture?: string;  // Add: auto-filter for guest "all" tab
}

export function useTimeline(options: UseTimelineOptions = {}) {
  const { castId, filter, prefecture } = options;

  // Use Feed service for guest home feed (no castId), Post service for cast-specific timelines
  const apiUrl = castId ? "/api/guest/timeline" : "/api/feed/guest";

  const buildParams = useCallback(
    (params: URLSearchParams) => {
      if (castId) params.set("cast_id", castId);
      if (filter) params.set("filter", filter);
      if (prefecture && !castId) params.set("prefecture", prefecture);
    },
    [castId, filter, prefecture]
  );

  // ... rest unchanged, except:
  const { ... } = usePaginatedFetch<CastPost, TimelineResponse>({
    apiUrl,  // Use dynamic URL
    mapResponse,
    getItemId,
    buildParams,
    fetchFn,
  });

  // Auto reset & refetch when filter or prefecture changes
  useEffect(() => {
    if (prevFilterRef.current !== filter || prevPrefectureRef.current !== prefecture) {
      prevFilterRef.current = filter;
      prevPrefectureRef.current = prefecture;
      reset();
      fetchInitial();
    }
  }, [filter, prefecture, reset, fetchInitial]);

  // Add prevPrefectureRef:
  const prevPrefectureRef = useRef(prefecture);

  // ...
}
```

**Step 2: Update TimelineFeed to pass guest prefecture**

Modify `services/nyx/workspace/src/modules/feed/components/feed/TimelineFeed.tsx`:

ゲストの prefecture を取得して `useTimeline` に渡す:

```tsx
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";

// Inside component:
const { profile } = useGuestData();

const { posts, loading, loadingMore, error, hasMore, fetchInitial, fetchMore } =
  useTimeline({
    filter: timelineFilter,
    prefecture: mode === "guest" ? profile?.prefecture : undefined,
  });
```

**Step 3: Verify guest homepage**

ゲストのホームページ (`services/nyx/workspace/src/app/(guest)/page.tsx`) は `TimelineFeed` を使っており、`mode="guest"` がデフォルト。変更不要。

**Step 4: Commit**

```bash
git add services/nyx/workspace/src/
git commit -m "feat(nyx): auto-apply guest prefecture filter to timeline all tab"
```

---

## Task 10: Integration Testing & Guest Default Filter

検索ページのデフォルトフィルターにゲストの都道府県を適用。

**Files:**
- Modify: `services/nyx/workspace/src/app/(guest)/search/page.tsx`

**Step 1: Set guest's prefecture as default search filter**

Modify `services/nyx/workspace/src/app/(guest)/search/page.tsx`:

ゲストの prefecture を取得して初期フィルターに設定:

```tsx
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";

// Inside component:
const { profile } = useGuestData();

// Initialize filters with guest's prefecture
const [filters, setFilters] = useState<FilterState>({
  query: "", genreId: "", status: "all", areaId: "", prefecture: ""
});

// Set prefecture from guest profile on first load
const [prefectureInitialized, setPrefectureInitialized] = useState(false);
useEffect(() => {
  if (profile?.prefecture && !prefectureInitialized) {
    setFilters(prev => ({ ...prev, prefecture: profile.prefecture }));
    setPrefectureInitialized(true);
  }
}, [profile?.prefecture, prefectureInitialized]);
```

**Step 2: Run frontend dev server and verify**

```bash
cd services/nyx/workspace && pnpm dev
```

手動確認項目:
- [ ] ゲスト新規登録時に都道府県選択が必須で表示される
- [ ] プロフィール編集で都道府県を変更できる
- [ ] 検索フィルターで都道府県名をタップすると都道府県全体が選択される
- [ ] 検索フィルターで展開ボタンをタップすると地区リストが表示される
- [ ] エリア選択時に適用ボタンに件数が表示される
- [ ] Timeline の All タブがゲストの都道府県で自動フィルターされる
- [ ] Timeline の Following タブはフィルターなし
- [ ] 都道府県未設定のゲストは全件表示

**Step 3: Run all backend tests**

```bash
cd services/monolith/workspace && bundle exec rspec
```

Expected: All tests pass.

**Step 4: Final commit**

```bash
git add services/nyx/workspace/src/
git commit -m "feat(nyx): use guest prefecture as default search filter"
```
