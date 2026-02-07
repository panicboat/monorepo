# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Repositories::BlockRepository", type: :database do
  let(:repo) { Hanami.app.slices[:social]["repositories.block_repository"] }
  let(:blocker_id) { SecureRandom.uuid }
  let(:blocked_id) { SecureRandom.uuid }

  describe "#block" do
    it "creates a block record" do
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: blocked_id,
        blocked_type: "cast"
      )
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be true
    end

    it "is idempotent - does not create duplicate blocks" do
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: blocked_id,
        blocked_type: "cast"
      )
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: blocked_id,
        blocked_type: "cast"
      )

      blocked_ids = repo.blocked_user_ids(blocker_id: blocker_id)
      expect(blocked_ids.count(blocked_id)).to eq(1)
    end
  end

  describe "#unblock" do
    it "removes the block record" do
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: blocked_id,
        blocked_type: "cast"
      )
      repo.unblock(blocker_id: blocker_id, blocked_id: blocked_id)
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be false
    end

    it "does nothing when block does not exist" do
      expect { repo.unblock(blocker_id: blocker_id, blocked_id: blocked_id) }.not_to raise_error
    end
  end

  describe "#blocked?" do
    it "returns true when user is blocked" do
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: blocked_id,
        blocked_type: "cast"
      )
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be true
    end

    it "returns false when user is not blocked" do
      expect(repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)).to be false
    end
  end

  describe "#list_blocked" do
    it "returns the list of blocked records with pagination" do
      blocked_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      blocked_ids.each do |bid|
        repo.block(
          blocker_id: blocker_id,
          blocker_type: "guest",
          blocked_id: bid,
          blocked_type: "cast"
        )
      end

      result = repo.list_blocked(blocker_id: blocker_id, limit: 10)
      expect(result[:records].size).to eq(3)
      expect(result[:has_more]).to be false
    end

    it "respects limit and returns has_more flag" do
      blocked_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      blocked_ids.each do |bid|
        repo.block(
          blocker_id: blocker_id,
          blocker_type: "guest",
          blocked_id: bid,
          blocked_type: "cast"
        )
      end

      result = repo.list_blocked(blocker_id: blocker_id, limit: 2)
      expect(result[:records].size).to eq(2)
      expect(result[:has_more]).to be true
    end

    it "returns empty list when no blocks exist" do
      result = repo.list_blocked(blocker_id: blocker_id, limit: 10)
      expect(result[:records]).to eq([])
      expect(result[:has_more]).to be false
    end
  end

  describe "#blocked_user_ids" do
    it "returns all blocked user IDs" do
      blocked_ids = [SecureRandom.uuid, SecureRandom.uuid]
      blocked_ids.each do |bid|
        repo.block(
          blocker_id: blocker_id,
          blocker_type: "guest",
          blocked_id: bid,
          blocked_type: "cast"
        )
      end

      result = repo.blocked_user_ids(blocker_id: blocker_id)
      expect(result).to match_array(blocked_ids)
    end

    it "returns empty array when no blocks exist" do
      expect(repo.blocked_user_ids(blocker_id: blocker_id)).to eq([])
    end
  end

  describe "#blocked_cast_ids" do
    it "returns only blocked cast IDs" do
      cast_id = SecureRandom.uuid
      guest_id = SecureRandom.uuid

      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: cast_id,
        blocked_type: "cast"
      )
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: guest_id,
        blocked_type: "guest"
      )

      result = repo.blocked_cast_ids(blocker_id: blocker_id)
      expect(result).to eq([cast_id])
    end
  end

  describe "#blocked_guest_ids" do
    it "returns only blocked guest IDs" do
      cast_id = SecureRandom.uuid
      guest_id = SecureRandom.uuid

      repo.block(
        blocker_id: blocker_id,
        blocker_type: "cast",
        blocked_id: cast_id,
        blocked_type: "cast"
      )
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "cast",
        blocked_id: guest_id,
        blocked_type: "guest"
      )

      result = repo.blocked_guest_ids(blocker_id: blocker_id)
      expect(result).to eq([guest_id])
    end
  end

  describe "#block_status_batch" do
    it "returns block status for multiple users" do
      blocked_id2 = SecureRandom.uuid
      repo.block(
        blocker_id: blocker_id,
        blocker_type: "guest",
        blocked_id: blocked_id,
        blocked_type: "cast"
      )

      status = repo.block_status_batch(user_ids: [blocked_id, blocked_id2], blocker_id: blocker_id)
      expect(status[blocked_id]).to be true
      expect(status[blocked_id2]).to be false
    end

    it "returns empty hash for empty user_ids" do
      expect(repo.block_status_batch(user_ids: [], blocker_id: blocker_id)).to eq({})
    end

    it "returns empty hash when blocker_id is nil" do
      expect(repo.block_status_batch(user_ids: [blocked_id], blocker_id: nil)).to eq({})
    end
  end
end
