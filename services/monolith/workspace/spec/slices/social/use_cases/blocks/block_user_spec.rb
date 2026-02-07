# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Blocks::BlockUser do
  let(:use_case) { described_class.new(block_repo: block_repo) }
  let(:block_repo) { double(:block_repo) }

  let(:blocker_id) { "guest-1" }
  let(:blocker_type) { "guest" }
  let(:blocked_id) { "cast-1" }
  let(:blocked_type) { "cast" }

  describe "#call" do
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
  end
end
