# frozen_string_literal: true

require "spec_helper"

RSpec.describe Profile::Adapters::FollowAdapter do
  let(:adapter) { described_class.new }
  let(:follow_repo) { instance_double(Social::Repositories::FollowRepository) }

  before do
    allow(Social::Slice).to receive(:[]).with("repositories.follow_repository").and_return(follow_repo)
  end

  describe "#approved_follower?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.approved_follower?(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq(false)
    end

    it "returns true when an approved follow row exists" do
      row = double("FollowRow", status: "approved")
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(row)

      result = adapter.approved_follower?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(true)
    end

    it "returns false when the follow row is pending" do
      row = double("FollowRow", status: "pending")
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(row)

      result = adapter.approved_follower?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(false)
    end

    it "returns false when no row exists" do
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(nil)

      result = adapter.approved_follower?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(false)
    end
  end

  describe "#follow_status" do
    it "returns nil when guest_user_id is nil" do
      result = adapter.follow_status(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to be_nil
    end

    it "returns the status of the existing row" do
      row = double("FollowRow", status: "pending")
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(row)

      result = adapter.follow_status(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq("pending")
    end

    it "returns nil when no row exists" do
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(nil)

      result = adapter.follow_status(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to be_nil
    end
  end

  describe "#get_follow_detail" do
    it "returns default when guest_user_id is nil" do
      result = adapter.get_follow_detail(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq({ is_following: false, followed_at: nil })
    end

    it "returns is_following true with followed_at when approved" do
      followed_at = Time.now
      row = double("FollowRow", status: "approved", created_at: followed_at)
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(row)

      result = adapter.get_follow_detail(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq({ is_following: true, followed_at: followed_at })
    end

    it "returns default when status is pending" do
      row = double("FollowRow", status: "pending", created_at: Time.now)
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(row)

      result = adapter.get_follow_detail(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq({ is_following: false, followed_at: nil })
    end

    it "returns default when no row exists" do
      allow(follow_repo).to receive(:find)
        .with(follower_id: "guest-123", followee_id: "cast-456")
        .and_return(nil)

      result = adapter.get_follow_detail(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq({ is_following: false, followed_at: nil })
    end
  end

  describe "#approve_all_pending" do
    it "delegates to follow_repo.approve_all_pending with account_id" do
      expect(follow_repo).to receive(:approve_all_pending)
        .with(account_id: "cast-123")

      adapter.approve_all_pending(cast_user_id: "cast-123")
    end
  end
end
