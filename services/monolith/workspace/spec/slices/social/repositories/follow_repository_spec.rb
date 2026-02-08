# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Repositories::FollowRepository", type: :database do
  let(:repo) { Hanami.app.slices[:social]["repositories.follow_repository"] }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }

  describe "#follow" do
    it "creates a follow record with default approved status" do
      repo.follow(cast_id: cast_id, guest_id: guest_id)
      expect(repo.following?(cast_id: cast_id, guest_id: guest_id)).to be true
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to eq("approved")
    end

    it "creates a pending follow request when status is pending" do
      repo.follow(cast_id: cast_id, guest_id: guest_id, status: "pending")
      expect(repo.following?(cast_id: cast_id, guest_id: guest_id)).to be false
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to eq("pending")
    end

    it "is idempotent - does not create duplicate follows" do
      repo.follow(cast_id: cast_id, guest_id: guest_id)
      repo.follow(cast_id: cast_id, guest_id: guest_id)

      cast_ids = repo.following_cast_ids(guest_id: guest_id)
      expect(cast_ids.count(cast_id)).to eq(1)
    end
  end

  describe "#unfollow" do
    it "removes the follow record" do
      repo.follow(cast_id: cast_id, guest_id: guest_id)
      repo.unfollow(cast_id: cast_id, guest_id: guest_id)
      expect(repo.following?(cast_id: cast_id, guest_id: guest_id)).to be false
    end

    it "does nothing when follow does not exist" do
      expect { repo.unfollow(cast_id: cast_id, guest_id: guest_id) }.not_to raise_error
    end
  end

  describe "#following?" do
    it "returns true when guest is following the cast" do
      repo.follow(cast_id: cast_id, guest_id: guest_id)
      expect(repo.following?(cast_id: cast_id, guest_id: guest_id)).to be true
    end

    it "returns false when guest is not following the cast" do
      expect(repo.following?(cast_id: cast_id, guest_id: guest_id)).to be false
    end
  end

  describe "#list_following" do
    it "returns the list of followed cast IDs with pagination" do
      cast_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      cast_ids.each { |cid| repo.follow(cast_id: cid, guest_id: guest_id) }

      result = repo.list_following(guest_id: guest_id, limit: 10)
      expect(result[:cast_ids].size).to eq(3)
      expect(result[:cast_ids]).to match_array(cast_ids)
      expect(result[:has_more]).to be false
    end

    it "respects limit and returns has_more flag" do
      cast_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      cast_ids.each { |cid| repo.follow(cast_id: cid, guest_id: guest_id) }

      result = repo.list_following(guest_id: guest_id, limit: 2)
      expect(result[:cast_ids].size).to eq(2)
      expect(result[:has_more]).to be true
    end

    it "returns empty list when not following anyone" do
      result = repo.list_following(guest_id: guest_id, limit: 10)
      expect(result[:cast_ids]).to eq([])
      expect(result[:has_more]).to be false
    end
  end

  describe "#following_cast_ids" do
    it "returns all followed cast IDs" do
      cast_ids = [SecureRandom.uuid, SecureRandom.uuid]
      cast_ids.each { |cid| repo.follow(cast_id: cid, guest_id: guest_id) }

      result = repo.following_cast_ids(guest_id: guest_id)
      expect(result).to match_array(cast_ids)
    end

    it "returns empty array when not following anyone" do
      expect(repo.following_cast_ids(guest_id: guest_id)).to eq([])
    end
  end

  describe "#following_status_batch" do
    it "returns follow status string for multiple casts" do
      cast_id2 = SecureRandom.uuid
      cast_id3 = SecureRandom.uuid
      repo.follow(cast_id: cast_id, guest_id: guest_id, status: "approved")
      repo.follow(cast_id: cast_id2, guest_id: guest_id, status: "pending")

      status = repo.following_status_batch(cast_ids: [cast_id, cast_id2, cast_id3], guest_id: guest_id)
      expect(status[cast_id]).to eq("approved")
      expect(status[cast_id2]).to eq("pending")
      expect(status[cast_id3]).to eq("none")
    end

    it "returns empty hash for empty cast_ids" do
      expect(repo.following_status_batch(cast_ids: [], guest_id: guest_id)).to eq({})
    end
  end

  describe "#follow_status" do
    it "returns 'approved' for approved follows" do
      repo.follow(cast_id: cast_id, guest_id: guest_id, status: "approved")
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to eq("approved")
    end

    it "returns 'pending' for pending follow requests" do
      repo.follow(cast_id: cast_id, guest_id: guest_id, status: "pending")
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to eq("pending")
    end

    it "returns nil when no follow exists" do
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to be_nil
    end
  end

  describe "#approve_follow" do
    it "changes pending status to approved" do
      repo.follow(cast_id: cast_id, guest_id: guest_id, status: "pending")
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to eq("pending")

      repo.approve_follow(cast_id: cast_id, guest_id: guest_id)
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to eq("approved")
      expect(repo.following?(cast_id: cast_id, guest_id: guest_id)).to be true
    end

    it "does nothing when follow does not exist" do
      expect { repo.approve_follow(cast_id: cast_id, guest_id: guest_id) }.not_to raise_error
    end
  end

  describe "#reject_follow" do
    it "removes the pending follow request" do
      repo.follow(cast_id: cast_id, guest_id: guest_id, status: "pending")
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to eq("pending")

      result = repo.reject_follow(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be true
      expect(repo.follow_status(cast_id: cast_id, guest_id: guest_id)).to be_nil
    end

    it "returns false when follow does not exist" do
      result = repo.reject_follow(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be false
    end
  end

  describe "#list_pending_requests" do
    it "returns pending follow requests for a cast" do
      guest_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      guest_ids.each { |gid| repo.follow(cast_id: cast_id, guest_id: gid, status: "pending") }

      result = repo.list_pending_requests(cast_id: cast_id, limit: 10)
      expect(result[:requests].size).to eq(3)
      expect(result[:has_more]).to be false
    end

    it "does not return approved follows" do
      guest_id2 = SecureRandom.uuid
      repo.follow(cast_id: cast_id, guest_id: guest_id, status: "pending")
      repo.follow(cast_id: cast_id, guest_id: guest_id2, status: "approved")

      result = repo.list_pending_requests(cast_id: cast_id, limit: 10)
      expect(result[:requests].size).to eq(1)
      expect(result[:requests].first[:guest_id]).to eq(guest_id)
    end

    it "respects limit and returns has_more flag" do
      guest_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      guest_ids.each { |gid| repo.follow(cast_id: cast_id, guest_id: gid, status: "pending") }

      result = repo.list_pending_requests(cast_id: cast_id, limit: 2)
      expect(result[:requests].size).to eq(2)
      expect(result[:has_more]).to be true
    end
  end

  describe "#pending_count" do
    it "returns the count of pending follow requests" do
      guest_ids = [SecureRandom.uuid, SecureRandom.uuid]
      guest_ids.each { |gid| repo.follow(cast_id: cast_id, guest_id: gid, status: "pending") }
      repo.follow(cast_id: cast_id, guest_id: SecureRandom.uuid, status: "approved")

      expect(repo.pending_count(cast_id: cast_id)).to eq(2)
    end

    it "returns 0 when no pending requests" do
      expect(repo.pending_count(cast_id: cast_id)).to eq(0)
    end
  end

  describe "#approve_all_pending" do
    it "approves all pending follow requests for a cast" do
      guest_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      guest_ids.each { |gid| repo.follow(cast_id: cast_id, guest_id: gid, status: "pending") }

      count = repo.approve_all_pending(cast_id: cast_id)
      expect(count).to eq(3)

      guest_ids.each do |gid|
        expect(repo.follow_status(cast_id: cast_id, guest_id: gid)).to eq("approved")
      end
    end

    it "returns 0 when no pending requests" do
      expect(repo.approve_all_pending(cast_id: cast_id)).to eq(0)
    end
  end
end
