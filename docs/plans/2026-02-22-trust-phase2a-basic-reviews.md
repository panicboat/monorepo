# Trust Phase 2a: Basic Reviews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 双方向レビュー機能の基本実装（テキスト + スコア、CRUD、承認フロー）

**Architecture:** Phase 1（タグ機能）と同じパターンで実装。ROM Relations/Repositories + Use Cases + gRPC Handler。フロントエンドは hooks + API Routes。メディア添付は Phase 2b で実装。

**Tech Stack:** Ruby (Hanami 2.x + ROM + Gruf), TypeScript (Next.js + SWR), PostgreSQL, ConnectRPC

**Design Doc:** `docs/plans/2026-02-22-trust-phase2-reviews-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260222000001_create_trust_reviews.rb`

**Step 1: Write migration file**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  change do
    create_table(:trust__reviews) do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), null: false
      column :reviewer_id, :uuid, null: false
      column :reviewee_id, :uuid, null: false
      column :content, :text, null: true
      column :score, :integer, null: false
      column :status, :text, default: "approved", null: false
      column :created_at, :timestamptz, default: Sequel::CURRENT_TIMESTAMP, null: false
      column :updated_at, :timestamptz, default: Sequel::CURRENT_TIMESTAMP, null: false

      primary_key [:id]

      constraint(:score_range) { (score >= 1) & (score <= 5) }

      index :reviewer_id
      index :reviewee_id
      index :status
    end
  end
end
```

**Step 2: Run migration**

Run: `cd services/monolith/workspace && bundle exec rake db:migrate`
Expected: Migration applies successfully

**Step 3: Verify schema**

Run: `cd services/monolith/workspace && bundle exec rake db:structure:dump`
Expected: `trust__reviews` table appears in structure.sql

**Step 4: Commit**

```bash
git add services/monolith/workspace/config/db/migrate/20260222000001_create_trust_reviews.rb
git add services/monolith/workspace/config/db/structure.sql
git commit -m "feat(trust): add reviews table migration"
```

---

## Task 2: Seed Data

**Files:**
- Create: `services/monolith/workspace/config/db/seeds/trust_reviews.rb`
- Modify: `services/monolith/workspace/config/db/seeds.rb`

**Step 1: Create seed file**

```ruby
# frozen_string_literal: true

module Seeds
  class TrustReviews
    def self.call
      db = Hanami.app.slices[:trust]["db.rom"].gateways[:default].connection

      # Get existing identities for seeding
      cast_ids = db[:identity__identities].where(role: "cast").select_map(:id)
      guest_ids = db[:identity__identities].where(role: "guest").select_map(:id)

      return if cast_ids.empty? || guest_ids.empty?

      reviews_data = []

      # Guest → Cast reviews (pending and approved)
      guest_ids.first(3).each_with_index do |guest_id, i|
        cast_ids.first(2).each do |cast_id|
          reviews_data << {
            id: SecureRandom.uuid,
            reviewer_id: guest_id,
            reviewee_id: cast_id,
            content: "Great service! Highly recommended. #{i + 1}",
            score: [4, 5].sample,
            status: i.zero? ? "pending" : "approved",
            created_at: Time.now - (i * 86400),
            updated_at: Time.now - (i * 86400)
          }
        end
      end

      # Cast → Guest reviews (always approved, content optional)
      cast_ids.first(2).each do |cast_id|
        guest_ids.first(3).each_with_index do |guest_id, i|
          reviews_data << {
            id: SecureRandom.uuid,
            reviewer_id: cast_id,
            reviewee_id: guest_id,
            content: i.even? ? "Good guest, punctual." : nil,
            score: [3, 4, 5].sample,
            status: "approved",
            created_at: Time.now - (i * 86400),
            updated_at: Time.now - (i * 86400)
          }
        end
      end

      db[:trust__reviews].multi_insert(reviews_data)
      puts "Seeded #{reviews_data.size} trust reviews"
    end
  end
end
```

**Step 2: Add to seeds.rb**

Find `Seeds::TrustTaggings.call` and add after it:

```ruby
Seeds::TrustReviews.call
```

**Step 3: Run seeds**

Run: `cd services/monolith/workspace && bundle exec rake db:seed`
Expected: "Seeded X trust reviews" message

**Step 4: Commit**

```bash
git add services/monolith/workspace/config/db/seeds/trust_reviews.rb
git add services/monolith/workspace/config/db/seeds.rb
git commit -m "feat(trust): add reviews seed data"
```

---

## Task 3: ROM Relation

**Files:**
- Create: `services/monolith/workspace/slices/trust/relations/reviews.rb`

**Step 1: Write relation file**

```ruby
# frozen_string_literal: true

module Trust
  module Relations
    class Reviews < Trust::DB::Relation
      schema(:trust__reviews, infer: true) do
        attribute :id, Types::UUID
        attribute :reviewer_id, Types::UUID
        attribute :reviewee_id, Types::UUID
        attribute :content, Types::String.optional
        attribute :score, Types::Integer
        attribute :status, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

**Step 2: Verify relation loads**

Run: `cd services/monolith/workspace && bundle exec ruby -e "require_relative 'config/app'; Hanami.boot; p Hanami.app.slices[:trust]['relations.reviews']"`
Expected: Returns the relation object without errors

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/trust/relations/reviews.rb
git commit -m "feat(trust): add reviews ROM relation"
```

---

## Task 4: Repository - Basic CRUD

**Files:**
- Create: `services/monolith/workspace/slices/trust/repositories/review_repository.rb`
- Create: `services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb`

**Step 1: Write failing test for create**

```ruby
# frozen_string_literal: true

RSpec.describe "Trust::Repositories::ReviewRepository", type: :database do
  let(:repo) { Hanami.app.slices[:trust]["repositories.review_repository"] }
  let(:reviewer_id) { SecureRandom.uuid }
  let(:reviewee_id) { SecureRandom.uuid }

  describe "#create" do
    it "creates an approved review with content and score" do
      result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Great service!",
        score: 5,
        status: "approved"
      )

      expect(result[:success]).to be true
      expect(result[:id]).to be_a(String)
    end

    it "creates a review without content (score only)" do
      result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: nil,
        score: 4,
        status: "approved"
      )

      expect(result[:success]).to be true
    end

    it "creates a pending review" do
      result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Pending review",
        score: 5,
        status: "pending"
      )

      expect(result[:success]).to be true

      review = repo.find_by_id(result[:id])
      expect(review[:status]).to eq("pending")
    end
  end
end
```

**Step 2: Run test to verify it fails**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: FAIL with "undefined method" or similar

**Step 3: Write minimal repository implementation**

```ruby
# frozen_string_literal: true

module Trust
  module Repositories
    class ReviewRepository < Trust::DB::Repo
      def create(reviewer_id:, reviewee_id:, content:, score:, status:)
        id = SecureRandom.uuid
        now = Time.now

        reviews.insert(
          id: id,
          reviewer_id: reviewer_id,
          reviewee_id: reviewee_id,
          content: content,
          score: score,
          status: status,
          created_at: now,
          updated_at: now
        )

        { success: true, id: id }
      rescue Sequel::UniqueConstraintViolation
        { success: false, error: :already_exists }
      end

      def find_by_id(id)
        reviews.where(id: id).first
      end

      private

      def reviews
        rom.relations[:reviews]
      end
    end
  end
end
```

**Step 4: Run test to verify it passes**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: PASS

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/repositories/review_repository.rb
git add services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb
git commit -m "feat(trust): add review repository with create method"
```

---

## Task 5: Repository - Update and Delete

**Files:**
- Modify: `services/monolith/workspace/slices/trust/repositories/review_repository.rb`
- Modify: `services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb`

**Step 1: Write failing tests**

Add to spec file:

```ruby
  describe "#update" do
    it "updates content and score for own review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Original",
        score: 3,
        status: "approved"
      )

      result = repo.update(
        id: create_result[:id],
        reviewer_id: reviewer_id,
        content: "Updated",
        score: 5
      )

      expect(result[:success]).to be true

      review = repo.find_by_id(create_result[:id])
      expect(review[:content]).to eq("Updated")
      expect(review[:score]).to eq(5)
    end

    it "does not update another reviewer's review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Original",
        score: 3,
        status: "approved"
      )

      other_reviewer = SecureRandom.uuid
      result = repo.update(
        id: create_result[:id],
        reviewer_id: other_reviewer,
        content: "Hacked",
        score: 1
      )

      expect(result[:success]).to be false
      expect(result[:error]).to eq(:not_found)
    end
  end

  describe "#delete" do
    it "deletes own review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To delete",
        score: 4,
        status: "approved"
      )

      result = repo.delete(id: create_result[:id], reviewer_id: reviewer_id)

      expect(result[:success]).to be true
      expect(repo.find_by_id(create_result[:id])).to be_nil
    end

    it "does not delete another reviewer's review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Protected",
        score: 5,
        status: "approved"
      )

      other_reviewer = SecureRandom.uuid
      result = repo.delete(id: create_result[:id], reviewer_id: other_reviewer)

      expect(result[:success]).to be false
      expect(repo.find_by_id(create_result[:id])).not_to be_nil
    end
  end
```

**Step 2: Run test to verify it fails**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: FAIL

**Step 3: Add update and delete methods**

Add to repository:

```ruby
      def update(id:, reviewer_id:, content:, score:)
        updated = reviews
          .where(id: id, reviewer_id: reviewer_id)
          .update(content: content, score: score, updated_at: Time.now)

        if updated.positive?
          { success: true }
        else
          { success: false, error: :not_found }
        end
      end

      def delete(id:, reviewer_id:)
        deleted = reviews.where(id: id, reviewer_id: reviewer_id).delete

        { success: deleted.positive? }
      end
```

**Step 4: Run test to verify it passes**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: PASS

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/repositories/review_repository.rb
git add services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb
git commit -m "feat(trust): add update and delete to review repository"
```

---

## Task 6: Repository - List and Approve/Reject

**Files:**
- Modify: `services/monolith/workspace/slices/trust/repositories/review_repository.rb`
- Modify: `services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb`

**Step 1: Write failing tests**

Add to spec file:

```ruby
  describe "#list_by_reviewee" do
    it "returns approved reviews for reviewee" do
      # Create approved review
      repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Approved",
        score: 5,
        status: "approved"
      )

      # Create pending review (should not appear)
      repo.create(
        reviewer_id: SecureRandom.uuid,
        reviewee_id: reviewee_id,
        content: "Pending",
        score: 4,
        status: "pending"
      )

      reviews = repo.list_by_reviewee(reviewee_id: reviewee_id, status: "approved")

      expect(reviews.size).to eq(1)
      expect(reviews.first[:content]).to eq("Approved")
    end

    it "returns reviews sorted by created_at desc" do
      3.times do |i|
        repo.create(
          reviewer_id: SecureRandom.uuid,
          reviewee_id: reviewee_id,
          content: "Review #{i}",
          score: 5,
          status: "approved"
        )
        sleep(0.01) # Ensure different timestamps
      end

      reviews = repo.list_by_reviewee(reviewee_id: reviewee_id, status: "approved")

      expect(reviews.first[:content]).to eq("Review 2")
      expect(reviews.last[:content]).to eq("Review 0")
    end
  end

  describe "#list_pending_by_reviewee" do
    it "returns pending reviews for reviewee" do
      repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Pending",
        score: 4,
        status: "pending"
      )

      reviews = repo.list_pending_by_reviewee(reviewee_id: reviewee_id)

      expect(reviews.size).to eq(1)
      expect(reviews.first[:status]).to eq("pending")
    end
  end

  describe "#approve" do
    it "changes status from pending to approved" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To approve",
        score: 5,
        status: "pending"
      )

      result = repo.approve(id: create_result[:id], reviewee_id: reviewee_id)

      expect(result[:success]).to be true

      review = repo.find_by_id(create_result[:id])
      expect(review[:status]).to eq("approved")
    end

    it "does not approve if not the reviewee" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Protected",
        score: 5,
        status: "pending"
      )

      other_reviewee = SecureRandom.uuid
      result = repo.approve(id: create_result[:id], reviewee_id: other_reviewee)

      expect(result[:success]).to be false
    end
  end

  describe "#reject" do
    it "changes status from pending to rejected" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To reject",
        score: 2,
        status: "pending"
      )

      result = repo.reject(id: create_result[:id], reviewee_id: reviewee_id)

      expect(result[:success]).to be true

      review = repo.find_by_id(create_result[:id])
      expect(review[:status]).to eq("rejected")
    end
  end
```

**Step 2: Run test to verify it fails**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: FAIL

**Step 3: Add list and approve/reject methods**

Add to repository:

```ruby
      def list_by_reviewee(reviewee_id:, status: nil)
        query = reviews.where(reviewee_id: reviewee_id)
        query = query.where(status: status) if status
        query.order(Sequel.desc(:created_at)).to_a
      end

      def list_pending_by_reviewee(reviewee_id:)
        list_by_reviewee(reviewee_id: reviewee_id, status: "pending")
      end

      def list_by_reviewer(reviewer_id:)
        reviews.where(reviewer_id: reviewer_id).order(Sequel.desc(:created_at)).to_a
      end

      def approve(id:, reviewee_id:)
        updated = reviews
          .where(id: id, reviewee_id: reviewee_id, status: "pending")
          .update(status: "approved", updated_at: Time.now)

        { success: updated.positive? }
      end

      def reject(id:, reviewee_id:)
        updated = reviews
          .where(id: id, reviewee_id: reviewee_id, status: "pending")
          .update(status: "rejected", updated_at: Time.now)

        { success: updated.positive? }
      end
```

**Step 4: Run test to verify it passes**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: PASS

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/repositories/review_repository.rb
git add services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb
git commit -m "feat(trust): add list and approve/reject to review repository"
```

---

## Task 7: Repository - Stats Calculation

**Files:**
- Modify: `services/monolith/workspace/slices/trust/repositories/review_repository.rb`
- Modify: `services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb`

**Step 1: Write failing tests**

Add to spec file:

```ruby
  describe "#get_stats" do
    it "calculates user-average then overall-average score" do
      # User A: 5, 5 → avg 5
      user_a = SecureRandom.uuid
      repo.create(reviewer_id: user_a, reviewee_id: reviewee_id, content: "A1", score: 5, status: "approved")
      repo.create(reviewer_id: user_a, reviewee_id: reviewee_id, content: "A2", score: 5, status: "approved")

      # User B: 3 → avg 3
      user_b = SecureRandom.uuid
      repo.create(reviewer_id: user_b, reviewee_id: reviewee_id, content: "B1", score: 3, status: "approved")

      # Overall: (5 + 3) / 2 = 4.0
      stats = repo.get_stats(reviewee_id: reviewee_id)

      expect(stats[:average_score]).to eq(4.0)
      expect(stats[:total_reviews]).to eq(3)
    end

    it "ignores pending and rejected reviews in score calculation" do
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "Good", score: 5, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "Pending", score: 1, status: "pending")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "Rejected", score: 1, status: "rejected")

      stats = repo.get_stats(reviewee_id: reviewee_id)

      expect(stats[:average_score]).to eq(5.0)
      expect(stats[:total_reviews]).to eq(1)
    end

    it "calculates approval rate" do
      # 3 approved, 1 pending, 1 rejected = 3/5 = 60%
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "A", score: 5, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "B", score: 5, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "C", score: 5, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "D", score: 3, status: "pending")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "E", score: 2, status: "rejected")

      stats = repo.get_stats(reviewee_id: reviewee_id)

      expect(stats[:approval_rate]).to eq(60)
    end

    it "returns zero stats when no reviews exist" do
      stats = repo.get_stats(reviewee_id: reviewee_id)

      expect(stats[:average_score]).to eq(0.0)
      expect(stats[:total_reviews]).to eq(0)
      expect(stats[:approval_rate]).to eq(100)
    end
  end
```

**Step 2: Run test to verify it fails**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: FAIL

**Step 3: Add get_stats method**

Add to repository:

```ruby
      def get_stats(reviewee_id:)
        approved_reviews = reviews.where(reviewee_id: reviewee_id, status: "approved")
        total_reviews = approved_reviews.count

        return { average_score: 0.0, total_reviews: 0, approval_rate: 100 } if total_reviews.zero?

        # User-average → Overall-average calculation
        user_averages = approved_reviews
          .select_group(:reviewer_id)
          .select_append { avg(score).as(:user_avg) }
          .to_a

        overall_average = if user_averages.empty?
          0.0
        else
          user_averages.sum { |r| r[:user_avg].to_f } / user_averages.size
        end

        # Approval rate: approved / (approved + rejected)
        # Pending reviews are not counted
        all_decided = reviews
          .where(reviewee_id: reviewee_id)
          .where(status: %w[approved rejected])
          .count

        approval_rate = if all_decided.zero?
          100
        else
          (total_reviews * 100.0 / all_decided).round
        end

        {
          average_score: overall_average.round(1),
          total_reviews: total_reviews,
          approval_rate: approval_rate
        }
      end
```

**Step 4: Run test to verify it passes**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/repositories/review_repository_spec.rb -v`
Expected: PASS

**Step 5: Commit**

```bash
git add services/monolith/workspace/slices/trust/repositories/review_repository.rb
git add services/monolith/workspace/spec/slices/trust/repositories/review_repository_spec.rb
git commit -m "feat(trust): add stats calculation to review repository"
```

---

## Task 8: Use Cases

**Files:**
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/create_review.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/update_review.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/delete_review.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/list_reviews.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/get_review_stats.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/approve_review.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/reject_review.rb`
- Create: `services/monolith/workspace/slices/trust/use_cases/reviews/list_pending_reviews.rb`

**Step 1: Create use case files**

`create_review.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class CreateReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewer_id:, reviewee_id:, content:, score:, is_cast_reviewer:)
          content = content&.strip
          content = nil if content&.empty?

          # Cast → Guest: always approved, content optional
          # Guest → Cast: pending, content required
          status = is_cast_reviewer ? "approved" : "pending"

          if !is_cast_reviewer && content.nil?
            return { success: false, error: :content_required }
          end

          review_repo.create(
            reviewer_id: reviewer_id,
            reviewee_id: reviewee_id,
            content: content,
            score: score,
            status: status
          )
        end
      end
    end
  end
end
```

`update_review.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class UpdateReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(id:, reviewer_id:, content:, score:)
          content = content&.strip
          content = nil if content&.empty?

          review_repo.update(
            id: id,
            reviewer_id: reviewer_id,
            content: content,
            score: score
          )
        end
      end
    end
  end
end
```

`delete_review.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class DeleteReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(id:, reviewer_id:)
          review_repo.delete(id: id, reviewer_id: reviewer_id)
        end
      end
    end
  end
end
```

`list_reviews.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ListReviews
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:, status: nil)
          reviews = review_repo.list_by_reviewee(reviewee_id: reviewee_id, status: status)

          reviews.map do |r|
            {
              id: r[:id],
              reviewer_id: r[:reviewer_id],
              reviewee_id: r[:reviewee_id],
              content: r[:content],
              score: r[:score],
              status: r[:status],
              created_at: r[:created_at]&.iso8601
            }
          end
        end
      end
    end
  end
end
```

`get_review_stats.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class GetReviewStats
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:)
          review_repo.get_stats(reviewee_id: reviewee_id)
        end
      end
    end
  end
end
```

`approve_review.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ApproveReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(id:, reviewee_id:)
          review_repo.approve(id: id, reviewee_id: reviewee_id)
        end
      end
    end
  end
end
```

`reject_review.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class RejectReview
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(id:, reviewee_id:)
          review_repo.reject(id: id, reviewee_id: reviewee_id)
        end
      end
    end
  end
end
```

`list_pending_reviews.rb`:
```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class ListPendingReviews
        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewee_id:)
          reviews = review_repo.list_pending_by_reviewee(reviewee_id: reviewee_id)

          reviews.map do |r|
            {
              id: r[:id],
              reviewer_id: r[:reviewer_id],
              content: r[:content],
              score: r[:score],
              created_at: r[:created_at]&.iso8601
            }
          end
        end
      end
    end
  end
end
```

**Step 2: Verify use cases load**

Run: `cd services/monolith/workspace && bundle exec ruby -e "require_relative 'config/app'; Hanami.boot; p Hanami.app.slices[:trust]['use_cases.reviews.create_review']"`
Expected: Returns the use case object without errors

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/trust/use_cases/reviews/
git commit -m "feat(trust): add review use cases"
```

---

## Task 9: Proto Definition

**Files:**
- Modify: `proto/trust/v1/service.proto`

**Step 1: Add Review messages and RPCs**

Add after existing messages:

```protobuf
// Review messages
message Review {
  string id = 1;
  string reviewer_id = 2;
  string reviewee_id = 3;
  optional string content = 4;
  int32 score = 5;
  string status = 6;
  string created_at = 7;
}

message ReviewStats {
  double average_score = 1;
  int32 total_reviews = 2;
  int32 approval_rate = 3;
}

// Review requests/responses
message CreateReviewRequest {
  string reviewee_id = 1;
  optional string content = 2;
  int32 score = 3;
}

message CreateReviewResponse {
  bool success = 1;
  string id = 2;
}

message UpdateReviewRequest {
  string id = 1;
  optional string content = 2;
  int32 score = 3;
}

message UpdateReviewResponse {
  bool success = 1;
}

message DeleteReviewRequest {
  string id = 1;
}

message DeleteReviewResponse {
  bool success = 1;
}

message ListReviewsRequest {
  string reviewee_id = 1;
  optional string status = 2;
}

message ListReviewsResponse {
  repeated Review reviews = 1;
}

message GetReviewStatsRequest {
  string reviewee_id = 1;
}

message GetReviewStatsResponse {
  ReviewStats stats = 1;
}

message ApproveReviewRequest {
  string id = 1;
}

message ApproveReviewResponse {
  bool success = 1;
}

message RejectReviewRequest {
  string id = 1;
}

message RejectReviewResponse {
  bool success = 1;
}

message ListPendingReviewsRequest {}

message ListPendingReviewsResponse {
  repeated Review reviews = 1;
}
```

Add to `service TrustService`:

```protobuf
  // Review RPCs
  rpc CreateReview(CreateReviewRequest) returns (CreateReviewResponse);
  rpc UpdateReview(UpdateReviewRequest) returns (UpdateReviewResponse);
  rpc DeleteReview(DeleteReviewRequest) returns (DeleteReviewResponse);
  rpc ListReviews(ListReviewsRequest) returns (ListReviewsResponse);
  rpc GetReviewStats(GetReviewStatsRequest) returns (GetReviewStatsResponse);
  rpc ApproveReview(ApproveReviewRequest) returns (ApproveReviewResponse);
  rpc RejectReview(RejectReviewRequest) returns (RejectReviewResponse);
  rpc ListPendingReviews(ListPendingReviewsRequest) returns (ListPendingReviewsResponse);
```

**Step 2: Generate proto files**

Run: `cd proto && buf generate`
Expected: Proto files generated without errors

**Step 3: Commit**

```bash
git add proto/trust/v1/service.proto
git add services/monolith/workspace/lib/protos/
git add web/nyx/workspace/src/stub/
git commit -m "feat(trust): add review proto definitions"
```

---

## Task 10: gRPC Handler

**Files:**
- Modify: `services/monolith/workspace/slices/trust/grpc/trust_handler.rb`

**Step 1: Add Review RPC handlers**

Add RPC definitions:

```ruby
    rpc :CreateReview, ::Trust::V1::CreateReviewRequest, ::Trust::V1::CreateReviewResponse
    rpc :UpdateReview, ::Trust::V1::UpdateReviewRequest, ::Trust::V1::UpdateReviewResponse
    rpc :DeleteReview, ::Trust::V1::DeleteReviewRequest, ::Trust::V1::DeleteReviewResponse
    rpc :ListReviews, ::Trust::V1::ListReviewsRequest, ::Trust::V1::ListReviewsResponse
    rpc :GetReviewStats, ::Trust::V1::GetReviewStatsRequest, ::Trust::V1::GetReviewStatsResponse
    rpc :ApproveReview, ::Trust::V1::ApproveReviewRequest, ::Trust::V1::ApproveReviewResponse
    rpc :RejectReview, ::Trust::V1::RejectReviewRequest, ::Trust::V1::RejectReviewResponse
    rpc :ListPendingReviews, ::Trust::V1::ListPendingReviewsRequest, ::Trust::V1::ListPendingReviewsResponse
```

Add Deps:

```ruby
      include Trust::Deps[
        # existing...
        create_review_uc: "use_cases.reviews.create_review",
        update_review_uc: "use_cases.reviews.update_review",
        delete_review_uc: "use_cases.reviews.delete_review",
        list_reviews_uc: "use_cases.reviews.list_reviews",
        get_review_stats_uc: "use_cases.reviews.get_review_stats",
        approve_review_uc: "use_cases.reviews.approve_review",
        reject_review_uc: "use_cases.reviews.reject_review",
        list_pending_reviews_uc: "use_cases.reviews.list_pending_reviews"
      ]
```

Add handler methods:

```ruby
      def create_review
        authenticate_user!

        score = request.message.score
        if score < 1 || score > 5
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Score must be between 1 and 5")
        end

        result = create_review_uc.call(
          reviewer_id: current_user_id,
          reviewee_id: request.message.reviewee_id,
          content: request.message.content,
          score: score,
          is_cast_reviewer: current_user_cast?
        )

        if result[:error] == :content_required
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Content is required for guest reviews")
        end

        ::Trust::V1::CreateReviewResponse.new(success: result[:success], id: result[:id] || "")
      end

      def update_review
        authenticate_user!
        authenticate_cast!

        result = update_review_uc.call(
          id: request.message.id,
          reviewer_id: current_user_id,
          content: request.message.content,
          score: request.message.score
        )

        if result[:error] == :not_found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Review not found")
        end

        ::Trust::V1::UpdateReviewResponse.new(success: result[:success])
      end

      def delete_review
        authenticate_user!

        result = delete_review_uc.call(
          id: request.message.id,
          reviewer_id: current_user_id
        )

        ::Trust::V1::DeleteReviewResponse.new(success: result[:success])
      end

      def list_reviews
        reviews = list_reviews_uc.call(
          reviewee_id: request.message.reviewee_id,
          status: request.message.status.presence
        )

        proto_reviews = reviews.map do |r|
          ::Trust::V1::Review.new(
            id: r[:id],
            reviewer_id: r[:reviewer_id],
            reviewee_id: r[:reviewee_id],
            content: r[:content],
            score: r[:score],
            status: r[:status],
            created_at: r[:created_at]
          )
        end

        ::Trust::V1::ListReviewsResponse.new(reviews: proto_reviews)
      end

      def get_review_stats
        stats = get_review_stats_uc.call(reviewee_id: request.message.reviewee_id)

        ::Trust::V1::GetReviewStatsResponse.new(
          stats: ::Trust::V1::ReviewStats.new(
            average_score: stats[:average_score],
            total_reviews: stats[:total_reviews],
            approval_rate: stats[:approval_rate]
          )
        )
      end

      def approve_review
        authenticate_user!
        authenticate_cast!

        result = approve_review_uc.call(
          id: request.message.id,
          reviewee_id: current_user_id
        )

        ::Trust::V1::ApproveReviewResponse.new(success: result[:success])
      end

      def reject_review
        authenticate_user!
        authenticate_cast!

        result = reject_review_uc.call(
          id: request.message.id,
          reviewee_id: current_user_id
        )

        ::Trust::V1::RejectReviewResponse.new(success: result[:success])
      end

      def list_pending_reviews
        authenticate_user!
        authenticate_cast!

        reviews = list_pending_reviews_uc.call(reviewee_id: current_user_id)

        proto_reviews = reviews.map do |r|
          ::Trust::V1::Review.new(
            id: r[:id],
            reviewer_id: r[:reviewer_id],
            content: r[:content],
            score: r[:score],
            created_at: r[:created_at]
          )
        end

        ::Trust::V1::ListPendingReviewsResponse.new(reviews: proto_reviews)
      end
```

**Step 2: Verify handler loads**

Run: `cd services/monolith/workspace && bundle exec ruby -e "require_relative 'config/app'; Hanami.boot; p Trust::Grpc::TrustHandler.new"`
Expected: Returns handler object without errors

**Step 3: Commit**

```bash
git add services/monolith/workspace/slices/trust/grpc/trust_handler.rb
git commit -m "feat(trust): add review gRPC handlers"
```

---

## Task 11: Frontend Types

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/types.ts`

**Step 1: Add Review types**

```typescript
export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  content?: string;
  score: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface ReviewStats {
  averageScore: number;
  totalReviews: number;
  approvalRate: number;
}

export interface CreateReviewRequest {
  revieweeId: string;
  content?: string;
  score: number;
}

export interface CreateReviewResponse {
  success: boolean;
  id?: string;
}

export interface UpdateReviewRequest {
  id: string;
  content?: string;
  score: number;
}

export interface ListReviewsResponse {
  reviews: Review[];
}

export interface ReviewStatsResponse {
  stats: ReviewStats;
}

export interface PendingReviewsResponse {
  reviews: Review[];
}
```

**Step 2: Export types**

Add to `index.ts`:

```typescript
export type {
  Review,
  ReviewStats,
  CreateReviewRequest,
  CreateReviewResponse,
  UpdateReviewRequest,
  ListReviewsResponse,
  ReviewStatsResponse,
  PendingReviewsResponse,
} from "./types";
```

**Step 3: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/types.ts
git add web/nyx/workspace/src/modules/trust/index.ts
git commit -m "feat(trust): add review frontend types"
```

---

## Task 12: Frontend Hooks

**Files:**
- Create: `web/nyx/workspace/src/modules/trust/hooks/useReviews.ts`
- Create: `web/nyx/workspace/src/modules/trust/hooks/useReviewStats.ts`
- Create: `web/nyx/workspace/src/modules/trust/hooks/usePendingReviews.ts`
- Modify: `web/nyx/workspace/src/modules/trust/hooks/index.ts`

**Step 1: Create useReviews hook**

```typescript
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/swr";
import type {
  Review,
  CreateReviewResponse,
  ListReviewsResponse,
} from "../types";

export function useReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReviews = useCallback(
    async (revieweeId: string, status?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ reviewee_id: revieweeId });
        if (status) params.append("status", status);

        const data = await authFetch<ListReviewsResponse>(
          `/api/shared/trust/reviews?${params}`
        );
        setReviews(data.reviews || []);
        return data.reviews || [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createReview = useCallback(
    async (revieweeId: string, content: string | undefined, score: number) => {
      const data = await authFetch<CreateReviewResponse>(
        "/api/me/trust/reviews",
        {
          method: "POST",
          body: { revieweeId, content, score },
        }
      );
      return data;
    },
    []
  );

  const updateReview = useCallback(
    async (id: string, content: string | undefined, score: number) => {
      const data = await authFetch<{ success: boolean }>(
        `/api/me/trust/reviews/${id}`,
        {
          method: "PATCH",
          body: { content, score },
        }
      );
      return data.success;
    },
    []
  );

  const deleteReview = useCallback(async (id: string) => {
    const data = await authFetch<{ success: boolean }>(
      `/api/me/trust/reviews/${id}`,
      { method: "DELETE" }
    );
    if (data.success) {
      setReviews((prev) => prev.filter((r) => r.id !== id));
    }
    return data.success;
  }, []);

  return {
    reviews,
    loading,
    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
  };
}
```

**Step 2: Create useReviewStats hook**

```typescript
"use client";

import useSWR from "swr";
import { authFetcher, getAuthToken } from "@/lib/swr";
import type { ReviewStatsResponse } from "../types";

export function useReviewStats(revieweeId: string | null) {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<ReviewStatsResponse>(
    revieweeId && token
      ? `/api/shared/trust/reviews/stats?reviewee_id=${revieweeId}`
      : null,
    authFetcher,
    { revalidateOnFocus: false }
  );

  return {
    stats: data?.stats || { averageScore: 0, totalReviews: 0, approvalRate: 100 },
    loading: isLoading,
    error,
    refresh: mutate,
  };
}
```

**Step 3: Create usePendingReviews hook**

```typescript
"use client";

import useSWR from "swr";
import { authFetcher, getAuthToken, authFetch } from "@/lib/swr";
import type { PendingReviewsResponse } from "../types";
import { useCallback } from "react";

export function usePendingReviews() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PendingReviewsResponse>(
    token ? "/api/cast/trust/reviews/pending" : null,
    authFetcher,
    { revalidateOnFocus: true }
  );

  const approve = useCallback(
    async (id: string) => {
      const result = await authFetch<{ success: boolean }>(
        `/api/cast/trust/reviews/${id}/approve`,
        { method: "POST" }
      );
      if (result.success) {
        mutate();
      }
      return result.success;
    },
    [mutate]
  );

  const reject = useCallback(
    async (id: string) => {
      const result = await authFetch<{ success: boolean }>(
        `/api/cast/trust/reviews/${id}/reject`,
        { method: "POST" }
      );
      if (result.success) {
        mutate();
      }
      return result.success;
    },
    [mutate]
  );

  return {
    pendingReviews: data?.reviews || [],
    pendingCount: data?.reviews?.length || 0,
    loading: isLoading,
    error,
    approve,
    reject,
    refresh: mutate,
  };
}
```

**Step 4: Update hooks index**

```typescript
export { useTaggings } from "./useTaggings";
export { useMyTagNames } from "./useMyTagNames";
export { useReviews } from "./useReviews";
export { useReviewStats } from "./useReviewStats";
export { usePendingReviews } from "./usePendingReviews";
```

**Step 5: Commit**

```bash
git add web/nyx/workspace/src/modules/trust/hooks/
git commit -m "feat(trust): add review frontend hooks"
```

---

## Task 13: API Routes

**Files:**
- Create: `web/nyx/workspace/src/app/api/me/trust/reviews/route.ts`
- Create: `web/nyx/workspace/src/app/api/me/trust/reviews/[id]/route.ts`
- Create: `web/nyx/workspace/src/app/api/cast/trust/reviews/pending/route.ts`
- Create: `web/nyx/workspace/src/app/api/cast/trust/reviews/[id]/approve/route.ts`
- Create: `web/nyx/workspace/src/app/api/cast/trust/reviews/[id]/reject/route.ts`
- Create: `web/nyx/workspace/src/app/api/shared/trust/reviews/route.ts`
- Create: `web/nyx/workspace/src/app/api/shared/trust/reviews/stats/route.ts`

**Step 1: Create me/trust/reviews/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient, buildGrpcHeaders } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function POST(req: NextRequest) {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { revieweeId, content, score } = await req.json();

    if (!revieweeId) {
      return NextResponse.json(
        { error: "revieweeId is required" },
        { status: 400 }
      );
    }

    const response = await trustClient.createReview(
      { revieweeId, content, score },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success, id: response.id });
  } catch (error) {
    if (error instanceof ConnectError) {
      if (error.code === 3) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("CreateReview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Create me/trust/reviews/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient, buildGrpcHeaders } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { content, score } = await req.json();

    const response = await trustClient.updateReview(
      { id, content, score },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error) {
    if (error instanceof ConnectError) {
      if (error.code === 5) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("UpdateReview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const response = await trustClient.deleteReview(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error) {
    if (error instanceof ConnectError) {
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("DeleteReview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 3: Create cast/trust/reviews/pending/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient, buildGrpcHeaders } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function GET(req: NextRequest) {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await trustClient.listPendingReviews(
      {},
      { headers: buildGrpcHeaders(req.headers) }
    );

    const reviews = response.reviews.map((r) => ({
      id: r.id,
      reviewerId: r.reviewerId,
      content: r.content,
      score: r.score,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ reviews });
  } catch (error) {
    if (error instanceof ConnectError) {
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("ListPendingReviews error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 4: Create cast/trust/reviews/[id]/approve/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient, buildGrpcHeaders } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const response = await trustClient.approveReview(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error) {
    if (error instanceof ConnectError) {
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("ApproveReview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 5: Create cast/trust/reviews/[id]/reject/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient, buildGrpcHeaders } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const response = await trustClient.rejectReview(
      { id },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success });
  } catch (error) {
    if (error instanceof ConnectError) {
      if (error.code === 16) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    console.error("RejectReview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 6: Create shared/trust/reviews/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient, buildGrpcHeaders } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function GET(req: NextRequest) {
  try {
    const revieweeId = req.nextUrl.searchParams.get("reviewee_id");
    const status = req.nextUrl.searchParams.get("status");

    if (!revieweeId) {
      return NextResponse.json(
        { error: "reviewee_id is required" },
        { status: 400 }
      );
    }

    const response = await trustClient.listReviews(
      { revieweeId, status: status || undefined },
      { headers: buildGrpcHeaders(req.headers) }
    );

    const reviews = response.reviews.map((r) => ({
      id: r.id,
      reviewerId: r.reviewerId,
      revieweeId: r.revieweeId,
      content: r.content,
      score: r.score,
      status: r.status,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ reviews });
  } catch (error) {
    if (error instanceof ConnectError) {
      console.error("ListReviews error:", error.code, error.message);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 7: Create shared/trust/reviews/stats/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { trustClient, buildGrpcHeaders } from "@/lib/grpc";
import { ConnectError } from "@connectrpc/connect";

export async function GET(req: NextRequest) {
  try {
    const revieweeId = req.nextUrl.searchParams.get("reviewee_id");

    if (!revieweeId) {
      return NextResponse.json(
        { error: "reviewee_id is required" },
        { status: 400 }
      );
    }

    const response = await trustClient.getReviewStats(
      { revieweeId },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({
      stats: {
        averageScore: response.stats?.averageScore || 0,
        totalReviews: response.stats?.totalReviews || 0,
        approvalRate: response.stats?.approvalRate || 100,
      },
    });
  } catch (error) {
    if (error instanceof ConnectError) {
      console.error("GetReviewStats error:", error.code, error.message);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 8: Commit**

```bash
git add web/nyx/workspace/src/app/api/me/trust/reviews/
git add web/nyx/workspace/src/app/api/cast/trust/reviews/
git add web/nyx/workspace/src/app/api/shared/trust/reviews/
git commit -m "feat(trust): add review API routes"
```

---

## Task 14: Integration Test

**Step 1: Start backend server**

Run: `cd services/monolith/workspace && bundle exec hanami server`
Expected: Server starts on port 2300

**Step 2: Start frontend server**

Run: `cd web/nyx/workspace && pnpm dev`
Expected: Server starts on port 3000

**Step 3: Test via curl**

```bash
# Get JWT token (use existing login flow)
# Then test review stats endpoint
curl -X GET "http://localhost:3000/api/shared/trust/reviews/stats?reviewee_id=<cast_id>" \
  -H "Authorization: Bearer <token>"
```

Expected: Returns review stats JSON

**Step 4: Verify all tests pass**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/`
Expected: All tests pass

---

## Summary

Phase 2a 完了後の状態:
- ✅ レビュー CRUD（テキスト + スコア）
- ✅ 承認/却下フロー
- ✅ ユーザー単位平均 → 全体平均のスコア計算
- ✅ 承認率計算
- ✅ フロントエンド hooks + API Routes

Phase 2b で追加予定:
- メディア添付（trust__review_media テーブル + Media ドメイン連携）

Phase 2c で追加予定:
- モーダル統合 UI
- ホーム承認待ちセクション
- 自分のレビュー一覧ページ
