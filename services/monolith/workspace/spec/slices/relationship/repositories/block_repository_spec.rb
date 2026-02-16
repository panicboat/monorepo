# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Relationship::Repositories::BlockRepository", type: :database do
  let(:repo) { Hanami.app.slices[:relationship]["repositories.block_repository"] }
  let(:blocker_id) { SecureRandom.uuid }
  let(:blocked_id) { SecureRandom.uuid }

  describe "#block" do
    it "creates a block" do
      result = repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: blocked_id, blocked_type: "cast")
      expect(result).to be true
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be true
    end

    it "returns false when block already exists" do
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: blocked_id, blocked_type: "cast")
      result = repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: blocked_id, blocked_type: "cast")
      expect(result).to be false
    end
  end

  describe "#unblock" do
    it "removes a block" do
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: blocked_id, blocked_type: "cast")
      result = repo.unblock(blocker_id: blocker_id, blocked_id: blocked_id)

      expect(result).to be true
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be false
    end

    it "returns false when no block exists" do
      result = repo.unblock(blocker_id: blocker_id, blocked_id: blocked_id)
      expect(result).to be false
    end
  end

  describe "#blocked?" do
    it "returns false when not blocked" do
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be false
    end

    it "returns true when blocked" do
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: blocked_id, blocked_type: "cast")
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be true
    end
  end

  describe "#list_blocked" do
    it "returns blocked users" do
      3.times do |i|
        repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: SecureRandom.uuid, blocked_type: "cast")
      end

      result = repo.list_blocked(blocker_id: blocker_id, limit: 10)
      expect(result[:records].size).to eq(3)
    end

    it "respects limit and returns has_more flag" do
      3.times { repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: SecureRandom.uuid, blocked_type: "cast") }

      result = repo.list_blocked(blocker_id: blocker_id, limit: 2)
      expect(result[:records].size).to eq(2)
      expect(result[:has_more]).to be true
    end
  end

  describe "#blocked_user_ids" do
    it "returns all blocked user IDs" do
      id1 = SecureRandom.uuid
      id2 = SecureRandom.uuid
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: id1, blocked_type: "cast")
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: id2, blocked_type: "guest")

      ids = repo.blocked_user_ids(blocker_id: blocker_id)
      expect(ids).to contain_exactly(id1, id2)
    end
  end

  describe "#blocked_cast_ids" do
    it "returns only blocked cast IDs" do
      cast_id = SecureRandom.uuid
      guest_id = SecureRandom.uuid
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: cast_id, blocked_type: "cast")
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: guest_id, blocked_type: "guest")

      ids = repo.blocked_cast_ids(blocker_id: blocker_id)
      expect(ids).to eq([cast_id])
    end
  end

  describe "#blocked_guest_ids" do
    it "returns only blocked guest IDs" do
      cast_id = SecureRandom.uuid
      guest_id = SecureRandom.uuid
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: cast_id, blocked_type: "cast")
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: guest_id, blocked_type: "guest")

      ids = repo.blocked_guest_ids(blocker_id: blocker_id)
      expect(ids).to eq([guest_id])
    end
  end

  describe "#block_status_batch" do
    it "returns block status for multiple users" do
      id1 = SecureRandom.uuid
      id2 = SecureRandom.uuid
      id3 = SecureRandom.uuid
      repo.block(blocker_id: blocker_id, blocker_type: "guest", blocked_id: id1, blocked_type: "cast")

      status = repo.block_status_batch(user_ids: [id1, id2, id3], blocker_id: blocker_id)
      expect(status[id1]).to be true
      expect(status[id2]).to be false
      expect(status[id3]).to be false
    end

    it "returns empty hash for empty input" do
      expect(repo.block_status_batch(user_ids: [], blocker_id: blocker_id)).to eq({})
    end
  end
end
