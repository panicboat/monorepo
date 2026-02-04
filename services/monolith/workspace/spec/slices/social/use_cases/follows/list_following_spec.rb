# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Follows::ListFollowing do
  let(:use_case) { described_class.new(follow_repo: follow_repo) }
  let(:follow_repo) { double(:follow_repo) }

  let(:guest_id) { "guest-1" }

  let(:follow1) { double(:follow, cast_id: "cast-1", created_at: Time.parse("2026-01-01T10:00:00Z")) }
  let(:follow2) { double(:follow, cast_id: "cast-2", created_at: Time.parse("2026-01-01T09:00:00Z")) }
  let(:follow3) { double(:follow, cast_id: "cast-3", created_at: Time.parse("2026-01-01T08:00:00Z")) }

  describe "#call" do
    it "returns followed casts with pagination" do
      allow(follow_repo).to receive(:list_following)
        .with(guest_id: guest_id, limit: 100, cursor: nil)
        .and_return([follow1, follow2, follow3])

      result = use_case.call(guest_id: guest_id)

      expect(result[:cast_ids]).to eq(%w[cast-1 cast-2 cast-3])
      expect(result[:has_more]).to be false
    end

    it "sets has_more when results exceed limit" do
      allow(follow_repo).to receive(:list_following)
        .with(guest_id: guest_id, limit: 2, cursor: nil)
        .and_return([follow1, follow2, follow3])

      result = use_case.call(guest_id: guest_id, limit: 2)

      expect(result[:cast_ids].size).to eq(2)
      expect(result[:has_more]).to be true
      expect(result[:next_cursor]).not_to be_nil
    end

    it "returns empty list when not following anyone" do
      allow(follow_repo).to receive(:list_following)
        .with(guest_id: guest_id, limit: 100, cursor: nil)
        .and_return([])

      result = use_case.call(guest_id: guest_id)

      expect(result[:cast_ids]).to eq([])
      expect(result[:has_more]).to be false
    end
  end
end
