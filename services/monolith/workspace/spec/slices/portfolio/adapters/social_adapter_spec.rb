# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Adapters::SocialAdapter do
  let(:adapter) { described_class.new }
  let(:block_repo) { instance_double(Social::Repositories::BlockRepository) }
  let(:follow_repo) { instance_double(Social::Repositories::FollowRepository) }

  before do
    allow(Social::Slice).to receive(:[]).with("repositories.block_repository").and_return(block_repo)
    allow(Social::Slice).to receive(:[]).with("repositories.follow_repository").and_return(follow_repo)
  end

  describe "#blocked?" do
    it "returns false when guest_id is nil" do
      result = adapter.blocked?(guest_id: nil, cast_id: "cast-123")
      expect(result).to eq(false)
    end

    it "delegates to block_repo" do
      allow(block_repo).to receive(:blocked?)
        .with(blocker_id: "guest-123", blocked_id: "cast-456")
        .and_return(true)

      result = adapter.blocked?(guest_id: "guest-123", cast_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#approved_follower?" do
    it "returns false when guest_id is nil" do
      result = adapter.approved_follower?(guest_id: nil, cast_id: "cast-123")
      expect(result).to eq(false)
    end

    it "delegates to follow_repo.following?" do
      allow(follow_repo).to receive(:following?)
        .with(cast_id: "cast-456", guest_id: "guest-123")
        .and_return(true)

      result = adapter.approved_follower?(guest_id: "guest-123", cast_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#follow_status" do
    it "returns nil when guest_id is nil" do
      result = adapter.follow_status(guest_id: nil, cast_id: "cast-123")
      expect(result).to be_nil
    end

    it "delegates to follow_repo.follow_status" do
      allow(follow_repo).to receive(:follow_status)
        .with(cast_id: "cast-456", guest_id: "guest-123")
        .and_return("pending")

      result = adapter.follow_status(guest_id: "guest-123", cast_id: "cast-456")
      expect(result).to eq("pending")
    end
  end
end
