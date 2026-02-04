# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Follows::GetFollowStatus do
  let(:use_case) { described_class.new(follow_repo: follow_repo) }
  let(:follow_repo) { double(:follow_repo) }

  let(:guest_id) { "guest-1" }
  let(:cast_ids) { %w[cast-1 cast-2 cast-3] }

  describe "#call" do
    it "returns follow status for multiple casts" do
      allow(follow_repo).to receive(:following_status_batch)
        .with(cast_ids: cast_ids, guest_id: guest_id)
        .and_return({ "cast-1" => true, "cast-2" => false, "cast-3" => true })

      result = use_case.call(cast_ids: cast_ids, guest_id: guest_id)

      expect(result["cast-1"]).to be true
      expect(result["cast-2"]).to be false
      expect(result["cast-3"]).to be true
    end

    it "returns empty hash for empty cast_ids" do
      allow(follow_repo).to receive(:following_status_batch)
        .with(cast_ids: [], guest_id: guest_id)
        .and_return({})

      result = use_case.call(cast_ids: [], guest_id: guest_id)

      expect(result).to eq({})
    end
  end
end
