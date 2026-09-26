# Guest による Cast レビュー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guest が Cast にレビュー（0.5刻み★評価 + テキスト）を投稿できる新規 `review` slice を、backend (Hanami/ROM/gRPC) と frontend (Next.js) の両方に実装する。

**Architecture:** karte slice の構造（relations/repositories/use_cases/grpc）をテンプレートとして踏襲した greenfield slice。可視性判定は self-view / Level A（review固有: `hidden`・`reviews_visible`）/ Level B1・B2（social、既存 `FilterVisiblePosts` と `block_repository` を再利用）の1つの use case (`FilterVisibleEntries`) に集約する。

**Tech Stack:** Ruby (Hanami 2 slice, ROM-SQL, Gruf gRPC), Next.js App Router (API routes 経由で gRPC を叩く中間層), TypeScript, SWR。

**Spec:** `docs/superpowers/specs/2026-09-26-guest-cast-review-design.md`

## Global Constraints

- `rating` は 0.5刻み、1.0〜5.0 の10値のみ（`0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0`）
- `body` は任意、最大500文字
- 書き込み (`CreateEntry`) は `reviews_visible` の値に関わらず常に成功する（target が Cast であること以外の制限なし）
- `hidden` にされた entry は第三者から見えなくなるが、書いた Guest 本人・Cast 本人（自分のページを見ているとき）には全件見える
- role: `identity__users.role` は `1 = GUEST`, `2 = CAST`（karte と同じ raw 整数を使う、既存 precedent に合わせる）
- スライス間アクセス: use_case が存在するものは use_case 経由（`Social::Slice["use_cases.filter_visible_posts"]`）、repository しかないものは既存 precedent（`post/adapters/block_adapter.rb`）に倣い adapter でラップして repository を直接呼ぶ
- migration/spec 実行は `HANAMI_ENV=test` で行う

---

## Task 1: Schema migration + slice scaffolding

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20260926000000_create_review_schema.rb`
- Create: `dystopia/monolith/slices/review/config/slice.rb`
- Create: `dystopia/monolith/slices/review/db/relation.rb`
- Create: `dystopia/monolith/slices/review/db/repo.rb`
- Create: `dystopia/monolith/slices/review/db/struct.rb`
- Create: `dystopia/monolith/slices/review/relations/entries.rb`
- Create: `dystopia/monolith/slices/review/relations/cast_settings.rb`

**Interfaces:**
- Produces: `review__entries` テーブル（`id, author_account_id, target_account_id, rating, body, hidden, created_at, updated_at`）と `review__cast_settings` テーブル（`account_id, reviews_visible, updated_at`）。以降の全タスクが依存する土台

- [ ] **Step 1: migration を書く**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS review"

    create_table :"review__entries" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :target_account_id, :uuid, null: false
      column :rating, :"numeric(2,1)", null: false
      column :body, :text
      column :hidden, :boolean, null: false, default: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_step,
        "rating IN (0.5,1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5,5.0)"
    end

    run <<~SQL
      CREATE INDEX idx_review_entries_target_created
        ON review.entries (target_account_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_review_entries_author_created
        ON review.entries (author_account_id, created_at DESC, id DESC)
    SQL

    create_table :"review__cast_settings" do
      column :account_id, :uuid, null: false
      column :reviews_visible, :boolean, null: false, default: true
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:account_id]
    end
  end

  down do
    drop_table :"review__cast_settings"
    drop_table :"review__entries"
    run "DROP SCHEMA IF EXISTS review CASCADE"
  end
end
```

- [ ] **Step 2: slice scaffolding を書く**

```ruby
# dystopia/monolith/slices/review/config/slice.rb
# frozen_string_literal: true

module Review
  class Slice < Hanami::Slice
  end
end
```

```ruby
# dystopia/monolith/slices/review/db/relation.rb
# frozen_string_literal: true

module Review
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/db/repo.rb
# frozen_string_literal: true

module Review
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/db/struct.rb
# frozen_string_literal: true

module Review
  module DB
    class Struct < Monolith::DB::Struct
    end
  end
end
```

- [ ] **Step 3: ROM relation を書く**

```ruby
# dystopia/monolith/slices/review/relations/entries.rb
# frozen_string_literal: true

module Review
  module Relations
    class Entries < Review::DB::Relation
      schema(:"review__entries", as: :entry_records, infer: false) do
        attribute :id, Types::String
        attribute :author_account_id, Types::String
        attribute :target_account_id, Types::String
        attribute :rating, Types::Decimal
        attribute :body, Types::String.optional
        attribute :hidden, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/relations/cast_settings.rb
# frozen_string_literal: true

module Review
  module Relations
    class CastSettings < Review::DB::Relation
      schema(:"review__cast_settings", as: :cast_settings_records, infer: false) do
        attribute :account_id, Types::String
        attribute :reviews_visible, Types::Bool
        attribute :updated_at, Types::Time

        primary_key :account_id
      end
    end
  end
end
```

- [ ] **Step 4: migration を test DB に適用して確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: エラーなく完了し、`review.entries` / `review.cast_settings` テーブルが作成される

Run: `docker-compose exec db psql -U postgres -d monolith_test -P pager=off -c "\d review.entries"`
Expected: 上記カラム・`rating_step` 制約・2つの index が表示される

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/config/db/migrate/20260926000000_create_review_schema.rb dystopia/monolith/slices/review/
git commit -s -m "feat(review): add schema migration and slice scaffolding"
```

---

## Task 2: EntryRepository

**Files:**
- Create: `dystopia/monolith/slices/review/repositories/entry_repository.rb`
- Test: `dystopia/monolith/spec/slices/review/repositories/entry_repository_spec.rb`

**Interfaces:**
- Consumes: `Review::Relations::Entries`（Task 1）
- Produces: `create(author_account_id:, target_account_id:, rating:, body:)`, `find_by_id(id)`, `update(id, attrs)`, `delete(id)`, `list_by_target(target_account_id:, limit:, cursor:)`, `list_by_author(author_account_id:, limit:, cursor:)` — 以降の全 use case タスクが依存する

- [ ] **Step 1: repository spec を書く（先に失敗させる）**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/review/repositories/entry_repository"

RSpec.describe Review::Repositories::EntryRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:author_id) { SecureRandom.uuid_v7 }
  let(:target_id) { SecureRandom.uuid_v7 }

  describe "#create" do
    it "persists an entry with hidden defaulting to false" do
      entry = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3.5, body: "ok")
      expect(entry.rating.to_f).to eq(3.5)
      expect(entry.hidden).to eq(false)
    end

    it "rejects a rating outside the 0.5-step set via the DB constraint" do
      expect {
        repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3.3, body: nil)
      }.to raise_error(ROM::SQL::Error)
    end
  end

  describe "#update" do
    it "can flip hidden independently of rating/body" do
      entry = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 4.0, body: nil)
      repo.update(entry.id, hidden: true)
      expect(repo.find_by_id(entry.id).hidden).to eq(true)
    end
  end

  describe "#list_by_target cursor pagination" do
    it "returns limit+1 rows (sentinel for has_more) newest first, and continues correctly across a cursor boundary" do
      e1 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 1.0, body: "a")
      sleep 0.01
      e2 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 2.0, body: "b")
      sleep 0.01
      e3 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 3.0, body: "c")
      sleep 0.01
      e4 = repo.create(author_account_id: author_id, target_account_id: target_id, rating: 4.0, body: "d")

      # limit: 2 fetches limit+1 = 3 rows so the caller can detect has_more (matches
      # Karte::Repositories::EntryRepository#list_by_target and this plan's
      # ListEntriesByTarget/ListEntriesByAuthor use cases, which take(limit) after this).
      page1 = repo.list_by_target(target_account_id: target_id, limit: 2)
      expect(page1.map(&:id)).to eq([e4.id, e3.id, e2.id])

      # EntryRepository 自身が Concerns::CursorPagination を include しているので、
      # 同じインスタンスの private #encode_cursor をそのまま使って有効なカーソル文字列を作る。
      # カーソルは実際の呼び出し元 (use case) が組み立てる形と同じく、センチネル行 (e2)
      # ではなく可視ページの最後の行 (limit-1 番目 = e3) から作る。
      # iso8601(6) preserves microseconds — plain iso8601 truncates to whole
      # seconds, which silently drops same-second rows from the next page
      # (found while writing this test: two rows created less than a second
      # apart round-tripped through a truncated cursor and vanished).
      cursor = repo.send(:encode_cursor, created_at: e3.created_at.iso8601(6), id: e3.id)
      page2 = repo.list_by_target(target_account_id: target_id, limit: 2, cursor: cursor)
      expect(page2.map(&:id)).to eq([e2.id, e1.id])
    end
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/repositories/entry_repository_spec.rb`
Expected: FAIL（`Review::Repositories::EntryRepository` が存在しない）

- [ ] **Step 3: repository を実装する**

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Review
  module Repositories
    class EntryRepository < Review::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, target_account_id:, rating:, body:)
        entry_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body,
          hidden: false
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

- [ ] **Step 4: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/repositories/entry_repository_spec.rb`
Expected: PASS（cursor 生成部分は Step 2 の注記に従い実装環境に合わせて調整した上で）

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/repositories/entry_repository.rb dystopia/monolith/spec/slices/review/repositories/entry_repository_spec.rb
git commit -s -m "feat(review): add EntryRepository with cursor pagination"
```

---

## Task 3: CastSettingsRepository

**Files:**
- Create: `dystopia/monolith/slices/review/repositories/cast_settings_repository.rb`
- Test: `dystopia/monolith/spec/slices/review/repositories/cast_settings_repository_spec.rb`

**Interfaces:**
- Consumes: `Review::Relations::CastSettings`（Task 1）
- Produces: `find_by_account(account_id)`（行がなければ `nil`）, `upsert(account_id:, reviews_visible:)`

- [ ] **Step 1: repository spec を書く**

```ruby
# frozen_string_literal: true

require "spec_helper"
require "slices/review/repositories/cast_settings_repository"

RSpec.describe Review::Repositories::CastSettingsRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:account_id) { SecureRandom.uuid_v7 }

  it "returns nil when no row exists" do
    expect(repo.find_by_account(account_id)).to be_nil
  end

  it "creates a row on first upsert" do
    repo.upsert(account_id: account_id, reviews_visible: false)
    expect(repo.find_by_account(account_id).reviews_visible).to eq(false)
  end

  it "updates an existing row on subsequent upsert" do
    repo.upsert(account_id: account_id, reviews_visible: false)
    repo.upsert(account_id: account_id, reviews_visible: true)
    expect(repo.find_by_account(account_id).reviews_visible).to eq(true)
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/repositories/cast_settings_repository_spec.rb`
Expected: FAIL

- [ ] **Step 3: repository を実装する**

```ruby
# frozen_string_literal: true

module Review
  module Repositories
    class CastSettingsRepository < Review::DB::Repo
      def find_by_account(account_id)
        cast_settings_records.by_pk(account_id).one
      end

      def upsert(account_id:, reviews_visible:)
        if cast_settings_records.by_pk(account_id).one
          cast_settings_records.by_pk(account_id).command(:update).call(
            reviews_visible: reviews_visible,
            updated_at: Time.now
          )
        else
          cast_settings_records.command(:create).call(
            account_id: account_id,
            reviews_visible: reviews_visible,
            updated_at: Time.now
          )
        end
      end
    end
  end
end
```

- [ ] **Step 4: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/repositories/cast_settings_repository_spec.rb`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/repositories/cast_settings_repository.rb dystopia/monolith/spec/slices/review/repositories/cast_settings_repository_spec.rb
git commit -s -m "feat(review): add CastSettingsRepository"
```

---

## Task 4: CreateEntry use case

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/create_entry.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/create_entry_spec.rb`

**Interfaces:**
- Consumes: `Review::Repositories::EntryRepository#create`（Task 2）、`Identity::Slice["repositories.account_repository"]#find_by_id`（既存、role確認用）
- Produces: `Review::UseCases::CreateEntry#call(viewer_account_id:, target_account_id:, rating:, body:)` — 成功時は作成された entry の raw row を返す。`Review::UseCases::CreateEntry::CreateError` を投げうる

- [ ] **Step 1: use case spec を書く**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::CreateEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo, user_repo: user_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:user_repo) { double(:user_repository) }

  let(:viewer_id) { "viewer-guest-1" }
  let(:target_id) { "target-cast-1" }

  it "creates an entry when target is a cast" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 2))
    expect(entry_repo).to receive(:create).with(
      author_account_id: viewer_id,
      target_account_id: target_id,
      rating: 3.5,
      body: "great"
    ).and_return(double(:entry, id: "e-1"))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.5, body: "great")
    expect(result.id).to eq("e-1")
  end

  it "never consults reviews_visible before creating (the use case has no such dependency)" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 2))
    allow(entry_repo).to receive(:create).and_return(double(:entry, id: "e-2"))

    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 1.0, body: nil)
    }.not_to raise_error
  end

  it "rejects when target is a guest" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, id: target_id, role: 1))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.0, body: nil)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, "Target must be a cast")
  end

  it "rejects when target does not exist" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.0, body: nil)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, "Target not found")
  end

  it "rejects a rating outside the 0.5-step set" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 2))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.3, body: nil)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, /Rating must be one of/)
  end

  it "rejects body over 500 chars" do
    allow(user_repo).to receive(:find_by_id).with(target_id).and_return(double(:user, role: 2))
    expect {
      use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, rating: 3.0, body: "x" * 501)
    }.to raise_error(Review::UseCases::CreateEntry::CreateError, "Body too long")
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/create_entry_spec.rb`
Expected: FAIL

- [ ] **Step 3: use case を実装する**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class CreateEntry
      class CreateError < StandardError; end

      MAX_BODY_LENGTH = 500
      ALLOWED_RATINGS = (1..10).map { |n| n * 0.5 }.freeze

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, user_repo: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @user_repo = user_repo
      end

      def call(viewer_account_id:, target_account_id:, rating:, body:)
        raise CreateError, "Rating must be one of #{ALLOWED_RATINGS.join(', ')}" unless ALLOWED_RATINGS.include?(rating)
        raise CreateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        target = user_repo.find_by_id(target_account_id)
        raise CreateError, "Target not found" unless target
        raise CreateError, "Target must be a cast" unless target.role == 2

        entry_repo.create(
          author_account_id: viewer_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body
        )
      end

      private

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
```

- [ ] **Step 4: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/create_entry_spec.rb`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/use_cases/create_entry.rb dystopia/monolith/spec/slices/review/use_cases/create_entry_spec.rb
git commit -s -m "feat(review): add CreateEntry use case (write is never blocked by reviews_visible)"
```

---

## Task 5: UpdateEntry / DeleteEntry use cases

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/update_entry.rb`
- Create: `dystopia/monolith/slices/review/use_cases/delete_entry.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/update_entry_spec.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/delete_entry_spec.rb`

**Interfaces:**
- Consumes: `Review::Repositories::EntryRepository#find_by_id`, `#update`, `#delete`（Task 2）
- Produces: `Review::UseCases::UpdateEntry#call(viewer_account_id:, entry_id:, rating: nil, body: nil)`、`Review::UseCases::DeleteEntry#call(viewer_account_id:, entry_id:)`。どちらも author 以外を弾く。エラークラス: `UpdateEntry::NotFoundError` / `UpdateEntry::PermissionError` / `UpdateEntry::UpdateError`、`DeleteEntry::NotFoundError` / `DeleteEntry::PermissionError`

- [ ] **Step 1: 2つの spec を書く**

```ruby
# dystopia/monolith/spec/slices/review/use_cases/update_entry_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::UpdateEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:author_id) { "author-1" }
  let(:entry_id) { "entry-1" }

  it "updates rating/body when called by the author" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: author_id))
    expect(entry_repo).to receive(:update).with(entry_id, rating: 4.5, body: "updated")

    use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 4.5, body: "updated")
  end

  it "raises NotFoundError when the entry does not exist" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 4.5)
    }.to raise_error(Review::UseCases::UpdateEntry::NotFoundError)
  end

  it "raises PermissionError when the viewer is not the author" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: "someone-else"))
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 4.5)
    }.to raise_error(Review::UseCases::UpdateEntry::PermissionError)
  end

  it "raises UpdateError for an invalid rating" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: author_id))
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id, rating: 3.3)
    }.to raise_error(Review::UseCases::UpdateEntry::UpdateError)
  end
end
```

```ruby
# dystopia/monolith/spec/slices/review/use_cases/delete_entry_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::DeleteEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:author_id) { "author-1" }
  let(:entry_id) { "entry-1" }

  it "deletes when called by the author" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: author_id))
    expect(entry_repo).to receive(:delete).with(entry_id)

    use_case.call(viewer_account_id: author_id, entry_id: entry_id)
  end

  it "raises NotFoundError when the entry does not exist" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::DeleteEntry::NotFoundError)
  end

  it "raises PermissionError when the viewer is not the author" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, author_account_id: "someone-else"))
    expect {
      use_case.call(viewer_account_id: author_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::DeleteEntry::PermissionError)
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/update_entry_spec.rb spec/slices/review/use_cases/delete_entry_spec.rb`
Expected: FAIL

- [ ] **Step 3: 2つの use case を実装する**

```ruby
# dystopia/monolith/slices/review/use_cases/update_entry.rb
# frozen_string_literal: true

module Review
  module UseCases
    class UpdateEntry
      class UpdateError < StandardError; end
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      MAX_BODY_LENGTH = 500
      ALLOWED_RATINGS = (1..10).map { |n| n * 0.5 }.freeze

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def call(viewer_account_id:, entry_id:, rating: nil, body: nil)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry
        raise PermissionError, "Not the author" unless entry.author_account_id == viewer_account_id

        if rating
          raise UpdateError, "Rating must be one of #{ALLOWED_RATINGS.join(', ')}" unless ALLOWED_RATINGS.include?(rating)
        end
        raise UpdateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        attrs = {}
        attrs[:rating] = rating if rating
        attrs[:body] = body if body

        entry_repo.update(entry_id, attrs)
      end
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/use_cases/delete_entry.rb
# frozen_string_literal: true

module Review
  module UseCases
    class DeleteEntry
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def call(viewer_account_id:, entry_id:)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry
        raise PermissionError, "Not the author" unless entry.author_account_id == viewer_account_id

        entry_repo.delete(entry_id)
        nil
      end
    end
  end
end
```

- [ ] **Step 4: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/update_entry_spec.rb spec/slices/review/use_cases/delete_entry_spec.rb`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/use_cases/update_entry.rb dystopia/monolith/slices/review/use_cases/delete_entry.rb dystopia/monolith/spec/slices/review/use_cases/update_entry_spec.rb dystopia/monolith/spec/slices/review/use_cases/delete_entry_spec.rb
git commit -s -m "feat(review): add UpdateEntry and DeleteEntry use cases (author-only)"
```

---

## Task 6: HideEntry / UnhideEntry use cases

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/hide_entry.rb`
- Create: `dystopia/monolith/slices/review/use_cases/unhide_entry.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/hide_entry_spec.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/unhide_entry_spec.rb`

**Interfaces:**
- Consumes: `Review::Repositories::EntryRepository#find_by_id`, `#update`（Task 2）
- Produces: `Review::UseCases::HideEntry#call(viewer_account_id:, entry_id:)`、`Review::UseCases::UnhideEntry#call(viewer_account_id:, entry_id:)`。どちらも target 以外を弾く。エラークラス: `HideEntry::NotFoundError` / `HideEntry::PermissionError`、`UnhideEntry::NotFoundError` / `UnhideEntry::PermissionError`

- [ ] **Step 1: 2つの spec を書く**

```ruby
# dystopia/monolith/spec/slices/review/use_cases/hide_entry_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::HideEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:target_id) { "target-1" }
  let(:entry_id) { "entry-1" }

  it "hides when called by the target" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, target_account_id: target_id))
    expect(entry_repo).to receive(:update).with(entry_id, hidden: true)

    use_case.call(viewer_account_id: target_id, entry_id: entry_id)
  end

  it "raises NotFoundError when the entry does not exist" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: target_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::HideEntry::NotFoundError)
  end

  it "raises PermissionError when the viewer is not the target" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, target_account_id: "someone-else"))
    expect {
      use_case.call(viewer_account_id: target_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::HideEntry::PermissionError)
  end
end
```

```ruby
# dystopia/monolith/spec/slices/review/use_cases/unhide_entry_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::UnhideEntry do
  let(:use_case) { described_class.new(entry_repo: entry_repo) }
  let(:entry_repo) { double(:entry_repository) }
  let(:target_id) { "target-1" }
  let(:entry_id) { "entry-1" }

  it "unhides when called by the target" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, target_account_id: target_id))
    expect(entry_repo).to receive(:update).with(entry_id, hidden: false)

    use_case.call(viewer_account_id: target_id, entry_id: entry_id)
  end

  it "raises NotFoundError when the entry does not exist" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id).and_return(nil)
    expect {
      use_case.call(viewer_account_id: target_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::UnhideEntry::NotFoundError)
  end

  it "raises PermissionError when the viewer is not the target" do
    allow(entry_repo).to receive(:find_by_id).with(entry_id)
      .and_return(double(:entry, target_account_id: "someone-else"))
    expect {
      use_case.call(viewer_account_id: target_id, entry_id: entry_id)
    }.to raise_error(Review::UseCases::UnhideEntry::PermissionError)
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/hide_entry_spec.rb spec/slices/review/use_cases/unhide_entry_spec.rb`
Expected: FAIL

- [ ] **Step 3: 2つの use case を実装する**

```ruby
# dystopia/monolith/slices/review/use_cases/hide_entry.rb
# frozen_string_literal: true

module Review
  module UseCases
    class HideEntry
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def call(viewer_account_id:, entry_id:)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry
        raise PermissionError, "Not the target" unless entry.target_account_id == viewer_account_id

        entry_repo.update(entry_id, hidden: true)
      end
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/use_cases/unhide_entry.rb
# frozen_string_literal: true

module Review
  module UseCases
    class UnhideEntry
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def call(viewer_account_id:, entry_id:)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry
        raise PermissionError, "Not the target" unless entry.target_account_id == viewer_account_id

        entry_repo.update(entry_id, hidden: false)
      end
    end
  end
end
```

- [ ] **Step 4: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/hide_entry_spec.rb spec/slices/review/use_cases/unhide_entry_spec.rb`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/use_cases/hide_entry.rb dystopia/monolith/slices/review/use_cases/unhide_entry.rb dystopia/monolith/spec/slices/review/use_cases/hide_entry_spec.rb dystopia/monolith/spec/slices/review/use_cases/unhide_entry_spec.rb
git commit -s -m "feat(review): add HideEntry and UnhideEntry use cases (target-only)"
```

---

## Task 7: BlockAdapter / MediaAdapter + FilterVisibleEntries use case

このタスクが spec の可視性ルール（self-view / Level A / Level B1 / Level B2）の核。

**Files:**
- Create: `dystopia/monolith/slices/review/adapters/block_adapter.rb`
- Create: `dystopia/monolith/slices/review/adapters/media_adapter.rb`
- Create: `dystopia/monolith/slices/review/use_cases/filter_visible_entries.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/filter_visible_entries_spec.rb`

**Interfaces:**
- Consumes: `Review::Repositories::CastSettingsRepository#find_by_account`（Task 3）、`Social::Slice["repositories.block_repository"].bidirectionally_blocked_ids`（既存、adapter 経由）、`Social::Slice["use_cases.filter_visible_posts"]`（既存 use case、`#author_id` を持つオブジェクトを受け取る）
- Produces: `Review::UseCases::FilterVisibleEntries#call(viewer_account_id:, page_owner_account_id:, entries:)` → 可視な entry の配列（順序維持）。Task 9（ListEntriesByTarget/ListEntriesByAuthor）がこれに依存する

- [ ] **Step 1: adapter を書く（テスト対象は use case 側でカバーするので adapter 自体に専用 spec は書かない。既存 `post/adapters/block_adapter.rb` も同様に無テスト）**

```ruby
# dystopia/monolith/slices/review/adapters/block_adapter.rb
# frozen_string_literal: true

module Review
  module Adapters
    class BlockAdapter
      def bidirectionally_blocked_ids(account_id:)
        block_repo.bidirectionally_blocked_ids(account_id: account_id)
      end

      private

      def block_repo
        @block_repo ||= ::Social::Slice["repositories.block_repository"]
      end
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/adapters/media_adapter.rb
# frozen_string_literal: true

module Review
  module Adapters
    class MediaAdapter
      def find_url(media_id)
        return "" if media_id.nil? || media_id.to_s.empty?
        get_media_batch.call(ids: [media_id]).first&.url || ""
      end

      private

      def get_media_batch
        @get_media_batch ||= ::Media::Slice["use_cases.get_media_batch"]
      end
    end
  end
end
```

- [ ] **Step 2: FilterVisibleEntries の spec を書く（可視性マトリクス）**

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::FilterVisibleEntries do
  let(:use_case) do
    described_class.new(
      cast_settings_repo: cast_settings_repo,
      block_adapter: block_adapter,
      filter_visible_posts: filter_visible_posts
    )
  end
  let(:cast_settings_repo) { double(:cast_settings_repository) }
  let(:block_adapter) { double(:block_adapter) }
  let(:filter_visible_posts) { double(:filter_visible_posts) }

  let(:viewer_id) { "viewer-1" }
  let(:page_owner_id) { "page-owner-1" }
  let(:other_id) { "other-1" }

  def entry(author:, target:, hidden: false)
    double(:entry, id: SecureRandom.uuid, author_account_id: author, target_account_id: target, hidden: hidden)
  end

  before do
    allow(cast_settings_repo).to receive(:find_by_account).and_return(nil) # default: reviews_visible = true
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).and_return([])
    allow(filter_visible_posts).to receive(:call).and_return([double(:post)]) # default: page owner reachable
  end

  it "self-view: returns everything including hidden, ignoring reviews_visible" do
    allow(cast_settings_repo).to receive(:find_by_account).with(page_owner_id).and_return(double(reviews_visible: false))
    entries = [entry(author: page_owner_id, target: other_id, hidden: true)]

    result = use_case.call(viewer_account_id: page_owner_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to eq(entries)
  end

  it "Level A: drops hidden entries for third-party viewers" do
    entries = [entry(author: page_owner_id, target: other_id, hidden: true)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "Level A: drops entries whose target has reviews_visible = false" do
    allow(cast_settings_repo).to receive(:find_by_account).with(other_id).and_return(double(reviews_visible: false))
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "keeps entries whose target has no settings row (default reviews_visible = true)" do
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to eq(entries)
  end

  it "Level B1: drops everything when the page owner is not reachable by the viewer (block/private)" do
    allow(filter_visible_posts).to receive(:call).and_return([])
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "Level B2: drops an entry when the viewer is blocked with the other party (author-list case)" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([other_id])
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "Level B2: drops an entry when the viewer is blocked with the other party (target-list case)" do
    allow(block_adapter).to receive(:bidirectionally_blocked_ids).with(account_id: viewer_id).and_return([other_id])
    entries = [entry(author: other_id, target: page_owner_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to be_empty
  end

  it "keeps an entry that passes every check" do
    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
    result = use_case.call(viewer_account_id: viewer_id, page_owner_account_id: page_owner_id, entries: entries)
    expect(result).to eq(entries)
  end
end
```

- [ ] **Step 3: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/filter_visible_entries_spec.rb`
Expected: FAIL

- [ ] **Step 4: FilterVisibleEntries を実装する**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class FilterVisibleEntries
      AuthorRef = Struct.new(:author_id)

      include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

      def initialize(cast_settings_repo: nil, block_adapter: nil, filter_visible_posts: nil, **kwargs)
        super(**kwargs.merge(cast_settings_repo: cast_settings_repo).compact)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
      end

      def call(viewer_account_id:, page_owner_account_id:, entries:)
        return entries if viewer_account_id == page_owner_account_id
        return [] if entries.empty?

        visible = entries.reject(&:hidden)
        return [] if visible.empty?

        visible_target_ids = visible.map(&:target_account_id).uniq.select { |id| reviews_visible?(id) }
        visible = visible.select { |e| visible_target_ids.include?(e.target_account_id) }
        return [] if visible.empty?

        return [] unless page_owner_reachable?(viewer_account_id, page_owner_account_id)

        blocked_ids = block_adapter.bidirectionally_blocked_ids(account_id: viewer_account_id)
        visible.reject { |e| blocked_ids.include?(other_party_id(e, page_owner_account_id)) }
      end

      private

      # target_account_id は呼び出し元のリストによって page_owner に固定される
      # (ListEntriesByTarget) か entry ごとに変わる (ListEntriesByAuthor) かが
      # 違うだけなので、常にユニークID単位でルックアップして両ケースに対応する。
      def reviews_visible?(target_account_id)
        settings = cast_settings_repo.find_by_account(target_account_id)
        settings.nil? || settings.reviews_visible != false
      end

      def page_owner_reachable?(viewer_account_id, page_owner_account_id)
        filter_visible_posts.call(
          viewer_account_id: viewer_account_id,
          posts: [AuthorRef.new(page_owner_account_id)]
        ).any?
      end

      def other_party_id(entry, page_owner_account_id)
        entry.author_account_id == page_owner_account_id ? entry.target_account_id : entry.author_account_id
      end

      def block_adapter
        @block_adapter ||= Review::Adapters::BlockAdapter.new
      end

      def filter_visible_posts
        @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
      end
    end
  end
end
```

- [ ] **Step 5: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/filter_visible_entries_spec.rb`
Expected: PASS（7 examples）

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/slices/review/adapters/ dystopia/monolith/slices/review/use_cases/filter_visible_entries.rb dystopia/monolith/spec/slices/review/use_cases/filter_visible_entries_spec.rb
git commit -s -m "feat(review): add FilterVisibleEntries (self-view / reviews_visible+hidden / block+private)"
```

---

## Task 8: GetMySettings / UpdateMySettings use cases

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/get_my_settings.rb`
- Create: `dystopia/monolith/slices/review/use_cases/update_my_settings.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/get_my_settings_spec.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/update_my_settings_spec.rb`

**Interfaces:**
- Consumes: `Review::Repositories::CastSettingsRepository`（Task 3）
- Produces: `GetMySettings#call(viewer_account_id:)` → `{ reviews_visible: bool }`、`UpdateMySettings#call(viewer_account_id:, reviews_visible:)` → `{ reviews_visible: bool }`

- [ ] **Step 1: 2つの spec を書く**

```ruby
# dystopia/monolith/spec/slices/review/use_cases/get_my_settings_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::GetMySettings do
  let(:use_case) { described_class.new(cast_settings_repo: cast_settings_repo) }
  let(:cast_settings_repo) { double(:cast_settings_repository) }
  let(:account_id) { "cast-1" }

  it "returns true when no settings row exists" do
    allow(cast_settings_repo).to receive(:find_by_account).with(account_id).and_return(nil)
    expect(use_case.call(viewer_account_id: account_id)).to eq(reviews_visible: true)
  end

  it "returns the stored value when a row exists" do
    allow(cast_settings_repo).to receive(:find_by_account).with(account_id).and_return(double(reviews_visible: false))
    expect(use_case.call(viewer_account_id: account_id)).to eq(reviews_visible: false)
  end
end
```

```ruby
# dystopia/monolith/spec/slices/review/use_cases/update_my_settings_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::UpdateMySettings do
  let(:use_case) { described_class.new(cast_settings_repo: cast_settings_repo) }
  let(:cast_settings_repo) { double(:cast_settings_repository) }
  let(:account_id) { "cast-1" }

  it "upserts and returns the new value" do
    expect(cast_settings_repo).to receive(:upsert).with(account_id: account_id, reviews_visible: false)
    expect(use_case.call(viewer_account_id: account_id, reviews_visible: false)).to eq(reviews_visible: false)
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/get_my_settings_spec.rb spec/slices/review/use_cases/update_my_settings_spec.rb`
Expected: FAIL

- [ ] **Step 3: 2つの use case を実装する**

```ruby
# dystopia/monolith/slices/review/use_cases/get_my_settings.rb
# frozen_string_literal: true

module Review
  module UseCases
    class GetMySettings
      include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

      def call(viewer_account_id:)
        settings = cast_settings_repo.find_by_account(viewer_account_id)
        { reviews_visible: settings.nil? || settings.reviews_visible != false }
      end
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/use_cases/update_my_settings.rb
# frozen_string_literal: true

module Review
  module UseCases
    class UpdateMySettings
      include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

      def call(viewer_account_id:, reviews_visible:)
        cast_settings_repo.upsert(account_id: viewer_account_id, reviews_visible: reviews_visible)
        { reviews_visible: reviews_visible }
      end
    end
  end
end
```

- [ ] **Step 4: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/get_my_settings_spec.rb spec/slices/review/use_cases/update_my_settings_spec.rb`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/use_cases/get_my_settings.rb dystopia/monolith/slices/review/use_cases/update_my_settings.rb dystopia/monolith/spec/slices/review/use_cases/get_my_settings_spec.rb dystopia/monolith/spec/slices/review/use_cases/update_my_settings_spec.rb
git commit -s -m "feat(review): add GetMySettings and UpdateMySettings use cases"
```

---

## Task 9: ListEntriesByTarget / ListEntriesByAuthor use cases

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/list_entries_by_target.rb`
- Create: `dystopia/monolith/slices/review/use_cases/list_entries_by_author.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/list_entries_by_target_spec.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/list_entries_by_author_spec.rb`

**Interfaces:**
- Consumes: `Review::Repositories::EntryRepository#list_by_target` / `#list_by_author`（Task 2）、`Review::Slice["use_cases.filter_visible_entries"]`（Task 7、コンテナ経由で解決）、`Profile::Slice["use_cases.get_profile"]`（既存）、`Review::Adapters::MediaAdapter`（Task 7）
- Produces: `ListEntriesByTarget#call(viewer_account_id:, target_account_id:, limit: 20, cursor: nil)` / `ListEntriesByAuthor#call(viewer_account_id:, author_account_id:, limit: 20, cursor: nil)` → `{ entries:, next_cursor:, has_more: }`。各 entry は `{ id:, author_account_id:, target_account_id:, author_username:, author_avatar_url:, rating:, body:, hidden:, created_at:, updated_at: }`

- [ ] **Step 1: 2つの spec を書く**

```ruby
# dystopia/monolith/spec/slices/review/use_cases/list_entries_by_target_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::ListEntriesByTarget do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      filter_visible_entries: filter_visible_entries,
      get_profile: get_profile,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo) { double(:entry_repository) }
  let(:filter_visible_entries) { double(:filter_visible_entries) }
  let(:get_profile) { double(:get_profile) }
  let(:media_adapter) { double(:media_adapter) }

  let(:viewer_id) { "viewer-1" }
  let(:target_id) { "target-1" }

  let(:raw_entry) do
    double(:entry,
      id: "e-1", author_account_id: "author-1", target_account_id: target_id,
      rating: 4.5, body: "nice", hidden: false,
      created_at: Time.now, updated_at: Time.now)
  end

  it "delegates filtering to FilterVisibleEntries with page_owner = target" do
    allow(entry_repo).to receive(:list_by_target)
      .with(target_account_id: target_id, limit: 20, cursor: nil)
      .and_return([raw_entry])
    expect(filter_visible_entries).to receive(:call).with(
      viewer_account_id: viewer_id, page_owner_account_id: target_id, entries: [raw_entry]
    ).and_return([raw_entry])
    allow(get_profile).to receive(:call).and_return(double(username: "guest1", avatar_media_id: nil))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id)
    expect(result[:entries].first[:id]).to eq("e-1")
    expect(result[:entries].first[:rating]).to eq(4.5)
    expect(result[:has_more]).to eq(false)
  end

  it "computes has_more/next_cursor from the raw page, before filtering" do
    entries = Array.new(21) { raw_entry }
    allow(entry_repo).to receive(:list_by_target).and_return(entries)
    allow(filter_visible_entries).to receive(:call).and_return([]) # everything filtered out
    allow(get_profile).to receive(:call).and_return(double(username: "g", avatar_media_id: nil))

    result = use_case.call(viewer_account_id: viewer_id, target_account_id: target_id, limit: 20)
    expect(result[:has_more]).to eq(true)
    expect(result[:next_cursor]).not_to be_nil
    expect(result[:entries]).to eq([])
  end
end
```

```ruby
# dystopia/monolith/spec/slices/review/use_cases/list_entries_by_author_spec.rb
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::ListEntriesByAuthor do
  let(:use_case) do
    described_class.new(
      entry_repo: entry_repo,
      filter_visible_entries: filter_visible_entries,
      get_profile: get_profile,
      media_adapter: media_adapter
    )
  end
  let(:entry_repo) { double(:entry_repository) }
  let(:filter_visible_entries) { double(:filter_visible_entries) }
  let(:get_profile) { double(:get_profile) }
  let(:media_adapter) { double(:media_adapter) }

  let(:viewer_id) { "viewer-1" }
  let(:author_id) { "author-1" }

  let(:raw_entry) do
    double(:entry,
      id: "e-1", author_account_id: author_id, target_account_id: "target-1",
      rating: 2.0, body: nil, hidden: false,
      created_at: Time.now, updated_at: Time.now)
  end

  it "delegates filtering to FilterVisibleEntries with page_owner = author" do
    allow(entry_repo).to receive(:list_by_author)
      .with(author_account_id: author_id, limit: 20, cursor: nil)
      .and_return([raw_entry])
    expect(filter_visible_entries).to receive(:call).with(
      viewer_account_id: viewer_id, page_owner_account_id: author_id, entries: [raw_entry]
    ).and_return([raw_entry])
    allow(get_profile).to receive(:call).and_return(double(username: "g", avatar_media_id: nil))

    result = use_case.call(viewer_account_id: viewer_id, author_account_id: author_id)
    expect(result[:entries].first[:id]).to eq("e-1")
  end
end
```

- [ ] **Step 2: spec を実行して失敗を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/list_entries_by_target_spec.rb spec/slices/review/use_cases/list_entries_by_author_spec.rb`
Expected: FAIL

- [ ] **Step 3: 2つの use case を実装する**

```ruby
# dystopia/monolith/slices/review/use_cases/list_entries_by_target.rb
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Review
  module UseCases
    class ListEntriesByTarget
      include Concerns::CursorPagination
      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, filter_visible_entries: nil, get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @filter_visible_entries = filter_visible_entries
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, target_account_id:, limit: 20, cursor: nil)
        page = entry_repo.list_by_target(target_account_id: target_account_id, limit: limit, cursor: cursor)
        has_more = page.length > limit
        page = page.take(limit)

        # フィルタは pagination の後段で行うため、可視な entry 数が limit を
        # 下回ることがある(既存の post いいねタブの hydration と同じ挙動)。
        visible = filter_visible_entries.call(
          viewer_account_id: viewer_account_id,
          page_owner_account_id: target_account_id,
          entries: page
        )

        next_cursor = if has_more && page.any?
          last = page.last
          # iso8601(6) keeps microseconds; plain iso8601 truncates to whole
          # seconds and silently drops same-second rows across a page
          # boundary (see Task 2's repository spec for the reproduction).
          encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
        end

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def present_with_author(e, profile_cache)
        profile = profile_cache[e.author_account_id] ||= get_profile.call(account_id: e.author_account_id)
        {
          id: e.id,
          author_account_id: e.author_account_id,
          target_account_id: e.target_account_id,
          author_username: profile&.username,
          author_avatar_url: avatar_url_for(profile),
          rating: e.rating.to_f,
          body: e.body,
          hidden: e.hidden,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end

      def avatar_url_for(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?
        media_adapter.find_url(profile.avatar_media_id)
      end

      def filter_visible_entries
        @filter_visible_entries ||= Review::Slice["use_cases.filter_visible_entries"]
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Review::Adapters::MediaAdapter.new
      end
    end
  end
end
```

```ruby
# dystopia/monolith/slices/review/use_cases/list_entries_by_author.rb
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Review
  module UseCases
    class ListEntriesByAuthor
      include Concerns::CursorPagination
      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, filter_visible_entries: nil, get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @filter_visible_entries = filter_visible_entries
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, author_account_id:, limit: 20, cursor: nil)
        page = entry_repo.list_by_author(author_account_id: author_account_id, limit: limit, cursor: cursor)
        has_more = page.length > limit
        page = page.take(limit)

        visible = filter_visible_entries.call(
          viewer_account_id: viewer_account_id,
          page_owner_account_id: author_account_id,
          entries: page
        )

        next_cursor = if has_more && page.any?
          last = page.last
          # iso8601(6) keeps microseconds; plain iso8601 truncates to whole
          # seconds and silently drops same-second rows across a page
          # boundary (see Task 2's repository spec for the reproduction).
          encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
        end

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def present_with_author(e, profile_cache)
        profile = profile_cache[e.author_account_id] ||= get_profile.call(account_id: e.author_account_id)
        {
          id: e.id,
          author_account_id: e.author_account_id,
          target_account_id: e.target_account_id,
          author_username: profile&.username,
          author_avatar_url: avatar_url_for(profile),
          rating: e.rating.to_f,
          body: e.body,
          hidden: e.hidden,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end

      def avatar_url_for(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?
        media_adapter.find_url(profile.avatar_media_id)
      end

      def filter_visible_entries
        @filter_visible_entries ||= Review::Slice["use_cases.filter_visible_entries"]
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Review::Adapters::MediaAdapter.new
      end
    end
  end
end
```

- [ ] **Step 4: spec を実行して通過を確認**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/list_entries_by_target_spec.rb spec/slices/review/use_cases/list_entries_by_author_spec.rb`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/use_cases/list_entries_by_target.rb dystopia/monolith/slices/review/use_cases/list_entries_by_author.rb dystopia/monolith/spec/slices/review/use_cases/list_entries_by_target_spec.rb dystopia/monolith/spec/slices/review/use_cases/list_entries_by_author_spec.rb
git commit -s -m "feat(review): add ListEntriesByTarget and ListEntriesByAuthor use cases"
```

---

## Task 10: proto定義 + codegen

**Files:**
- Create: `proto/dystopia/review/v1/service.proto`

**Interfaces:**
- Produces: `Review::V1::ReviewService`, リクエスト/レスポンスの全メッセージ型（Ruby側は `dystopia/monolith/stubs/review/`、frontend側は `dystopia/frontend/src/stub/review/` に生成される）。Task 11（gRPC handler）と Task 13〜14（frontend API routes）が依存する

- [ ] **Step 1: proto ファイルを書く**

```protobuf
syntax = "proto3";

package review.v1;

import "google/protobuf/timestamp.proto";

service ReviewService {
  rpc CreateEntry(CreateEntryRequest) returns (CreateEntryResponse);
  rpc UpdateEntry(UpdateEntryRequest) returns (UpdateEntryResponse);
  rpc DeleteEntry(DeleteEntryRequest) returns (DeleteEntryResponse);
  rpc HideEntry(HideEntryRequest) returns (HideEntryResponse);
  rpc UnhideEntry(UnhideEntryRequest) returns (UnhideEntryResponse);
  rpc ListEntriesByTarget(ListEntriesByTargetRequest) returns (ListEntriesByTargetResponse);
  rpc ListEntriesByAuthor(ListEntriesByAuthorRequest) returns (ListEntriesByAuthorResponse);
  rpc GetMySettings(GetMySettingsRequest) returns (GetMySettingsResponse);
  rpc UpdateMySettings(UpdateMySettingsRequest) returns (UpdateMySettingsResponse);
}

message ReviewEntry {
  string id = 1;
  string author_account_id = 2;
  string target_account_id = 3;
  string author_username = 4;
  string author_avatar_url = 5;
  double rating = 6;
  string body = 7;
  bool hidden = 8;
  google.protobuf.Timestamp created_at = 9;
  google.protobuf.Timestamp updated_at = 10;
}

message CreateEntryRequest {
  string target_account_id = 1;
  double rating = 2;
  string body = 3;
}
message CreateEntryResponse { ReviewEntry entry = 1; }

message UpdateEntryRequest {
  string entry_id = 1;
  double rating = 2;  // 0 = unchanged
  string body = 3;    // empty = unchanged
}
message UpdateEntryResponse { ReviewEntry entry = 1; }

message DeleteEntryRequest { string entry_id = 1; }
message DeleteEntryResponse {}

message HideEntryRequest { string entry_id = 1; }
message HideEntryResponse { ReviewEntry entry = 1; }

message UnhideEntryRequest { string entry_id = 1; }
message UnhideEntryResponse { ReviewEntry entry = 1; }

message ListEntriesByTargetRequest {
  string target_account_id = 1;
  int32 limit = 2;    // default 20
  string cursor = 3;
}
message ListEntriesByTargetResponse {
  repeated ReviewEntry entries = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ListEntriesByAuthorRequest {
  string author_account_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
message ListEntriesByAuthorResponse {
  repeated ReviewEntry entries = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message GetMySettingsRequest {}
message GetMySettingsResponse { bool reviews_visible = 1; }

message UpdateMySettingsRequest { bool reviews_visible = 1; }
message UpdateMySettingsResponse { bool reviews_visible = 1; }
```

- [ ] **Step 2: backend の stub を生成する**

Run: `cd dystopia/monolith && bin/codegen`
Expected: `✅ Done.`、`dystopia/monolith/stubs/review/v1/` に `service_pb.rb` / `service_services_pb.rb` が生成される

- [ ] **Step 3: frontend の stub を生成する**

Run: `cd dystopia/frontend && pnpm run proto:gen`
Expected: `dystopia/frontend/src/stub/review/v1/` に TypeScript stub が生成される

- [ ] **Step 4: Commit**

```bash
git add proto/dystopia/review/ dystopia/monolith/stubs/review/ dystopia/frontend/src/stub/review/
git commit -s -m "feat(review): add ReviewService proto and generated stubs"
```

---

## Task 11: gRPC handler + bin/grpc 登録

**Files:**
- Create: `dystopia/monolith/slices/review/grpc/handler.rb`
- Create: `dystopia/monolith/slices/review/grpc/review_handler.rb`
- Modify: `dystopia/monolith/bin/grpc`

**Interfaces:**
- Consumes: 全 use case（Task 4〜9）、proto stub（Task 10）
- Produces: gRPC service `review.v1.ReviewService` が `bin/grpc` 起動時に登録される

- [ ] **Step 1: base handler を書く**

```ruby
# dystopia/monolith/slices/review/grpc/handler.rb
# frozen_string_literal: true

module Review
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
    end
  end
end
```

- [ ] **Step 2: ReviewHandler を書く**

```ruby
# dystopia/monolith/slices/review/grpc/review_handler.rb
# frozen_string_literal: true

require "review/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Review
  module Grpc
    class ReviewHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "review.v1.ReviewService"

      bind ::Review::V1::ReviewService::Service

      self.rpc_descs.clear

      rpc :CreateEntry,         ::Review::V1::CreateEntryRequest,         ::Review::V1::CreateEntryResponse
      rpc :UpdateEntry,         ::Review::V1::UpdateEntryRequest,         ::Review::V1::UpdateEntryResponse
      rpc :DeleteEntry,         ::Review::V1::DeleteEntryRequest,         ::Review::V1::DeleteEntryResponse
      rpc :HideEntry,           ::Review::V1::HideEntryRequest,           ::Review::V1::HideEntryResponse
      rpc :UnhideEntry,         ::Review::V1::UnhideEntryRequest,         ::Review::V1::UnhideEntryResponse
      rpc :ListEntriesByTarget, ::Review::V1::ListEntriesByTargetRequest, ::Review::V1::ListEntriesByTargetResponse
      rpc :ListEntriesByAuthor, ::Review::V1::ListEntriesByAuthorRequest, ::Review::V1::ListEntriesByAuthorResponse
      rpc :GetMySettings,       ::Review::V1::GetMySettingsRequest,       ::Review::V1::GetMySettingsResponse
      rpc :UpdateMySettings,    ::Review::V1::UpdateMySettingsRequest,    ::Review::V1::UpdateMySettingsResponse

      include Review::Deps[
        create_uc:           "use_cases.create_entry",
        update_uc:           "use_cases.update_entry",
        delete_uc:           "use_cases.delete_entry",
        hide_uc:             "use_cases.hide_entry",
        unhide_uc:           "use_cases.unhide_entry",
        list_by_target_uc:   "use_cases.list_entries_by_target",
        list_by_author_uc:   "use_cases.list_entries_by_author",
        get_settings_uc:     "use_cases.get_my_settings",
        update_settings_uc:  "use_cases.update_my_settings"
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
        ::Review::V1::CreateEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
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
        ::Review::V1::UpdateEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
      end

      def delete_entry
        authenticate_user!
        wrap_errors do
          delete_uc.call(viewer_account_id: current_user_id, entry_id: request.message.entry_id)
        end
        ::Review::V1::DeleteEntryResponse.new
      end

      def hide_entry
        authenticate_user!
        entry = wrap_errors do
          hide_uc.call(viewer_account_id: current_user_id, entry_id: request.message.entry_id)
        end
        ::Review::V1::HideEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
      end

      def unhide_entry
        authenticate_user!
        entry = wrap_errors do
          unhide_uc.call(viewer_account_id: current_user_id, entry_id: request.message.entry_id)
        end
        ::Review::V1::UnhideEntryResponse.new(entry: entry_to_proto(present_for_actor(entry)))
      end

      def list_entries_by_target
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = list_by_target_uc.call(
          viewer_account_id: current_user_id,
          target_account_id: request.message.target_account_id,
          limit: limit,
          cursor: cursor
        )
        ::Review::V1::ListEntriesByTargetResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_entries_by_author
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        result = list_by_author_uc.call(
          viewer_account_id: current_user_id,
          author_account_id: request.message.author_account_id,
          limit: limit,
          cursor: cursor
        )
        ::Review::V1::ListEntriesByAuthorResponse.new(
          entries: result[:entries].map { |e| entry_to_proto(e) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_my_settings
        authenticate_user!
        result = get_settings_uc.call(viewer_account_id: current_user_id)
        ::Review::V1::GetMySettingsResponse.new(reviews_visible: result[:reviews_visible])
      end

      def update_my_settings
        authenticate_user!
        result = update_settings_uc.call(
          viewer_account_id: current_user_id,
          reviews_visible: request.message.reviews_visible
        )
        ::Review::V1::UpdateMySettingsResponse.new(reviews_visible: result[:reviews_visible])
      end

      private

      def wrap_errors
        yield
      rescue Review::UseCases::CreateEntry::CreateError,
             Review::UseCases::UpdateEntry::UpdateError => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      rescue Review::UseCases::UpdateEntry::NotFoundError,
             Review::UseCases::DeleteEntry::NotFoundError,
             Review::UseCases::HideEntry::NotFoundError,
             Review::UseCases::UnhideEntry::NotFoundError => e
        fail!(:not_found, :not_found, e.message)
      rescue Review::UseCases::UpdateEntry::PermissionError,
             Review::UseCases::DeleteEntry::PermissionError,
             Review::UseCases::HideEntry::PermissionError,
             Review::UseCases::UnhideEntry::PermissionError => e
        fail!(:permission_denied, :permission_denied, e.message)
      end

      def present_for_actor(entry)
        profile = ::Profile::Slice["use_cases.get_profile"].call(account_id: entry.author_account_id)
        media = ::Review::Adapters::MediaAdapter.new
        {
          id: entry.id,
          author_account_id: entry.author_account_id,
          target_account_id: entry.target_account_id,
          author_username: profile&.username,
          author_avatar_url: media.find_url(profile&.avatar_media_id),
          rating: entry.rating.to_f,
          body: entry.body,
          hidden: entry.hidden,
          created_at: entry.created_at,
          updated_at: entry.updated_at
        }
      end

      def entry_to_proto(e)
        ::Review::V1::ReviewEntry.new(
          id: e[:id].to_s,
          author_account_id: e[:author_account_id].to_s,
          target_account_id: e[:target_account_id].to_s,
          author_username: e[:author_username] || "",
          author_avatar_url: e[:author_avatar_url] || "",
          rating: e[:rating],
          body: e[:body] || "",
          hidden: e[:hidden],
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

- [ ] **Step 3: `bin/grpc` に登録する**

`dystopia/monolith/bin/grpc` の karte 登録箇所（`require "karte/v1/service_services_pb"` 付近と `require_relative "../slices/karte/grpc/handler"` / `"../slices/karte/grpc/karte_handler"` 付近）に倣い、以下の3行を対応する場所に追加する。

```ruby
require "review/v1/service_services_pb"
```
```ruby
require_relative "../slices/review/grpc/handler"
require_relative "../slices/review/grpc/review_handler"
```

- [ ] **Step 4: gRPC サーバーが正常に起動することを確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec ruby -c bin/grpc`
Expected: `Syntax OK`

Run: `cd dystopia/monolith && HANAMI_ENV=development bin/grpc &` （数秒待ってログを確認後、プロセスを止める）
Expected: 起動ログに `review.v1.ReviewService` が登録された旨のエラーが出ないこと（既存 karte 等と同様に一覧に現れる、または少なくとも `LoadError` / `NameError` が出ない）

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/grpc/ dystopia/monolith/bin/grpc
git commit -s -m "feat(review): add gRPC handler and register ReviewService in bin/grpc"
```

---

## Task 12: Frontend 型定義 + gRPC client + mutation API routes

**Files:**
- Create: `dystopia/frontend/src/modules/review/types.ts`
- Modify: `dystopia/frontend/src/lib/grpc.ts`
- Create: `dystopia/frontend/src/app/api/review/route.ts`
- Create: `dystopia/frontend/src/app/api/review/[id]/route.ts`
- Create: `dystopia/frontend/src/app/api/review/[id]/hide/route.ts`
- Create: `dystopia/frontend/src/app/api/review/[id]/unhide/route.ts`

**Interfaces:**
- Consumes: `Review::V1::ReviewService`（Task 10〜11）
- Produces: `ReviewEntry`, `PaginatedReviewByTargetResponse`, `PaginatedReviewByAuthorResponse`, `ReviewSettings` 型。`reviewClient`。`POST /api/review`, `PATCH /api/review/[id]`, `DELETE /api/review/[id]`, `POST /api/review/[id]/hide`, `POST /api/review/[id]/unhide`

- [ ] **Step 1: 型定義を書く**

```typescript
// dystopia/frontend/src/modules/review/types.ts
export interface ReviewEntry {
  id: string;
  authorAccountId: string;
  targetAccountId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  rating: number;
  body: string;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedReviewByTargetResponse {
  entries: ReviewEntry[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PaginatedReviewByAuthorResponse {
  entries: ReviewEntry[];
  nextCursor: string;
  hasMore: boolean;
}

export interface ReviewSettings {
  reviewsVisible: boolean;
}
```

- [ ] **Step 2: `lib/grpc.ts` に `reviewClient` を追加する**

`dystopia/frontend/src/lib/grpc.ts` の karte の import・client 定義（`import { KarteService } from "@/stub/karte/v1/service_pb";` / `export const karteClient = createClient(KarteService, transport);`）と同じ形で追記する。

```typescript
import { ReviewService } from "@/stub/review/v1/service_pb";
```
```typescript
export const reviewClient = createClient(ReviewService, transport);
```

- [ ] **Step 3: create/update/delete route を書く**

```typescript
// dystopia/frontend/src/app/api/review/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

function entryToView(e: NonNullable<Awaited<ReturnType<typeof reviewClient.createEntry>>["entry"]>) {
  return {
    id: e.id,
    authorAccountId: e.authorAccountId,
    targetAccountId: e.targetAccountId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    hidden: !!e.hidden,
    createdAt: e.createdAt ? new Date(Number(e.createdAt.seconds) * 1000).toISOString() : "",
    updatedAt: e.updatedAt ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString() : "",
  };
}

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
    const res = await reviewClient.createEntry(
      { targetAccountId, rating, body: text },
      { headers: await buildGrpcHeaders(req) }
    );
    if (!res.entry) {
      return NextResponse.json({ error: "create returned empty entry" }, { status: 500 });
    }
    return NextResponse.json({ entry: entryToView(res.entry) });
  } catch (error: unknown) {
    return handleApiError(error, "CreateReview");
  }
}
```

```typescript
// dystopia/frontend/src/app/api/review/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

function entryToView(e: NonNullable<Awaited<ReturnType<typeof reviewClient.updateEntry>>["entry"]>) {
  return {
    id: e.id,
    authorAccountId: e.authorAccountId,
    targetAccountId: e.targetAccountId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    hidden: !!e.hidden,
    createdAt: e.createdAt ? new Date(Number(e.createdAt.seconds) * 1000).toISOString() : "",
    updatedAt: e.updatedAt ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString() : "",
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    const body = await req.json();
    const rating = body.rating === undefined ? 0 : Number(body.rating);
    const text = typeof body.body === "string" ? body.body : "";
    const res = await reviewClient.updateEntry(
      { entryId: id, rating, body: text },
      { headers: await buildGrpcHeaders(req) }
    );
    if (!res.entry) {
      return NextResponse.json({ error: "update returned empty entry" }, { status: 500 });
    }
    return NextResponse.json({ entry: entryToView(res.entry) });
  } catch (error: unknown) {
    return handleApiError(error, "UpdateReview");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await reviewClient.deleteEntry({ entryId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteReview");
  }
}
```

```typescript
// dystopia/frontend/src/app/api/review/[id]/hide/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await reviewClient.hideEntry({ entryId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "HideReview");
  }
}
```

```typescript
// dystopia/frontend/src/app/api/review/[id]/unhide/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await reviewClient.unhideEntry({ entryId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "UnhideReview");
  }
}
```

- [ ] **Step 4: 型チェックを通す**

Run: `cd dystopia/frontend && npx tsc --noEmit`
Expected: エラーなし（Task 10 で stub が生成済みであること）

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/modules/review/types.ts dystopia/frontend/src/lib/grpc.ts dystopia/frontend/src/app/api/review/route.ts "dystopia/frontend/src/app/api/review/[id]/route.ts" "dystopia/frontend/src/app/api/review/[id]/hide/route.ts" "dystopia/frontend/src/app/api/review/[id]/unhide/route.ts"
git commit -s -m "feat(review): add frontend types, gRPC client, and mutation API routes"
```

---

## Task 13: Frontend 読み取り API routes（by-target / by-author / settings）

**Files:**
- Create: `dystopia/frontend/src/app/api/review/by-target/route.ts`
- Create: `dystopia/frontend/src/app/api/review/by-author/route.ts`
- Create: `dystopia/frontend/src/app/api/review/settings/route.ts`

**Interfaces:**
- Consumes: `reviewClient`（Task 12）
- Produces: `GET /api/review/by-target?account_id=...&limit=...&cursor=...`, `GET /api/review/by-author?account_id=...&limit=...&cursor=...`, `GET /api/review/settings`, `PATCH /api/review/settings`

- [ ] **Step 1: by-target / by-author route を書く**

```typescript
// dystopia/frontend/src/app/api/review/by-target/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

type ListEntry = Awaited<ReturnType<typeof reviewClient.listEntriesByTarget>>["entries"][number];

function entryToView(e: ListEntry) {
  return {
    id: e.id,
    authorAccountId: e.authorAccountId,
    targetAccountId: e.targetAccountId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    hidden: !!e.hidden,
    createdAt: e.createdAt ? new Date(Number(e.createdAt.seconds) * 1000).toISOString() : "",
    updatedAt: e.updatedAt ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString() : "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const targetAccountId = req.nextUrl.searchParams.get("account_id") || "";
    if (!targetAccountId) {
      return NextResponse.json({ error: "account_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await reviewClient.listEntriesByTarget({ targetAccountId, limit, cursor }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map(entryToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReviewsByTarget");
  }
}
```

```typescript
// dystopia/frontend/src/app/api/review/by-author/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

type ListEntry = Awaited<ReturnType<typeof reviewClient.listEntriesByAuthor>>["entries"][number];

function entryToView(e: ListEntry) {
  return {
    id: e.id,
    authorAccountId: e.authorAccountId,
    targetAccountId: e.targetAccountId,
    authorUsername: e.authorUsername || "",
    authorAvatarUrl: e.authorAvatarUrl || "",
    rating: e.rating,
    body: e.body || "",
    hidden: !!e.hidden,
    createdAt: e.createdAt ? new Date(Number(e.createdAt.seconds) * 1000).toISOString() : "",
    updatedAt: e.updatedAt ? new Date(Number(e.updatedAt.seconds) * 1000).toISOString() : "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = await buildGrpcHeaders(req);
    const authorAccountId = req.nextUrl.searchParams.get("account_id") || "";
    if (!authorAccountId) {
      return NextResponse.json({ error: "account_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await reviewClient.listEntriesByAuthor({ authorAccountId, limit, cursor }, { headers });
    return NextResponse.json({
      entries: (res.entries || []).map(entryToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReviewsByAuthor");
  }
}
```

- [ ] **Step 2: settings route を書く（GET/PATCH 1ファイル）**

```typescript
// dystopia/frontend/src/app/api/review/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const res = await reviewClient.getMySettings({}, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ reviewsVisible: !!res.reviewsVisible });
  } catch (error: unknown) {
    return handleApiError(error, "GetReviewSettings");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const body = await req.json();
    const reviewsVisible = !!body.reviewsVisible;
    const res = await reviewClient.updateMySettings(
      { reviewsVisible },
      { headers: await buildGrpcHeaders(req) }
    );
    return NextResponse.json({ reviewsVisible: !!res.reviewsVisible });
  } catch (error: unknown) {
    return handleApiError(error, "UpdateReviewSettings");
  }
}
```

- [ ] **Step 3: 型チェックを通す**

Run: `cd dystopia/frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add dystopia/frontend/src/app/api/review/by-target/route.ts dystopia/frontend/src/app/api/review/by-author/route.ts dystopia/frontend/src/app/api/review/settings/route.ts
git commit -s -m "feat(review): add frontend read API routes (by-target, by-author, settings)"
```

---

## Task 14: Frontend hooks

**Files:**
- Create: `dystopia/frontend/src/modules/review/hooks/useCreateReview.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useUpdateReview.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useDeleteReview.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useHideReview.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useUnhideReview.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useReviewsByTarget.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useReviewsByAuthor.ts`
- Create: `dystopia/frontend/src/modules/review/hooks/useReviewSettings.ts`

**Interfaces:**
- Consumes: `authFetch`, `useSWR`/`useSWRInfinite`, `fetcher`（既存 lib）、Task 12〜13 の API routes
- Produces: 各 use case に対応する hook。Task 15（components）が依存する

- [ ] **Step 1: mutation hooks を書く**

```typescript
// dystopia/frontend/src/modules/review/hooks/useCreateReview.ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { ReviewEntry } from "../types";

export function useCreateReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (
    targetAccountId: string,
    rating: number,
    body: string
  ): Promise<ReviewEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ entry: ReviewEntry }>("/api/review", {
        method: "POST",
        body: { targetAccountId, rating, body },
      });
      return res.entry;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to create review"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}
```

```typescript
// dystopia/frontend/src/modules/review/hooks/useUpdateReview.ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { ReviewEntry } from "../types";

export function useUpdateReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (
    entryId: string,
    rating: number,
    body: string
  ): Promise<ReviewEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ entry: ReviewEntry }>(`/api/review/${entryId}`, {
        method: "PATCH",
        body: { rating, body },
      });
      return res.entry;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to update review"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { update, loading, error };
}
```

```typescript
// dystopia/frontend/src/modules/review/hooks/useDeleteReview.ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useDeleteReview() {
  const [loading, setLoading] = useState(false);

  const remove = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await authFetch(`/api/review/${entryId}`, { method: "DELETE" });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading };
}
```

```typescript
// dystopia/frontend/src/modules/review/hooks/useHideReview.ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useHideReview() {
  const [loading, setLoading] = useState(false);

  const hide = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await authFetch(`/api/review/${entryId}/hide`, { method: "POST" });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { hide, loading };
}
```

```typescript
// dystopia/frontend/src/modules/review/hooks/useUnhideReview.ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";

export function useUnhideReview() {
  const [loading, setLoading] = useState(false);

  const unhide = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await authFetch(`/api/review/${entryId}/unhide`, { method: "POST" });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { unhide, loading };
}
```

- [ ] **Step 2: 一覧 hooks (useSWRInfinite) を書く**

```typescript
// dystopia/frontend/src/modules/review/hooks/useReviewsByTarget.ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedReviewByTargetResponse } from "../types";

export function useReviewsByTarget(targetAccountId: string | null | undefined) {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedReviewByTargetResponse | null): string | null => {
    if (!userId || !targetAccountId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/review/by-target?account_id=${encodeURIComponent(targetAccountId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedReviewByTargetResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const entries = pages.flatMap((p) => p.entries || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    entries,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

```typescript
// dystopia/frontend/src/modules/review/hooks/useReviewsByAuthor.ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { PaginatedReviewByAuthorResponse } from "../types";

export function useReviewsByAuthor(authorAccountId: string | null | undefined) {
  const userId = useAuthStore((s) => s.userId);

  const getKey = (pageIndex: number, prev: PaginatedReviewByAuthorResponse | null): string | null => {
    if (!userId || !authorAccountId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/review/by-author?account_id=${encodeURIComponent(authorAccountId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedReviewByAuthorResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const entries = pages.flatMap((p) => p.entries || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  return {
    entries,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

- [ ] **Step 3: settings hook を書く**

```typescript
// dystopia/frontend/src/modules/review/hooks/useReviewSettings.ts
"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";
import type { ReviewSettings } from "../types";

export function useReviewSettings() {
  const userId = useAuthStore((s) => s.userId);
  const { data, isLoading, mutate } = useSWR<ReviewSettings>(
    userId ? "/api/review/settings" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const [saving, setSaving] = useState(false);

  const update = useCallback(async (reviewsVisible: boolean) => {
    setSaving(true);
    try {
      const res = await authFetch<ReviewSettings>("/api/review/settings", {
        method: "PATCH",
        body: { reviewsVisible },
      });
      await mutate(res, { revalidate: false });
      return res;
    } finally {
      setSaving(false);
    }
  }, [mutate]);

  return {
    reviewsVisible: data?.reviewsVisible ?? true,
    loading: isLoading,
    saving,
    update,
  };
}
```

- [ ] **Step 4: 型チェックを通す**

Run: `cd dystopia/frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/modules/review/hooks/
git commit -s -m "feat(review): add frontend hooks"
```

---

## Task 15: Frontend components + プロフィールページ/設定ページへの組み込み

**Files:**
- Create: `dystopia/frontend/src/modules/review/components/ReviewComposer.tsx`
- Create: `dystopia/frontend/src/modules/review/components/ReviewEntryCard.tsx`
- Create: `dystopia/frontend/src/modules/review/components/ReviewsTab.tsx`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`
- Create: `dystopia/frontend/src/app/settings/reviews/page.tsx`

**Interfaces:**
- Consumes: Task 14 の全 hooks
- Produces: `ReviewsTab` が `ProfileContentTabs` の `extraTabs` に注入され、Guest/Cast どちらの `/u/[username]` でも「書いたレビュー」「受信レビュー」タブとして表示される。`/settings/reviews` で Cast が `reviewsVisible` を切り替えられる

- [ ] **Step 1: ReviewComposer を書く**

0.5刻みの評価は `<select>` の数値ラベルで表現する（半星グリフの独自表現はしない）。

```typescript
// dystopia/frontend/src/modules/review/components/ReviewComposer.tsx
"use client";

import { useState } from "react";
import { useCreateReview } from "../hooks/useCreateReview";

interface Props {
  targetAccountId: string;
  onCreated?: () => void;
}

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

export function ReviewComposer({ targetAccountId, onCreated }: Props) {
  const { create, loading, error } = useCreateReview();
  const [rating, setRating] = useState(5);
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
        {RATING_OPTIONS.map((n) => (
          <option key={n} value={n}>
            ★ {n.toFixed(1)}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-sm font-medium">レビュー (任意、500 文字まで)</label>
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
        投稿
      </button>
    </form>
  );
}
```

- [ ] **Step 2: ReviewEntryCard を書く**

author（Guest本人）には削除、target（Cast本人）には非表示/表示切り替えを出し分ける。

```typescript
// dystopia/frontend/src/modules/review/components/ReviewEntryCard.tsx
"use client";

import Image from "next/image";
import { useDeleteReview } from "../hooks/useDeleteReview";
import { useHideReview } from "../hooks/useHideReview";
import { useUnhideReview } from "../hooks/useUnhideReview";
import { useAuthStore } from "@/stores/authStore";
import { formatTimeAgo } from "@/lib/utils/date";
import type { ReviewEntry } from "../types";

interface Props {
  entry: ReviewEntry;
  onChanged?: () => void;
}

export function ReviewEntryCard({ entry, onChanged }: Props) {
  const viewerId = useAuthStore((s) => s.userId);
  const isAuthor = viewerId === entry.authorAccountId;
  const isTarget = viewerId === entry.targetAccountId;
  const { remove, loading: deleting } = useDeleteReview();
  const { hide, loading: hiding } = useHideReview();
  const { unhide, loading: unhiding } = useUnhideReview();

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
        <span className="font-medium">{entry.authorUsername || "(退会済)"}</span>
        <span className="text-muted-foreground">{formatTimeAgo(entry.createdAt)}</span>
        {isTarget && entry.hidden && (
          <span className="ml-auto text-xs text-amber-600">非表示中</span>
        )}
      </div>
      <div className="mt-1 text-base">★ {entry.rating.toFixed(1)}</div>
      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
      <div className="mt-2 flex gap-3 text-sm text-muted-foreground">
        {isAuthor && (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (!confirm("このレビューを削除しますか？")) return;
              await remove(entry.id);
              onChanged?.();
            }}
            className="hover:text-foreground"
          >
            削除
          </button>
        )}
        {isTarget && (
          entry.hidden ? (
            <button
              type="button"
              disabled={unhiding}
              onClick={async () => {
                await unhide(entry.id);
                onChanged?.();
              }}
              className="hover:text-foreground"
            >
              表示に戻す
            </button>
          ) : (
            <button
              type="button"
              disabled={hiding}
              onClick={async () => {
                await hide(entry.id);
                onChanged?.();
              }}
              className="hover:text-foreground"
            >
              非表示にする
            </button>
          )
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 3: ReviewsTab を書く**

Guest/Cast どちらの文脈でも使える1コンポーネントにし、`mode` で作者側一覧か受信側一覧かを切り替える。

```typescript
// dystopia/frontend/src/modules/review/components/ReviewsTab.tsx
"use client";

import { useReviewsByTarget } from "../hooks/useReviewsByTarget";
import { useReviewsByAuthor } from "../hooks/useReviewsByAuthor";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewEntryCard } from "./ReviewEntryCard";

interface Props {
  accountId: string;
  mode: "received" | "written";
}

export function ReviewsTab({ accountId, mode }: Props) {
  const byTarget = useReviewsByTarget(mode === "received" ? accountId : null);
  const byAuthor = useReviewsByAuthor(mode === "written" ? accountId : null);
  const { entries, hasMore, loading, loadMore, refresh } =
    mode === "received" ? byTarget : byAuthor;

  return (
    <div>
      {mode === "received" && <ReviewComposer targetAccountId={accountId} onCreated={refresh} />}
      {entries.map((e) => (
        <ReviewEntryCard key={e.id} entry={e} onChanged={refresh} />
      ))}
      {loading && <div className="px-4 py-3 text-sm text-muted-foreground">読み込み中…</div>}
      {!loading && entries.length === 0 && (
        <div className="px-4 py-3 text-sm text-muted-foreground">まだレビューはありません。</div>
      )}
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

- [ ] **Step 4: `u/[username]/page.tsx` に組み込む**

karte は `role === "guest"` のときだけ `extraTabs` を出していたが、review は Guest/Cast 両方に出す（ラベルと `mode` を出し分ける）。`ProfileContentTabs` の `extraTabs` は配列を単純に連結するだけなので、karte の要素と review の要素を同じ配列にまとめる。

```typescript
import { ReviewsTab } from "@/modules/review/components/ReviewsTab";
```

`extraTabs` の組み立てを以下に置き換える。

```typescript
      <ProfileContentTabs
        accountId={profile.accountId}
        extraTabs={[
          ...(role === "guest" && karteAccess
            ? [{ id: "karte", label: "カルテ", content: <GuestKarteTab guestAccountId={profile.accountId} /> }]
            : []),
          {
            id: "reviews",
            label: role === "cast" ? "受信レビュー" : "書いたレビュー",
            content: (
              <ReviewsTab
                accountId={profile.accountId}
                mode={role === "cast" ? "received" : "written"}
              />
            ),
          },
        ]}
      />
```

- [ ] **Step 5: 設定ページを書く**

```typescript
// dystopia/frontend/src/app/settings/reviews/page.tsx
"use client";

import { useReviewSettings } from "@/modules/review/hooks/useReviewSettings";

export default function ReviewSettingsPage() {
  const { reviewsVisible, loading, saving, update } = useReviewSettings();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">レビュー設定</h1>
        <p className="pt-1 text-sm text-text-secondary">
          オフにすると、自分宛のレビューが新規投稿以降も含めて第三者から見えなくなります。
        </p>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      ) : (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-medium">レビューを表示する</span>
          <button
            type="button"
            disabled={saving}
            onClick={() => update(!reviewsVisible)}
            className={`rounded px-3 py-1 text-sm ${
              reviewsVisible ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {reviewsVisible ? "ON" : "OFF"}
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: 型チェックを通す**

Run: `cd dystopia/frontend && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: Commit**

```bash
git add dystopia/frontend/src/modules/review/components/ "dystopia/frontend/src/app/u/[username]/page.tsx" dystopia/frontend/src/app/settings/reviews/
git commit -s -m "feat(review): add frontend components and wire into profile/settings pages"
```

---

## Task 16: 手動E2E検証

自動テストでカバーしていない、実際のブラウザ操作での確認。`run` skill があれば利用する。なければ手動で以下を行う。

**Files:** なし（検証のみ）

- [ ] **Step 1: バックエンド・フロントエンドを起動する**

Run: `cd dystopia/monolith && HANAMI_ENV=development bin/grpc &`（別ターミナルで）
Run: `cd dystopia/monolith && HANAMI_ENV=development bin/dev &`（HTTP側、既存の起動手順に従う）
Run: `cd dystopia/frontend && pnpm dev`

- [ ] **Step 2: Guest アカウントで Cast プロフィールにレビューを投稿する**

1. Guest でログイン
2. 任意の Cast の `/u/[username]` を開く
3. 「受信レビュー」タブでレビューを投稿（★3.5、本文あり）
4. 一覧に即座に反映されることを確認
5. 同じ Guest で自分のプロフィール（`/u/[自分]`) の「書いたレビュー」タブに同じレビューが出ることを確認

- [ ] **Step 3: Cast アカウントで非表示を確認する**

1. その Cast でログイン
2. 自分のプロフィールの「受信レビュー」タブで、Step 2 のレビューに「非表示にする」ボタンがあることを確認し、押す
3. 別ブラウザ（未ログイン or 別 Guest）で同じ Cast のプロフィールを開き、そのレビューが一覧から消えていることを確認
4. Step 2 の Guest 本人で自分の「書いたレビュー」タブを開き、レビューが「非表示中」バッジ付きでまだ見えることを確認
5. Cast 側で「表示に戻す」を押し、他 Guest から見えるようになることを確認

- [ ] **Step 4: `reviews_visible` OFF でも書き込みが通ることを確認する**

1. Cast で `/settings/reviews` を開き、「レビューを表示する」を OFF にする
2. 別の Guest でその Cast のプロフィールを開き、「レビューを書く」フォームがまだ表示されていることを確認し、投稿する
3. 投稿が成功すること（エラーにならないこと）を確認
4. 第三者から見た Cast のプロフィールにはそのレビューが出ないが、投稿した Guest 自身の「書いたレビュー」タブには出ることを確認
5. Cast で設定を再度 ON に戻し、そのレビューが Cast の受信レビュー一覧に現れることを確認

- [ ] **Step 5: block 済みアカウントとの相互作用を確認する**

1. Guest A が Cast B をブロックする
2. Cast B が Guest A の書いたレビュー（B宛て）を持っている状態で、Guest A の「書いたレビュー」タブを別アカウントから見て、そのレビューが表示されないことを確認

- [ ] **Step 6: 確認結果を記録する**

問題があれば該当タスクに戻って修正し、該当タスクの回帰テストも合わせて更新する。全て問題なければ次に進む。
