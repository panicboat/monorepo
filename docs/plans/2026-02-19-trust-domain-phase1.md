# Trust Domain Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** キャスト⇔ゲストの双方向タグ機能を Trust ドメインとして新設する。

**Architecture:** 既存の Modular Monolith パターン（Hanami slices + gRPC/Gruf + Next.js BFF）に従い、Trust スライスを新設。identity_id を共通キーとした双方向タグシステム。キャスト→ゲストは即時承認、ゲスト→キャストは承認制。

**Tech Stack:** Ruby/Hanami 2.x + ROM + Gruf (Backend), Next.js App Router + ConnectRPC (Frontend), Protocol Buffers (API)

**Design Doc:** `docs/plans/2026-02-19-trust-domain-design.md`

---

## Task 1: Proto Definition

**Files:**
- Create: `proto/trust/v1/service.proto`

**Step 1: Create proto file**

```protobuf
syntax = "proto3";

package trust.v1;

service TrustService {
  // Tag CRUD (own tags)
  rpc ListTags(ListTagsRequest) returns (ListTagsResponse);
  rpc CreateTag(CreateTagRequest) returns (CreateTagResponse);
  rpc DeleteTag(DeleteTagRequest) returns (DeleteTagResponse);

  // Tagging operations
  rpc ListTargetTags(ListTargetTagsRequest) returns (ListTargetTagsResponse);
  rpc AddTagging(AddTaggingRequest) returns (AddTaggingResponse);
  rpc RemoveTagging(RemoveTaggingRequest) returns (RemoveTaggingResponse);

  // Approval operations (cast only)
  rpc ApproveTagging(ApproveTaggingRequest) returns (ApproveTaggingResponse);
  rpc RejectTagging(RejectTaggingRequest) returns (RejectTaggingResponse);
  rpc ListPendingTaggings(ListPendingTaggingsRequest) returns (ListPendingTaggingsResponse);
}

enum TaggingStatus {
  TAGGING_STATUS_UNSPECIFIED = 0;
  TAGGING_STATUS_PENDING = 1;
  TAGGING_STATUS_APPROVED = 2;
  TAGGING_STATUS_REJECTED = 3;
}

// --- Tag CRUD ---

message TagItem {
  string id = 1;
  string name = 2;
  string created_at = 3;
}

message ListTagsRequest {}

message ListTagsResponse {
  repeated TagItem tags = 1;
}

message CreateTagRequest {
  string name = 1;
}

message CreateTagResponse {
  bool success = 1;
  TagItem tag = 2;
}

message DeleteTagRequest {
  string id = 1;
}

message DeleteTagResponse {
  bool success = 1;
}

// --- Tagging operations ---

message TaggingItem {
  string id = 1;
  string tag_name = 2;
  string tagger_id = 3;
  TaggingStatus status = 4;
  string created_at = 5;
}

message ListTargetTagsRequest {
  string target_id = 1;
}

message ListTargetTagsResponse {
  repeated TaggingItem taggings = 1;
}

message AddTaggingRequest {
  string tag_id = 1;
  string target_id = 2;
}

message AddTaggingResponse {
  bool success = 1;
  TaggingStatus status = 2;
}

message RemoveTaggingRequest {
  string id = 1;
}

message RemoveTaggingResponse {
  bool success = 1;
}

// --- Approval operations ---

message ApproveTaggingRequest {
  string id = 1;
}

message ApproveTaggingResponse {
  bool success = 1;
}

message RejectTaggingRequest {
  string id = 1;
}

message RejectTaggingResponse {
  bool success = 1;
}

message PendingTaggingItem {
  string id = 1;
  string tag_name = 2;
  string tagger_id = 3;
  string created_at = 4;
}

message ListPendingTaggingsRequest {
  int32 limit = 1;
  string cursor = 2;
}

message ListPendingTaggingsResponse {
  repeated PendingTaggingItem taggings = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

**Step 2: Commit**

```bash
git add proto/trust/v1/service.proto
git commit -m "feat(trust): add Trust service proto definition"
```

---

## Task 2: Proto Code Generation

**Step 1: Generate Ruby stubs**

```bash
cd services/monolith/workspace && buf generate ../../../proto
```

Verify: `services/monolith/workspace/stubs/trust/v1/service_services_pb.rb` exists.

**Step 2: Generate TypeScript stubs**

```bash
cd web/nyx/workspace && pnpm proto:gen
```

Verify: `web/nyx/workspace/src/stub/trust/v1/service_pb.ts` exists.

**Step 3: Commit**

```bash
git add services/monolith/workspace/stubs/trust/ web/nyx/workspace/src/stub/trust/
git commit -m "chore(trust): generate proto stubs for Ruby and TypeScript"
```

---

## Task 3: Database Migration

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260220000001_create_trust_tags.rb`
- Create: `services/monolith/workspace/config/db/migrate/20260220000002_create_trust_taggings.rb`

**Step 1: Create tags migration**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"trust__tags" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :identity_id, :uuid, null: false
      column :name, String, size: 100, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :identity_id
      unique [:identity_id, :name]
    end
  end

  down do
    drop_table :"trust__tags"
  end
end
```

**Step 2: Create taggings migration**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"trust__taggings" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :tag_id, :uuid, null: false
      column :tagger_id, :uuid, null: false
      column :target_id, :uuid, null: false
      column :status, :text, null: false, default: "approved"
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :tag_id
      index :tagger_id
      index :target_id
      index [:target_id, :status]
      unique [:tag_id, :target_id, :tagger_id]
    end
  end

  down do
    drop_table :"trust__taggings"
  end
end
```

**Step 3: Run migration**

```bash
cd services/monolith/workspace && bundle exec rake db:migrate
```

**Step 4: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/20260220000001_create_trust_tags.rb \
      services/monolith/workspace/config/db/migrate/20260220000002_create_trust_taggings.rb \
      services/monolith/workspace/config/db/structure.sql
git commit -m "feat(trust): add database migrations for tags and taggings"
```

---

## Task 4: Backend DB Base Classes + Relations

**Files:**
- Create: `services/monolith/workspace/slices/trust/db/relation.rb`
- Create: `services/monolith/workspace/slices/trust/db/repo.rb`
- Create: `services/monolith/workspace/slices/trust/relations/tags.rb`
- Create: `services/monolith/workspace/slices/trust/relations/taggings.rb`

**Step 1: Create DB base classes**

`slices/trust/db/relation.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module DB
    class Relation < Monolith::DB::Relation
    end
  end
end
```

`slices/trust/db/repo.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
```

**Step 2: Create relation files**

`slices/trust/relations/tags.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module Relations
    class Tags < Trust::DB::Relation
      schema(:"trust__tags", as: :tags, infer: false) do
        attribute :id, Types::String
        attribute :identity_id, Types::String
        attribute :name, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

`slices/trust/relations/taggings.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module Relations
    class Taggings < Trust::DB::Relation
      schema(:"trust__taggings", as: :taggings, infer: false) do
        attribute :id, Types::String
        attribute :tag_id, Types::String
        attribute :tagger_id, Types::String
        attribute :target_id, Types::String
        attribute :status, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/trust/
git commit -m "feat(trust): add DB base classes and ROM relations"
```

---

## Task 5: Backend TagRepository + Tests

**Files:**
- Create: `services/monolith/workspace/slices/trust/repositories/tag_repository.rb`
- Create: `services/monolith/workspace/spec/slices/trust/repositories/tag_repository_spec.rb`

**Step 1: Write the failing test**

```ruby
# frozen_string_literal: true

RSpec.describe Trust::Repositories::TagRepository, type: :database do
  let(:repo) { Hanami.app.slices[:trust]["repositories.tag_repository"] }
  let(:identity_id) { SecureRandom.uuid }

  describe "#create" do
    it "creates a tag" do
      result = repo.create(identity_id: identity_id, name: "VIP")
      expect(result).to include(id: a_kind_of(String), name: "VIP")
    end

    it "returns error for duplicate name" do
      repo.create(identity_id: identity_id, name: "VIP")
      result = repo.create(identity_id: identity_id, name: "VIP")
      expect(result[:error]).to eq(:already_exists)
    end

    it "allows same name for different identities" do
      other_id = SecureRandom.uuid
      repo.create(identity_id: identity_id, name: "VIP")
      result = repo.create(identity_id: other_id, name: "VIP")
      expect(result).to include(name: "VIP")
      expect(result[:error]).to be_nil
    end

    it "returns error when tag limit reached" do
      50.times { |i| repo.create(identity_id: identity_id, name: "tag-#{i}") }
      result = repo.create(identity_id: identity_id, name: "one-too-many")
      expect(result[:error]).to eq(:limit_reached)
    end
  end

  describe "#list" do
    it "returns all tags for identity" do
      repo.create(identity_id: identity_id, name: "A")
      repo.create(identity_id: identity_id, name: "B")
      tags = repo.list(identity_id: identity_id)
      expect(tags.size).to eq(2)
    end

    it "does not return other identity's tags" do
      repo.create(identity_id: identity_id, name: "mine")
      repo.create(identity_id: SecureRandom.uuid, name: "theirs")
      tags = repo.list(identity_id: identity_id)
      expect(tags.size).to eq(1)
    end
  end

  describe "#delete" do
    it "deletes a tag owned by identity" do
      tag = repo.create(identity_id: identity_id, name: "temp")
      result = repo.delete(id: tag[:id], identity_id: identity_id)
      expect(result).to be true
    end

    it "does not delete another identity's tag" do
      tag = repo.create(identity_id: SecureRandom.uuid, name: "not-mine")
      result = repo.delete(id: tag[:id], identity_id: identity_id)
      expect(result).to be false
    end
  end

  describe "#find_by_id" do
    it "returns a tag by id" do
      tag = repo.create(identity_id: identity_id, name: "findme")
      found = repo.find_by_id(id: tag[:id])
      expect(found).not_to be_nil
      expect(found.name).to eq("findme")
    end
  end

  describe "#count" do
    it "returns tag count for identity" do
      3.times { |i| repo.create(identity_id: identity_id, name: "t-#{i}") }
      expect(repo.count(identity_id: identity_id)).to eq(3)
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/tag_repository_spec.rb
```

Expected: FAIL (class not found).

**Step 3: Write repository implementation**

```ruby
# frozen_string_literal: true

module Trust
  module Repositories
    class TagRepository < Trust::DB::Repo
      TAG_LIMIT = 50

      def create(identity_id:, name:)
        if count(identity_id: identity_id) >= TAG_LIMIT
          return { error: :limit_reached }
        end

        existing = tags.where(identity_id: identity_id, name: name).one
        return { error: :already_exists } if existing

        record = tags.changeset(:create, identity_id: identity_id, name: name).commit
        { id: record.id, name: record.name, created_at: record.created_at }
      rescue Sequel::UniqueConstraintViolation
        { error: :already_exists }
      end

      def list(identity_id:)
        tags.where(identity_id: identity_id).order { created_at.asc }.to_a
      end

      def delete(id:, identity_id:)
        deleted = tags.dataset.where(id: id, identity_id: identity_id).delete
        deleted > 0
      end

      def find_by_id(id:)
        tags.where(id: id).one
      end

      def count(identity_id:)
        tags.where(identity_id: identity_id).count
      end
    end
  end
end
```

**Step 4: Run test to verify it passes**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/tag_repository_spec.rb
```

Expected: ALL PASS.

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/repositories/tag_repository.rb \
      services/monolith/workspace/spec/slices/trust/repositories/tag_repository_spec.rb
git commit -m "feat(trust): add TagRepository with tests"
```

---

## Task 6: Backend TaggingRepository + Tests

**Files:**
- Create: `services/monolith/workspace/slices/trust/repositories/tagging_repository.rb`
- Create: `services/monolith/workspace/spec/slices/trust/repositories/tagging_repository_spec.rb`

**Step 1: Write the failing test**

```ruby
# frozen_string_literal: true

RSpec.describe Trust::Repositories::TaggingRepository, type: :database do
  let(:repo) { Hanami.app.slices[:trust]["repositories.tagging_repository"] }
  let(:tag_repo) { Hanami.app.slices[:trust]["repositories.tag_repository"] }
  let(:tagger_id) { SecureRandom.uuid }
  let(:target_id) { SecureRandom.uuid }
  let(:tag) { tag_repo.create(identity_id: tagger_id, name: "test-tag") }

  describe "#add" do
    it "creates an approved tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(result[:success]).to be true
      expect(result[:status]).to eq("approved")
    end

    it "creates a pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      expect(result[:success]).to be true
      expect(result[:status]).to eq("pending")
    end

    it "returns error for duplicate tagging" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(result[:success]).to be false
      expect(result[:error]).to eq(:already_exists)
    end
  end

  describe "#remove" do
    it "removes a tagging by id and tagger" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(repo.remove(id: result[:id], tagger_id: tagger_id)).to be true
    end

    it "does not remove another tagger's tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(repo.remove(id: result[:id], tagger_id: SecureRandom.uuid)).to be false
    end
  end

  describe "#list_by_target" do
    it "returns approved taggings for a target" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      taggings = repo.list_by_target(target_id: target_id)
      expect(taggings.size).to eq(1)
    end

    it "does not return pending taggings" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      taggings = repo.list_by_target(target_id: target_id)
      expect(taggings.size).to eq(0)
    end
  end

  describe "#approve" do
    it "approves a pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      expect(repo.approve(id: result[:id])).to be true
    end

    it "returns false for non-pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(repo.approve(id: result[:id])).to be false
    end
  end

  describe "#reject" do
    it "rejects a pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      expect(repo.reject(id: result[:id])).to be true
    end
  end

  describe "#list_pending_by_target" do
    it "returns pending taggings for a target" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      result = repo.list_pending_by_target(target_id: target_id, limit: 20)
      expect(result[:taggings].size).to eq(1)
    end
  end

  describe "#find_by_id" do
    it "returns a tagging by id" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      found = repo.find_by_id(id: result[:id])
      expect(found).not_to be_nil
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/tagging_repository_spec.rb
```

**Step 3: Write repository implementation**

```ruby
# frozen_string_literal: true

module Trust
  module Repositories
    class TaggingRepository < Trust::DB::Repo
      def add(tag_id:, tagger_id:, target_id:, status: "approved")
        existing = taggings.where(tag_id: tag_id, tagger_id: tagger_id, target_id: target_id).one
        return { success: false, error: :already_exists } if existing

        record = taggings.changeset(:create,
          tag_id: tag_id,
          tagger_id: tagger_id,
          target_id: target_id,
          status: status
        ).commit
        { success: true, id: record.id, status: record.status }
      rescue Sequel::UniqueConstraintViolation
        { success: false, error: :already_exists }
      end

      def remove(id:, tagger_id:)
        deleted = taggings.dataset.where(id: id, tagger_id: tagger_id).delete
        deleted > 0
      end

      def list_by_target(target_id:)
        taggings.where(target_id: target_id, status: "approved")
          .order { created_at.desc }
          .to_a
      end

      def approve(id:)
        updated = taggings.dataset
          .where(id: id, status: "pending")
          .update(status: "approved", updated_at: Time.now)
        updated > 0
      end

      def reject(id:)
        updated = taggings.dataset
          .where(id: id, status: "pending")
          .update(status: "rejected", updated_at: Time.now)
        updated > 0
      end

      def list_pending_by_target(target_id:, limit: 20, cursor: nil)
        scope = taggings.where(target_id: target_id, status: "pending")

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
        end

        records = scope.order { created_at.desc }.limit(limit + 1).to_a
        has_more = records.size > limit
        records = records.first(limit) if has_more

        { taggings: records, has_more: has_more }
      end

      def find_by_id(id:)
        taggings.where(id: id).one
      end

      def delete_by_tag_id(tag_id:)
        taggings.dataset.where(tag_id: tag_id).delete
      end
    end
  end
end
```

**Step 4: Run test to verify it passes**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/tagging_repository_spec.rb
```

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/repositories/tagging_repository.rb \
      services/monolith/workspace/spec/slices/trust/repositories/tagging_repository_spec.rb
git commit -m "feat(trust): add TaggingRepository with tests"
```

---

## Task 7: Backend Use Cases (Tags)

**Files:**
- Create: `services/monolith/workspace/slices/trust/use_cases/tags/create_tag.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/tags/list_tags.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/tags/delete_tag.rb`

**Step 1: Write use cases**

`use_cases/tags/create_tag.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Tags
      class CreateTag
        include Trust::Deps[tag_repo: "repositories.tag_repository"]

        def call(identity_id:, name:)
          tag_repo.create(identity_id: identity_id, name: name.strip)
        end
      end
    end
  end
end
```

`use_cases/tags/list_tags.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Tags
      class ListTags
        include Trust::Deps[tag_repo: "repositories.tag_repository"]

        def call(identity_id:)
          tag_repo.list(identity_id: identity_id)
        end
      end
    end
  end
end
```

`use_cases/tags/delete_tag.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Tags
      class DeleteTag
        include Trust::Deps[
          tag_repo: "repositories.tag_repository",
          tagging_repo: "repositories.tagging_repository"
        ]

        def call(id:, identity_id:)
          # Cascade: delete all taggings for this tag
          tagging_repo.delete_by_tag_id(tag_id: id)
          tag_repo.delete(id: id, identity_id: identity_id)
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/slices/trust/use_cases/tags/
git commit -m "feat(trust): add tag use cases (create, list, delete)"
```

---

## Task 8: Backend Use Cases (Taggings)

**Files:**
- Create: `services/monolith/workspace/slices/trust/use_cases/taggings/add_tagging.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/taggings/remove_tagging.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/taggings/list_target_tags.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/taggings/approve_tagging.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/taggings/reject_tagging.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/taggings/list_pending_taggings.rb`

**Step 1: Write use cases**

`use_cases/taggings/add_tagging.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class AddTagging
        include Trust::Deps[
          tag_repo: "repositories.tag_repository",
          tagging_repo: "repositories.tagging_repository"
        ]

        def call(tag_id:, tagger_id:, target_id:, role:)
          tag = tag_repo.find_by_id(id: tag_id)
          return { success: false, error: :tag_not_found } unless tag
          return { success: false, error: :not_owner } unless tag.identity_id == tagger_id

          # Cast tags are auto-approved, Guest tags need approval
          status = role == :cast ? "approved" : "pending"

          tagging_repo.add(
            tag_id: tag_id,
            tagger_id: tagger_id,
            target_id: target_id,
            status: status
          )
        end
      end
    end
  end
end
```

`use_cases/taggings/remove_tagging.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class RemoveTagging
        include Trust::Deps[tagging_repo: "repositories.tagging_repository"]

        def call(id:, tagger_id:)
          tagging_repo.remove(id: id, tagger_id: tagger_id)
        end
      end
    end
  end
end
```

`use_cases/taggings/list_target_tags.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class ListTargetTags
        include Trust::Deps[
          tagging_repo: "repositories.tagging_repository",
          tag_repo: "repositories.tag_repository"
        ]

        def call(target_id:)
          taggings = tagging_repo.list_by_target(target_id: target_id)

          taggings.map do |tagging|
            tag = tag_repo.find_by_id(id: tagging.tag_id)
            {
              id: tagging.id,
              tag_name: tag&.name || "",
              tagger_id: tagging.tagger_id,
              status: tagging.status,
              created_at: tagging.created_at
            }
          end
        end
      end
    end
  end
end
```

`use_cases/taggings/approve_tagging.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class ApproveTagging
        include Trust::Deps[tagging_repo: "repositories.tagging_repository"]

        def call(id:, target_id:)
          tagging = tagging_repo.find_by_id(id: id)
          return false unless tagging
          return false unless tagging.target_id == target_id

          tagging_repo.approve(id: id)
        end
      end
    end
  end
end
```

`use_cases/taggings/reject_tagging.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class RejectTagging
        include Trust::Deps[tagging_repo: "repositories.tagging_repository"]

        def call(id:, target_id:)
          tagging = tagging_repo.find_by_id(id: id)
          return false unless tagging
          return false unless tagging.target_id == target_id

          tagging_repo.reject(id: id)
        end
      end
    end
  end
end
```

`use_cases/taggings/list_pending_taggings.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class ListPendingTaggings
        include Trust::Deps[
          tagging_repo: "repositories.tagging_repository",
          tag_repo: "repositories.tag_repository"
        ]

        def call(target_id:, limit: 20, cursor: nil)
          result = tagging_repo.list_pending_by_target(
            target_id: target_id,
            limit: limit,
            cursor: cursor
          )

          taggings = result[:taggings].map do |tagging|
            tag = tag_repo.find_by_id(id: tagging.tag_id)
            {
              id: tagging.id,
              tag_name: tag&.name || "",
              tagger_id: tagging.tagger_id,
              created_at: tagging.created_at
            }
          end

          {
            taggings: taggings,
            has_more: result[:has_more]
          }
        end
      end
    end
  end
end
```

**Step 2: Commit**

```bash
git add services/monolith/workspace/slices/trust/use_cases/taggings/
git commit -m "feat(trust): add tagging use cases (add, remove, list, approve, reject)"
```

---

## Task 9: Backend gRPC Handler

**Files:**
- Create: `services/monolith/workspace/slices/trust/grpc/handler.rb`
- Create: `services/monolith/workspace/slices/trust/grpc/trust_handler.rb`

**Step 1: Create base handler**

```ruby
# frozen_string_literal: true

require "base64"
require "json"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../../post/adapters/cast_adapter"
require_relative "../../post/adapters/guest_adapter"

module Trust
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      include Trust::Deps[
        tag_repo: "repositories.tag_repository",
        tagging_repo: "repositories.tagging_repository"
      ]

      protected

      def cast_adapter
        @cast_adapter ||= Post::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Post::Adapters::GuestAdapter.new
      end

      def find_my_cast
        return nil unless current_user_id

        cast_adapter.find_by_user_id(current_user_id)
      end

      def find_my_guest
        return nil unless current_user_id

        guest_adapter.find_by_user_id(current_user_id)
      end

      # Determine user role: :cast or :guest
      def determine_role!
        return :cast if find_my_cast
        return :guest if find_my_guest

        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
      end

      def decode_cursor(cursor)
        return nil if cursor.nil? || cursor.empty?

        parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
        { created_at: Time.parse(parsed["created_at"]) }
      rescue StandardError
        nil
      end

      def encode_cursor(data)
        Base64.urlsafe_encode64(JSON.generate(data), padding: false)
      end
    end
  end
end
```

**Step 2: Create trust handler**

```ruby
# frozen_string_literal: true

require "trust/v1/service_services_pb"
require_relative "handler"

module Trust
  module Grpc
    class TrustHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "trust.v1.TrustService"

      bind ::Trust::V1::TrustService::Service

      self.rpc_descs.clear

      rpc :ListTags, ::Trust::V1::ListTagsRequest, ::Trust::V1::ListTagsResponse
      rpc :CreateTag, ::Trust::V1::CreateTagRequest, ::Trust::V1::CreateTagResponse
      rpc :DeleteTag, ::Trust::V1::DeleteTagRequest, ::Trust::V1::DeleteTagResponse
      rpc :ListTargetTags, ::Trust::V1::ListTargetTagsRequest, ::Trust::V1::ListTargetTagsResponse
      rpc :AddTagging, ::Trust::V1::AddTaggingRequest, ::Trust::V1::AddTaggingResponse
      rpc :RemoveTagging, ::Trust::V1::RemoveTaggingRequest, ::Trust::V1::RemoveTaggingResponse
      rpc :ApproveTagging, ::Trust::V1::ApproveTaggingRequest, ::Trust::V1::ApproveTaggingResponse
      rpc :RejectTagging, ::Trust::V1::RejectTaggingRequest, ::Trust::V1::RejectTaggingResponse
      rpc :ListPendingTaggings, ::Trust::V1::ListPendingTaggingsRequest, ::Trust::V1::ListPendingTaggingsResponse

      include Trust::Deps[
        create_tag_uc: "use_cases.tags.create_tag",
        list_tags_uc: "use_cases.tags.list_tags",
        delete_tag_uc: "use_cases.tags.delete_tag",
        add_tagging_uc: "use_cases.taggings.add_tagging",
        remove_tagging_uc: "use_cases.taggings.remove_tagging",
        list_target_tags_uc: "use_cases.taggings.list_target_tags",
        approve_tagging_uc: "use_cases.taggings.approve_tagging",
        reject_tagging_uc: "use_cases.taggings.reject_tagging",
        list_pending_taggings_uc: "use_cases.taggings.list_pending_taggings"
      ]

      # --- Tag CRUD ---

      def list_tags
        authenticate_user!

        tags = list_tags_uc.call(identity_id: current_user_id)
        items = tags.map do |tag|
          ::Trust::V1::TagItem.new(
            id: tag.id,
            name: tag.name,
            created_at: tag.created_at&.iso8601 || ""
          )
        end

        ::Trust::V1::ListTagsResponse.new(tags: items)
      end

      def create_tag
        authenticate_user!

        result = create_tag_uc.call(
          identity_id: current_user_id,
          name: request.message.name
        )

        if result[:error] == :already_exists
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Tag name already exists")
        end
        if result[:error] == :limit_reached
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::RESOURCE_EXHAUSTED, "Tag limit reached (max 50)")
        end

        tag = ::Trust::V1::TagItem.new(
          id: result[:id],
          name: result[:name],
          created_at: result[:created_at]&.iso8601 || ""
        )
        ::Trust::V1::CreateTagResponse.new(success: true, tag: tag)
      end

      def delete_tag
        authenticate_user!

        result = delete_tag_uc.call(
          id: request.message.id,
          identity_id: current_user_id
        )

        ::Trust::V1::DeleteTagResponse.new(success: result)
      end

      # --- Tagging operations ---

      def list_target_tags
        authenticate_user!

        taggings = list_target_tags_uc.call(target_id: request.message.target_id)
        items = taggings.map do |t|
          ::Trust::V1::TaggingItem.new(
            id: t[:id],
            tag_name: t[:tag_name],
            tagger_id: t[:tagger_id],
            status: tagging_status_to_proto(t[:status]),
            created_at: t[:created_at]&.iso8601 || ""
          )
        end

        ::Trust::V1::ListTargetTagsResponse.new(taggings: items)
      end

      def add_tagging
        authenticate_user!
        role = determine_role!

        result = add_tagging_uc.call(
          tag_id: request.message.tag_id,
          tagger_id: current_user_id,
          target_id: request.message.target_id,
          role: role
        )

        if result[:error] == :tag_not_found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Tag not found")
        end
        if result[:error] == :not_owner
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Not tag owner")
        end
        if result[:error] == :already_exists
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Tagging already exists")
        end

        ::Trust::V1::AddTaggingResponse.new(
          success: result[:success],
          status: tagging_status_to_proto(result[:status])
        )
      end

      def remove_tagging
        authenticate_user!

        result = remove_tagging_uc.call(
          id: request.message.id,
          tagger_id: current_user_id
        )

        ::Trust::V1::RemoveTaggingResponse.new(success: result)
      end

      # --- Approval operations ---

      def approve_tagging
        authenticate_user!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Cast role required")
        end

        result = approve_tagging_uc.call(
          id: request.message.id,
          target_id: current_user_id
        )

        ::Trust::V1::ApproveTaggingResponse.new(success: result)
      end

      def reject_tagging
        authenticate_user!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Cast role required")
        end

        result = reject_tagging_uc.call(
          id: request.message.id,
          target_id: current_user_id
        )

        ::Trust::V1::RejectTaggingResponse.new(success: result)
      end

      def list_pending_taggings
        authenticate_user!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::PERMISSION_DENIED, "Cast role required")
        end

        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = decode_cursor(request.message.cursor)

        result = list_pending_taggings_uc.call(
          target_id: current_user_id,
          limit: limit,
          cursor: cursor
        )

        items = result[:taggings].map do |t|
          ::Trust::V1::PendingTaggingItem.new(
            id: t[:id],
            tag_name: t[:tag_name],
            tagger_id: t[:tagger_id],
            created_at: t[:created_at]&.iso8601 || ""
          )
        end

        next_cursor = if result[:taggings].any? && result[:has_more]
          encode_cursor({ created_at: result[:taggings].last[:created_at].iso8601 })
        else
          ""
        end

        ::Trust::V1::ListPendingTaggingsResponse.new(
          taggings: items,
          next_cursor: next_cursor,
          has_more: result[:has_more]
        )
      end

      private

      def tagging_status_to_proto(status)
        case status
        when "approved" then :TAGGING_STATUS_APPROVED
        when "pending" then :TAGGING_STATUS_PENDING
        when "rejected" then :TAGGING_STATUS_REJECTED
        else :TAGGING_STATUS_UNSPECIFIED
        end
      end
    end
  end
end
```

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/trust/grpc/
git commit -m "feat(trust): add gRPC handlers for TrustService"
```

---

## Task 10: Register Handler + Seed Data

**Files:**
- Modify: `services/monolith/workspace/bin/grpc` (add require lines)
- Modify: `services/monolith/workspace/config/db/seeds.rb` (add trust seed section)

**Step 1: Register handler in bin/grpc**

Add after line 48 (`require "feed/v1/feed_service_services_pb"`):
```ruby
require "trust/v1/service_services_pb"
```

Add after line 78 (`require_relative "../slices/feed/grpc/handler"`):
```ruby
require_relative "../slices/trust/grpc/handler"
require_relative "../slices/trust/grpc/trust_handler"
```

**Step 2: Add seed data**

Append to `seeds.rb` before the final line:

```ruby
# =============================================================================
# Trust: Tags & Taggings
# =============================================================================

puts "Seeding Trust: Tags & Taggings..."

tag_count = 0
tagging_count = 0

# Get identity IDs from existing users
yuna_user = db[:identity__identities].where(email: "yuna@example.com").first
mio_user = db[:identity__identities].where(email: "mio@example.com").first
taro_user = db[:identity__identities].where(email: "taro@example.com").first
jiro_user = db[:identity__identities].where(email: "jiro@example.com").first

if yuna_user && taro_user && jiro_user
  # Yuna's tags (cast tags for guests)
  [
    { identity_id: yuna_user[:id], name: "VIP" },
    { identity_id: yuna_user[:id], name: "Regular" },
    { identity_id: yuna_user[:id], name: "First-timer" },
  ].each do |tag_data|
    existing = db[:"trust__tags"].where(identity_id: tag_data[:identity_id], name: tag_data[:name]).first
    unless existing
      db[:"trust__tags"].insert(tag_data.merge(created_at: Time.now, updated_at: Time.now))
      tag_count += 1
    end
  end

  # Taro's tags (guest tags for casts)
  [
    { identity_id: taro_user[:id], name: "Friendly" },
    { identity_id: taro_user[:id], name: "Recommended" },
  ].each do |tag_data|
    existing = db[:"trust__tags"].where(identity_id: tag_data[:identity_id], name: tag_data[:name]).first
    unless existing
      db[:"trust__tags"].insert(tag_data.merge(created_at: Time.now, updated_at: Time.now))
      tag_count += 1
    end
  end

  # Taggings: Yuna tags Taro as "VIP" (cast→guest, auto-approved)
  vip_tag = db[:"trust__tags"].where(identity_id: yuna_user[:id], name: "VIP").first
  if vip_tag
    existing = db[:"trust__taggings"].where(tag_id: vip_tag[:id], tagger_id: yuna_user[:id], target_id: taro_user[:id]).first
    unless existing
      db[:"trust__taggings"].insert(
        tag_id: vip_tag[:id], tagger_id: yuna_user[:id], target_id: taro_user[:id],
        status: "approved", created_at: Time.now, updated_at: Time.now
      )
      tagging_count += 1
    end
  end

  # Taggings: Yuna tags Jiro as "First-timer" (cast→guest, auto-approved)
  first_tag = db[:"trust__tags"].where(identity_id: yuna_user[:id], name: "First-timer").first
  if first_tag
    existing = db[:"trust__taggings"].where(tag_id: first_tag[:id], tagger_id: yuna_user[:id], target_id: jiro_user[:id]).first
    unless existing
      db[:"trust__taggings"].insert(
        tag_id: first_tag[:id], tagger_id: yuna_user[:id], target_id: jiro_user[:id],
        status: "approved", created_at: Time.now, updated_at: Time.now
      )
      tagging_count += 1
    end
  end

  # Taggings: Taro tags Yuna as "Recommended" (guest→cast, pending approval)
  rec_tag = db[:"trust__tags"].where(identity_id: taro_user[:id], name: "Recommended").first
  if rec_tag && yuna_user
    existing = db[:"trust__taggings"].where(tag_id: rec_tag[:id], tagger_id: taro_user[:id], target_id: yuna_user[:id]).first
    unless existing
      db[:"trust__taggings"].insert(
        tag_id: rec_tag[:id], tagger_id: taro_user[:id], target_id: yuna_user[:id],
        status: "pending", created_at: Time.now, updated_at: Time.now
      )
      tagging_count += 1
    end
  end
end

puts "  Created #{tag_count} tags, #{tagging_count} taggings"
```

**Step 3: Commit**

```bash
git add services/monolith/workspace/bin/grpc services/monolith/workspace/config/db/seeds.rb
git commit -m "feat(trust): register gRPC handler and add seed data"
```

---

## Task 11: Frontend Types + gRPC Client

**Files:**
- Create: `web/nyx/workspace/src/modules/trust/types.ts`
- Create: `web/nyx/workspace/src/modules/trust/index.ts`
- Create: `web/nyx/workspace/src/modules/trust/hooks/index.ts`
- Modify: `web/nyx/workspace/src/lib/grpc.ts` (add trustClient)

**Step 1: Create module files**

`modules/trust/types.ts`:
```typescript
import { TaggingStatus } from "@/stub/trust/v1/service_pb";

export { TaggingStatus };

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Tagging {
  id: string;
  tagName: string;
  taggerId: string;
  status: TaggingStatus;
  createdAt: string;
}

export interface PendingTagging {
  id: string;
  tagName: string;
  taggerId: string;
  createdAt: string;
}
```

`modules/trust/hooks/index.ts`:
```typescript
export { useTags } from "./useTags";
export { useTaggings } from "./useTaggings";
```

`modules/trust/index.ts`:
```typescript
export * from "./types";
export * from "./hooks";
```

**Step 2: Add gRPC client**

Add to `lib/grpc.ts`:
```typescript
import { TrustService } from "@/stub/trust/v1/service_pb";
```

And at the bottom:
```typescript
export const trustClient = createClient(TrustService, transport);
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/ web/nyx/workspace/src/lib/grpc.ts
git commit -m "feat(trust): add frontend module types and gRPC client"
```

---

## Task 12: Frontend Hooks

**Files:**
- Create: `web/nyx/workspace/src/modules/trust/hooks/useTags.ts`
- Create: `web/nyx/workspace/src/modules/trust/hooks/useTaggings.ts`

**Step 1: Create useTags hook**

```typescript
"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Tag } from "../types";

interface CreateTagResponse {
  success: boolean;
  tag: Tag;
}

interface ListTagsResponse {
  tags: Tag[];
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!getAuthToken()) return [];

    setLoading(true);
    try {
      const data = await authFetch<ListTagsResponse>("/api/me/trust/tags");
      setTags(data.tags || []);
      return data.tags || [];
    } catch (e) {
      console.error("Fetch tags error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTag = useCallback(async (name: string) => {
    if (!getAuthToken()) return null;

    setLoading(true);
    try {
      const data = await authFetch<CreateTagResponse>("/api/me/trust/tags", {
        method: "POST",
        body: { name },
      });

      if (data.success && data.tag) {
        setTags((prev) => [...prev, data.tag]);
      }
      return data;
    } catch (e) {
      console.error("Create tag error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTag = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/me/trust/tags/${id}`,
        { method: "DELETE" }
      );

      if (data.success) {
        setTags((prev) => prev.filter((tag) => tag.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Delete tag error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { tags, fetchTags, createTag, deleteTag, loading };
}
```

**Step 2: Create useTaggings hook**

```typescript
"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Tagging, PendingTagging } from "../types";

interface ListTargetTagsResponse {
  taggings: Tagging[];
}

interface AddTaggingResponse {
  success: boolean;
  status: string;
}

interface ListPendingResponse {
  taggings: PendingTagging[];
  nextCursor: string;
  hasMore: boolean;
}

export function useTaggings() {
  const [targetTaggings, setTargetTaggings] = useState<Tagging[]>([]);
  const [pendingTaggings, setPendingTaggings] = useState<PendingTagging[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTargetTags = useCallback(async (targetId: string) => {
    if (!getAuthToken()) return [];

    setLoading(true);
    try {
      const data = await authFetch<ListTargetTagsResponse>(
        `/api/me/trust/taggings?target_id=${targetId}`
      );
      setTargetTaggings(data.taggings || []);
      return data.taggings || [];
    } catch (e) {
      console.error("Fetch target tags error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTagging = useCallback(async (tagId: string, targetId: string) => {
    if (!getAuthToken()) return null;

    setLoading(true);
    try {
      const data = await authFetch<AddTaggingResponse>(
        "/api/me/trust/taggings",
        { method: "POST", body: { tagId, targetId } }
      );
      return data;
    } catch (e) {
      console.error("Add tagging error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTagging = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/me/trust/taggings/${id}`,
        { method: "DELETE" }
      );

      if (data.success) {
        setTargetTaggings((prev) => prev.filter((t) => t.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Remove tagging error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingTaggings = useCallback(async (limit: number = 20) => {
    if (!getAuthToken()) return { taggings: [], hasMore: false };

    setLoading(true);
    try {
      const data = await authFetch<ListPendingResponse>(
        `/api/cast/trust/taggings/pending?limit=${limit}`
      );
      setPendingTaggings(data.taggings || []);
      return data;
    } catch (e) {
      console.error("Fetch pending taggings error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const approveTagging = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/cast/trust/taggings/${id}/approve`,
        { method: "POST" }
      );

      if (data.success) {
        setPendingTaggings((prev) => prev.filter((t) => t.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Approve tagging error:", e);
      throw e;
    }
  }, []);

  const rejectTagging = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/cast/trust/taggings/${id}/reject`,
        { method: "POST" }
      );

      if (data.success) {
        setPendingTaggings((prev) => prev.filter((t) => t.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Reject tagging error:", e);
      throw e;
    }
  }, []);

  return {
    targetTaggings,
    pendingTaggings,
    fetchTargetTags,
    addTagging,
    removeTagging,
    fetchPendingTaggings,
    approveTagging,
    rejectTagging,
    loading,
  };
}
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/hooks/
git commit -m "feat(trust): add useTags and useTaggings hooks"
```

---

## Task 13: Frontend API Routes (Shared / Me)

**Files:**
- Create: `web/nyx/workspace/src/app/api/me/trust/tags/route.ts`
- Create: `web/nyx/workspace/src/app/api/me/trust/tags/[id]/route.ts`
- Create: `web/nyx/workspace/src/app/api/me/trust/taggings/route.ts`
- Create: `web/nyx/workspace/src/app/api/me/trust/taggings/[id]/route.ts`

**Step 1: Create tags routes**

`api/me/trust/tags/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await trustClient.listTags(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const tags = (response.tags || []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.createdAt,
    }));

    return NextResponse.json({ tags });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListTags Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const response = await trustClient.createTag(
      { name },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
      tag: response.tag
        ? { id: response.tag.id, name: response.tag.name, createdAt: response.tag.createdAt }
        : null,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 6) {
        return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
      }
      if (error.code === 8) {
        return NextResponse.json({ error: "Tag limit reached" }, { status: 429 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("CreateTag Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

`api/me/trust/tags/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await trustClient.deleteTag(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DeleteTag Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Create tagging routes**

`api/me/trust/taggings/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetId = req.nextUrl.searchParams.get("target_id");
    if (!targetId) {
      return NextResponse.json({ error: "target_id is required" }, { status: 400 });
    }

    const response = await trustClient.listTargetTags(
      { targetId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const taggings = (response.taggings || []).map((t) => ({
      id: t.id,
      tagName: t.tagName,
      taggerId: t.taggerId,
      status: t.status,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({ taggings });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ListTargetTags Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagId, targetId } = await req.json();
    if (!tagId || !targetId) {
      return NextResponse.json({ error: "tagId and targetId are required" }, { status: 400 });
    }

    const response = await trustClient.addTagging(
      { tagId, targetId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      success: response.success,
      status: response.status,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 5) {
        return NextResponse.json({ error: "Tag not found" }, { status: 404 });
      }
      if (error.code === 6) {
        return NextResponse.json({ error: "Tagging already exists" }, { status: 409 });
      }
      if (error.code === 7) {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("AddTagging Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

`api/me/trust/taggings/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await trustClient.removeTagging(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    if (error instanceof ConnectError && error.code === 16) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("RemoveTagging Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/app/api/me/trust/
git commit -m "feat(trust): add shared API routes for tags and taggings"
```

---

## Task 14: Frontend API Routes (Cast-only: Approval)

**Files:**
- Create: `web/nyx/workspace/src/app/api/cast/trust/taggings/pending/route.ts`
- Create: `web/nyx/workspace/src/app/api/cast/trust/taggings/[id]/approve/route.ts`
- Create: `web/nyx/workspace/src/app/api/cast/trust/taggings/[id]/reject/route.ts`

**Step 1: Create pending list route**

`api/cast/trust/taggings/pending/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

export async function GET(req: NextRequest) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
    const cursor = req.nextUrl.searchParams.get("cursor") || "";

    const response = await trustClient.listPendingTaggings(
      { limit, cursor },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const taggings = (response.taggings || []).map((t) => ({
      id: t.id,
      tagName: t.tagName,
      taggerId: t.taggerId,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({
      taggings,
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
    });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 7) {
        return NextResponse.json({ error: "Cast role required" }, { status: 403 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("ListPendingTaggings Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Create approve/reject routes**

`api/cast/trust/taggings/[id]/approve/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await trustClient.approveTagging(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 7) {
        return NextResponse.json({ error: "Cast role required" }, { status: 403 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("ApproveTagging Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

`api/cast/trust/taggings/[id]/reject/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";
import { buildGrpcHeaders } from "@/lib/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    if (!req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const response = await trustClient.rejectTagging(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error: unknown) {
    if (error instanceof ConnectError) {
      if (error.code === 7) {
        return NextResponse.json({ error: "Cast role required" }, { status: 403 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("RejectTagging Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/app/api/cast/trust/
git commit -m "feat(trust): add cast-only API routes for tagging approval"
```

---

## Task 15: Verification

**Step 1: Run backend tests**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/trust/
```

Expected: ALL PASS.

**Step 2: Run frontend type check**

```bash
cd web/nyx/workspace && pnpm tsc --noEmit
```

Expected: No type errors.

**Step 3: Run database migration + seeds**

```bash
cd services/monolith/workspace && bundle exec rake db:migrate && bundle exec rake db:seed
```

Expected: Migration applies, seeds run without errors.

**Step 4: Start gRPC server and verify service registers**

```bash
cd services/monolith/workspace && bundle exec ruby bin/grpc
```

Expected: Log shows `trust.v1.TrustService` in services list.
