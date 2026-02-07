# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Favorites::ListFavorites do
  let(:use_case) { described_class.new(favorite_repo: favorite_repo) }
  let(:favorite_repo) { double(:favorite_repo) }

  let(:guest_id) { "guest-1" }

  describe "#call" do
    it "returns list of favorited cast IDs" do
      cast_ids = %w[cast-1 cast-2 cast-3]
      allow(favorite_repo).to receive(:list_favorites)
        .with(guest_id: guest_id, limit: 100, cursor: nil)
        .and_return({ cast_ids: cast_ids, has_more: false })

      result = use_case.call(guest_id: guest_id)

      expect(result[:cast_ids]).to eq(cast_ids)
      expect(result[:has_more]).to be false
    end

    it "respects limit parameter" do
      allow(favorite_repo).to receive(:list_favorites)
        .with(guest_id: guest_id, limit: 50, cursor: nil)
        .and_return({ cast_ids: %w[cast-1 cast-2], has_more: true })

      result = use_case.call(guest_id: guest_id, limit: 50)

      expect(result[:cast_ids].size).to eq(2)
      expect(result[:has_more]).to be true
    end

    it "clamps limit to valid range" do
      allow(favorite_repo).to receive(:list_favorites)
        .with(guest_id: guest_id, limit: 200, cursor: nil)
        .and_return({ cast_ids: [], has_more: false })

      result = use_case.call(guest_id: guest_id, limit: 500)

      expect(result[:cast_ids]).to eq([])
    end

    it "returns empty list when no favorites" do
      allow(favorite_repo).to receive(:list_favorites)
        .with(guest_id: guest_id, limit: 100, cursor: nil)
        .and_return({ cast_ids: [], has_more: false })

      result = use_case.call(guest_id: guest_id)

      expect(result[:cast_ids]).to eq([])
      expect(result[:has_more]).to be false
    end
  end
end
