# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Follows::FollowCast do
  let(:use_case) { described_class.new(follow_repo: follow_repo, block_repo: block_repo) }
  let(:follow_repo) { double(:follow_repo) }
  let(:block_repo) { double(:block_repo) }

  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }

  before do
    allow(block_repo).to receive(:blocked?)
      .with(blocker_id: cast_id, blocked_id: guest_id)
      .and_return(false)
  end

  describe "#call" do
    context "when cast is public" do
      it "follows a cast with approved status" do
        allow(follow_repo).to receive(:follow)
          .with(cast_id: cast_id, guest_id: guest_id, status: "approved")
          .and_return({ success: true, status: "approved" })

        result = use_case.call(cast_id: cast_id, guest_id: guest_id, visibility: "public")

        expect(result[:success]).to be true
        expect(result[:status]).to eq("approved")
      end
    end

    context "when cast is private" do
      it "creates a pending follow request" do
        allow(follow_repo).to receive(:follow)
          .with(cast_id: cast_id, guest_id: guest_id, status: "pending")
          .and_return({ success: true, status: "pending" })

        result = use_case.call(cast_id: cast_id, guest_id: guest_id, visibility: "private")

        expect(result[:success]).to be true
        expect(result[:status]).to eq("pending")
      end
    end

    context "when already following" do
      it "returns error with existing status" do
        allow(follow_repo).to receive(:follow)
          .with(cast_id: cast_id, guest_id: guest_id, status: "approved")
          .and_return({ success: false, reason: :already_exists, status: "approved" })

        result = use_case.call(cast_id: cast_id, guest_id: guest_id, visibility: "public")

        expect(result[:success]).to be false
        expect(result[:error]).to eq(:already_following)
        expect(result[:status]).to eq("approved")
      end
    end

    context "with default visibility" do
      it "uses public visibility by default" do
        allow(follow_repo).to receive(:follow)
          .with(cast_id: cast_id, guest_id: guest_id, status: "approved")
          .and_return({ success: true, status: "approved" })

        result = use_case.call(cast_id: cast_id, guest_id: guest_id)

        expect(result[:success]).to be true
        expect(result[:status]).to eq("approved")
      end
    end

    context "when guest is blocked by cast" do
      before do
        allow(block_repo).to receive(:blocked?)
          .with(blocker_id: cast_id, blocked_id: guest_id)
          .and_return(true)
      end

      it "returns error without creating follow" do
        expect(follow_repo).not_to receive(:follow)

        result = use_case.call(cast_id: cast_id, guest_id: guest_id, visibility: "public")

        expect(result[:success]).to be false
        expect(result[:error]).to eq(:blocked)
      end
    end
  end
end
