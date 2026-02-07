# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Blocks::UnblockUser do
  let(:use_case) { described_class.new(block_repo: block_repo) }
  let(:block_repo) { double(:block_repo) }

  let(:blocker_id) { "guest-1" }
  let(:blocked_id) { "cast-1" }

  describe "#call" do
    it "unblocks a user and returns success" do
      allow(block_repo).to receive(:unblock).with(
        blocker_id: blocker_id,
        blocked_id: blocked_id
      )

      result = use_case.call(blocker_id: blocker_id, blocked_id: blocked_id)

      expect(result[:success]).to be true
    end
  end
end
