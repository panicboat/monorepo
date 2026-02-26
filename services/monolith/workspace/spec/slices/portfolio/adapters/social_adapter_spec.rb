# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Adapters::SocialAdapter do
  let(:adapter) { described_class.new }
  let(:block_repo) { instance_double(Relationship::Repositories::BlockRepository) }
  let(:follow_repo) { instance_double(Relationship::Repositories::FollowRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.block_repository").and_return(block_repo)
    allow(Relationship::Slice).to receive(:[]).with("repositories.follow_repository").and_return(follow_repo)
  end

  describe "#blocked?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.blocked?(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq(false)
    end

    it "delegates to block_repo" do
      allow(block_repo).to receive(:blocked?)
        .with(blocker_id: "guest-123", blocked_id: "cast-456")
        .and_return(true)

      result = adapter.blocked?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#approved_follower?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.approved_follower?(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq(false)
    end

    it "delegates to follow_repo.following?" do
      allow(follow_repo).to receive(:following?)
        .with(cast_user_id: "cast-456", guest_user_id: "guest-123")
        .and_return(true)

      result = adapter.approved_follower?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#follow_status" do
    it "returns nil when guest_user_id is nil" do
      result = adapter.follow_status(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to be_nil
    end

    it "delegates to follow_repo.follow_status" do
      allow(follow_repo).to receive(:follow_status)
        .with(cast_user_id: "cast-456", guest_user_id: "guest-123")
        .and_return("pending")

      result = adapter.follow_status(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq("pending")
    end
  end
end
