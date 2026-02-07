# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Blocks::GetBlockStatus do
  let(:use_case) { described_class.new(block_repo: block_repo) }
  let(:block_repo) { double(:block_repo) }

  let(:blocker_id) { "guest-1" }
  let(:user_ids) { %w[cast-1 cast-2] }

  describe "#call" do
    it "returns block status for specified user IDs" do
      expected_status = { "cast-1" => true, "cast-2" => false }
      allow(block_repo).to receive(:block_status_batch)
        .with(user_ids: user_ids, blocker_id: blocker_id)
        .and_return(expected_status)

      result = use_case.call(user_ids: user_ids, blocker_id: blocker_id)

      expect(result).to eq(expected_status)
    end
  end
end
