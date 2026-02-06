# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Follows::ListFollowing do
  let(:use_case) { described_class.new(follow_repo: follow_repo) }
  let(:follow_repo) { double(:follow_repo) }

  let(:guest_id) { "guest-1" }

  describe "#call" do
    it "returns followed casts with pagination" do
      allow(follow_repo).to receive(:list_following)
        .with(guest_id: guest_id, limit: 100, cursor: nil)
        .and_return({ cast_ids: %w[cast-1 cast-2 cast-3], has_more: false })

      result = use_case.call(guest_id: guest_id)

      expect(result[:cast_ids]).to eq(%w[cast-1 cast-2 cast-3])
      expect(result[:has_more]).to be false
    end

    it "sets has_more when results exceed limit" do
      allow(follow_repo).to receive(:list_following)
        .with(guest_id: guest_id, limit: 2, cursor: nil)
        .and_return({ cast_ids: %w[cast-1 cast-2], has_more: true })

      result = use_case.call(guest_id: guest_id, limit: 2)

      expect(result[:cast_ids].size).to eq(2)
      expect(result[:has_more]).to be true
    end

    it "returns empty list when not following anyone" do
      allow(follow_repo).to receive(:list_following)
        .with(guest_id: guest_id, limit: 100, cursor: nil)
        .and_return({ cast_ids: [], has_more: false })

      result = use_case.call(guest_id: guest_id)

      expect(result[:cast_ids]).to eq([])
      expect(result[:has_more]).to be false
    end
  end
end
