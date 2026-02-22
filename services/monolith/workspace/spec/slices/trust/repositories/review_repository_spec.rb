# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Trust::Repositories::ReviewRepository", type: :database do
  let(:repo) { Hanami.app.slices[:trust]["repositories.review_repository"] }
  let(:reviewer_id) { SecureRandom.uuid }
  let(:reviewee_id) { SecureRandom.uuid }

  describe "#create" do
    it "creates a review with all attributes" do
      result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Great service!",
        score: 5,
        status: "pending"
      )
      expect(result[:success]).to be true
      expect(result[:id]).to be_a(String)
    end

    it "creates a review with optional content as nil" do
      result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: nil,
        score: 4,
        status: "pending"
      )
      expect(result[:success]).to be true
      expect(result[:id]).to be_a(String)
    end

    it "allows same reviewer to review different reviewees" do
      other_reviewee = SecureRandom.uuid
      repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Good",
        score: 4,
        status: "pending"
      )
      result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: other_reviewee,
        content: "Good",
        score: 4,
        status: "pending"
      )
      expect(result[:success]).to be true
    end
  end

  describe "#find_by_id" do
    it "returns a review by id" do
      result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Find me",
        score: 5,
        status: "pending"
      )
      found = repo.find_by_id(result[:id])
      expect(found).not_to be_nil
      expect(found[:content]).to eq("Find me")
      expect(found[:score]).to eq(5)
    end

    it "returns nil for non-existent id" do
      found = repo.find_by_id(SecureRandom.uuid)
      expect(found).to be_nil
    end
  end

  describe "#update" do
    it "updates content and score for the reviewer's own review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Original",
        score: 3,
        status: "pending"
      )

      result = repo.update(
        id: create_result[:id],
        reviewer_id: reviewer_id,
        content: "Updated content",
        score: 5
      )

      expect(result[:success]).to be true

      found = repo.find_by_id(create_result[:id])
      expect(found[:content]).to eq("Updated content")
      expect(found[:score]).to eq(5)
    end

    it "does not update another reviewer's review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Original",
        score: 3,
        status: "pending"
      )

      result = repo.update(
        id: create_result[:id],
        reviewer_id: SecureRandom.uuid,
        content: "Hacked content",
        score: 1
      )

      expect(result[:success]).to be false
      expect(result[:error]).to eq(:not_found)
    end

    it "returns error for non-existent review" do
      result = repo.update(
        id: SecureRandom.uuid,
        reviewer_id: reviewer_id,
        content: "New content",
        score: 4
      )
      expect(result[:success]).to be false
      expect(result[:error]).to eq(:not_found)
    end
  end

  describe "#delete" do
    it "deletes the reviewer's own review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To delete",
        score: 3,
        status: "pending"
      )

      result = repo.delete(id: create_result[:id], reviewer_id: reviewer_id)
      expect(result[:success]).to be true

      found = repo.find_by_id(create_result[:id])
      expect(found).to be_nil
    end

    it "does not delete another reviewer's review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To delete",
        score: 3,
        status: "pending"
      )

      result = repo.delete(id: create_result[:id], reviewer_id: SecureRandom.uuid)
      expect(result[:success]).to be false

      found = repo.find_by_id(create_result[:id])
      expect(found).not_to be_nil
    end
  end

  describe "#list_by_reviewee" do
    it "returns reviews for a reviewee ordered by created_at desc" do
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "First", score: 4, status: "approved")
      sleep(0.01) # Ensure different timestamps
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "Second", score: 5, status: "approved")

      reviews = repo.list_by_reviewee(reviewee_id: reviewee_id)
      expect(reviews.size).to eq(2)
      expect(reviews.first[:content]).to eq("Second")
      expect(reviews.last[:content]).to eq("First")
    end

    it "filters by status when provided" do
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "Approved", score: 5, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "Pending", score: 4, status: "pending")

      approved_reviews = repo.list_by_reviewee(reviewee_id: reviewee_id, status: "approved")
      expect(approved_reviews.size).to eq(1)
      expect(approved_reviews.first[:content]).to eq("Approved")
    end

    it "returns empty array for reviewee with no reviews" do
      reviews = repo.list_by_reviewee(reviewee_id: SecureRandom.uuid)
      expect(reviews).to eq([])
    end
  end

  describe "#list_pending_by_reviewee" do
    it "returns only pending reviews for a reviewee" do
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "Pending", score: 4, status: "pending")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "Approved", score: 5, status: "approved")

      pending_reviews = repo.list_pending_by_reviewee(reviewee_id: reviewee_id)
      expect(pending_reviews.size).to eq(1)
      expect(pending_reviews.first[:content]).to eq("Pending")
    end
  end

  describe "#list_by_reviewer" do
    it "returns reviews written by a reviewer ordered by created_at desc" do
      other_reviewee = SecureRandom.uuid
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "First", score: 4, status: "pending")
      sleep(0.01)
      repo.create(reviewer_id: reviewer_id, reviewee_id: other_reviewee, content: "Second", score: 5, status: "pending")

      reviews = repo.list_by_reviewer(reviewer_id: reviewer_id)
      expect(reviews.size).to eq(2)
      expect(reviews.first[:content]).to eq("Second")
    end

    it "does not return other reviewers' reviews" do
      other_reviewer = SecureRandom.uuid
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "Mine", score: 4, status: "pending")
      repo.create(reviewer_id: other_reviewer, reviewee_id: reviewee_id, content: "Other", score: 5, status: "pending")

      reviews = repo.list_by_reviewer(reviewer_id: reviewer_id)
      expect(reviews.size).to eq(1)
      expect(reviews.first[:content]).to eq("Mine")
    end
  end

  describe "#approve" do
    it "approves a pending review by the reviewee" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To approve",
        score: 5,
        status: "pending"
      )

      result = repo.approve(id: create_result[:id], reviewee_id: reviewee_id)
      expect(result[:success]).to be true

      found = repo.find_by_id(create_result[:id])
      expect(found[:status]).to eq("approved")
    end

    it "does not approve if not the reviewee" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To approve",
        score: 5,
        status: "pending"
      )

      result = repo.approve(id: create_result[:id], reviewee_id: SecureRandom.uuid)
      expect(result[:success]).to be false

      found = repo.find_by_id(create_result[:id])
      expect(found[:status]).to eq("pending")
    end

    it "does not approve already approved review" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "Already approved",
        score: 5,
        status: "approved"
      )

      result = repo.approve(id: create_result[:id], reviewee_id: reviewee_id)
      expect(result[:success]).to be false
    end
  end

  describe "#reject" do
    it "rejects a pending review by the reviewee" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To reject",
        score: 5,
        status: "pending"
      )

      result = repo.reject(id: create_result[:id], reviewee_id: reviewee_id)
      expect(result[:success]).to be true

      found = repo.find_by_id(create_result[:id])
      expect(found[:status]).to eq("rejected")
    end

    it "does not reject if not the reviewee" do
      create_result = repo.create(
        reviewer_id: reviewer_id,
        reviewee_id: reviewee_id,
        content: "To reject",
        score: 5,
        status: "pending"
      )

      result = repo.reject(id: create_result[:id], reviewee_id: SecureRandom.uuid)
      expect(result[:success]).to be false
    end
  end

  describe "#get_stats" do
    it "returns zero stats for reviewee with no reviews" do
      stats = repo.get_stats(reviewee_id: SecureRandom.uuid)
      expect(stats[:average_score]).to eq(0.0)
      expect(stats[:total_reviews]).to eq(0)
      expect(stats[:approval_rate]).to eq(100)
    end

    it "calculates average score from approved reviews only" do
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "A", score: 4, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "B", score: 2, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "C", score: 1, status: "pending")

      stats = repo.get_stats(reviewee_id: reviewee_id)
      expect(stats[:total_reviews]).to eq(2)
      # Pending review (score: 1) should not be counted
    end

    it "calculates user-average then overall-average" do
      # User A: scores 4, 4, 4 → average 4.0
      # User B: scores 2 → average 2.0
      # Overall average = (4.0 + 2.0) / 2 = 3.0
      user_a = SecureRandom.uuid
      user_b = SecureRandom.uuid

      repo.create(reviewer_id: user_a, reviewee_id: reviewee_id, content: "A1", score: 4, status: "approved")
      repo.create(reviewer_id: user_a, reviewee_id: reviewee_id, content: "A2", score: 4, status: "approved")
      repo.create(reviewer_id: user_a, reviewee_id: reviewee_id, content: "A3", score: 4, status: "approved")
      repo.create(reviewer_id: user_b, reviewee_id: reviewee_id, content: "B1", score: 2, status: "approved")

      stats = repo.get_stats(reviewee_id: reviewee_id)
      expect(stats[:average_score]).to eq(3.0)
      expect(stats[:total_reviews]).to eq(4)
    end

    it "calculates approval rate based on approved and rejected only" do
      # 2 approved, 1 rejected, 1 pending
      # Approval rate = 2 / (2 + 1) = 66.67% → 67%
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "A", score: 5, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "B", score: 4, status: "approved")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "C", score: 3, status: "rejected")
      repo.create(reviewer_id: SecureRandom.uuid, reviewee_id: reviewee_id, content: "D", score: 2, status: "pending")

      stats = repo.get_stats(reviewee_id: reviewee_id)
      expect(stats[:approval_rate]).to eq(67)
    end

    it "returns 100% approval rate when all reviews are approved" do
      repo.create(reviewer_id: reviewer_id, reviewee_id: reviewee_id, content: "A", score: 5, status: "approved")

      stats = repo.get_stats(reviewee_id: reviewee_id)
      expect(stats[:approval_rate]).to eq(100)
    end
  end
end
