# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Repositories::FollowRepository", type: :database do
  let(:repo) { Hanami.app.slices[:social]["repositories.follow_repository"] }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }

  describe "#follow" do
    it "creates a follow record" do
      repo.follow(cast_id: cast_id, guest_id: guest_id)
      expect(repo.following?(cast_id: cast_id, guest_id: guest_id)).to be true
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
    it "returns follow status for multiple casts" do
      cast_id2 = SecureRandom.uuid
      repo.follow(cast_id: cast_id, guest_id: guest_id)

      status = repo.following_status_batch(cast_ids: [cast_id, cast_id2], guest_id: guest_id)
      expect(status[cast_id]).to be true
      expect(status[cast_id2]).to be false
    end

    it "returns empty hash for empty cast_ids" do
      expect(repo.following_status_batch(cast_ids: [], guest_id: guest_id)).to eq({})
    end
  end
end
