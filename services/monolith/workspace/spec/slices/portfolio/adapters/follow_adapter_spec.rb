# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Adapters::FollowAdapter do
  let(:adapter) { described_class.new }
  let(:follow_repo) { instance_double(Relationship::Repositories::FollowRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.follow_repository").and_return(follow_repo)
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

  describe "#get_follow_detail" do
    it "returns default when guest_user_id is nil" do
      result = adapter.get_follow_detail(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq({ is_following: false, followed_at: nil })
    end

    it "delegates to follow_repo.get_follow_detail" do
      detail = { is_following: true, followed_at: Time.now }
      allow(follow_repo).to receive(:get_follow_detail)
        .with(cast_user_id: "cast-456", guest_user_id: "guest-123")
        .and_return(detail)

      result = adapter.get_follow_detail(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(detail)
    end
  end

  describe "#approve_all_pending" do
    it "delegates to follow_repo.approve_all_pending" do
      expect(follow_repo).to receive(:approve_all_pending)
        .with(cast_user_id: "cast-123")
        .and_return(3)

      result = adapter.approve_all_pending(cast_user_id: "cast-123")
      expect(result).to eq(3)
    end
  end
end
