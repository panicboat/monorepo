# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Blocks::BlockUser do
  let(:use_case) { described_class.new(block_repo: block_repo, follow_repo: follow_repo) }
  let(:block_repo) { double(:block_repo) }
  let(:follow_repo) { double(:follow_repo) }

  describe "#call" do
    context "when guest blocks a cast" do
      let(:blocker_id) { "guest-1" }
      let(:blocker_type) { "guest" }
      let(:blocked_id) { "cast-1" }
      let(:blocked_type) { "cast" }

      it "blocks a user and returns success" do
        allow(block_repo).to receive(:block).with(
          blocker_id: blocker_id,
          blocker_type: blocker_type,
          blocked_id: blocked_id,
          blocked_type: blocked_type
        )

        result = use_case.call(
          blocker_id: blocker_id,
          blocker_type: blocker_type,
          blocked_id: blocked_id,
          blocked_type: blocked_type
        )

        expect(result[:success]).to be true
      end

      it "does not remove follow relationship" do
        allow(block_repo).to receive(:block)
        expect(follow_repo).not_to receive(:unfollow)

        use_case.call(
          blocker_id: blocker_id,
          blocker_type: blocker_type,
          blocked_id: blocked_id,
          blocked_type: blocked_type
        )
      end
    end

    context "when cast blocks a guest" do
      let(:blocker_id) { "cast-1" }
      let(:blocker_type) { "cast" }
      let(:blocked_id) { "guest-1" }
      let(:blocked_type) { "guest" }

      it "blocks a user and removes follow relationship" do
        allow(block_repo).to receive(:block).with(
          blocker_id: blocker_id,
          blocker_type: blocker_type,
          blocked_id: blocked_id,
          blocked_type: blocked_type
        )
        allow(follow_repo).to receive(:unfollow).with(
          cast_id: blocker_id,
          guest_id: blocked_id
        )

        result = use_case.call(
          blocker_id: blocker_id,
          blocker_type: blocker_type,
          blocked_id: blocked_id,
          blocked_type: blocked_type
        )

        expect(result[:success]).to be true
        expect(follow_repo).to have_received(:unfollow).with(
          cast_id: blocker_id,
          guest_id: blocked_id
        )
      end
    end
  end
end
