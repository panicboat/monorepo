# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Relationship::Repositories::FollowRepository", type: :database do
  let(:repo) { Hanami.app.slices[:relationship]["repositories.follow_repository"] }
  let(:cast_user_id) { SecureRandom.uuid }
  let(:guest_user_id) { SecureRandom.uuid }

  describe "#follow" do
    it "creates an approved follow" do
      result = repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(result[:success]).to be true
      expect(result[:status]).to eq("approved")
    end

    it "returns already_exists when follow exists" do
      repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      result = repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(result[:success]).to be false
      expect(result[:reason]).to eq(:already_exists)
    end
  end

  describe "#request_follow" do
    it "creates a pending follow request" do
      result = repo.request_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(result[:success]).to be true
      expect(result[:status]).to eq("pending")
    end
  end

  describe "#approve_follow" do
    it "approves a pending follow request" do
      repo.request_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      result = repo.approve_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)

      expect(result).to be true
      expect(repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to be true
    end

    it "returns false when no follow exists" do
      result = repo.approve_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(result).to be false
    end
  end

  describe "#reject_follow" do
    it "rejects a pending follow request" do
      repo.request_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      result = repo.reject_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)

      expect(result).to be true
      expect(repo.follow_status(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to be_nil
    end

    it "does not reject an approved follow" do
      repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      result = repo.reject_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(result).to be false
    end
  end

  describe "#unfollow" do
    it "removes a follow" do
      repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      result = repo.unfollow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)

      expect(result).to be true
      expect(repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to be false
    end
  end

  describe "#following?" do
    it "returns false when not following" do
      expect(repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to be false
    end

    it "returns true when following" do
      repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to be true
    end

    it "returns false for pending follow" do
      repo.request_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to be false
    end
  end

  describe "#follow_status" do
    it "returns nil when not following" do
      expect(repo.follow_status(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to be_nil
    end

    it "returns approved when following" do
      repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(repo.follow_status(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to eq("approved")
    end

    it "returns pending for pending request" do
      repo.request_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      expect(repo.follow_status(cast_user_id: cast_user_id, guest_user_id: guest_user_id)).to eq("pending")
    end
  end

  describe "#following_cast_user_ids" do
    it "returns cast user IDs the guest is following" do
      cast_user_id2 = SecureRandom.uuid
      repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      repo.follow(cast_user_id: cast_user_id2, guest_user_id: guest_user_id)

      ids = repo.following_cast_user_ids(guest_user_id: guest_user_id)
      expect(ids).to contain_exactly(cast_user_id, cast_user_id2)
    end

    it "does not include pending follows" do
      repo.request_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      ids = repo.following_cast_user_ids(guest_user_id: guest_user_id)
      expect(ids).to be_empty
    end
  end

  describe "#following_status_batch" do
    it "returns status for multiple casts" do
      cast_user_id2 = SecureRandom.uuid
      cast_user_id3 = SecureRandom.uuid
      repo.follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      repo.request_follow(cast_user_id: cast_user_id2, guest_user_id: guest_user_id)

      status = repo.following_status_batch(cast_user_ids: [cast_user_id, cast_user_id2, cast_user_id3], guest_user_id: guest_user_id)
      expect(status[cast_user_id]).to eq("approved")
      expect(status[cast_user_id2]).to eq("pending")
      expect(status[cast_user_id3]).to eq("none")
    end
  end

  describe "#list_pending_requests" do
    it "returns pending follow requests" do
      3.times do |i|
        repo.request_follow(cast_user_id: cast_user_id, guest_user_id: SecureRandom.uuid)
      end

      result = repo.list_pending_requests(cast_user_id: cast_user_id, limit: 10)
      expect(result[:requests].size).to eq(3)
    end
  end

  describe "#pending_count" do
    it "returns count of pending requests" do
      2.times { repo.request_follow(cast_user_id: cast_user_id, guest_user_id: SecureRandom.uuid) }
      repo.follow(cast_user_id: cast_user_id, guest_user_id: SecureRandom.uuid)

      expect(repo.pending_count(cast_user_id: cast_user_id)).to eq(2)
    end
  end
end
