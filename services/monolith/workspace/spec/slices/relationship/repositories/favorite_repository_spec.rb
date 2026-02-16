# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Relationship::Repositories::FavoriteRepository", type: :database do
  let(:repo) { Hanami.app.slices[:relationship]["repositories.favorite_repository"] }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }

  describe "#add_favorite" do
    it "adds a favorite" do
      result = repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be true
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be true
    end

    it "returns false when already favorited" do
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      result = repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be false
    end
  end

  describe "#remove_favorite" do
    it "removes a favorite" do
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      result = repo.remove_favorite(cast_id: cast_id, guest_id: guest_id)

      expect(result).to be true
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be false
    end

    it "returns false when not favorited" do
      result = repo.remove_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be false
    end
  end

  describe "#favorite?" do
    it "returns false when not favorited" do
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be false
    end

    it "returns true when favorited" do
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be true
    end
  end

  describe "#list_favorites" do
    it "returns favorited cast IDs" do
      cast_id2 = SecureRandom.uuid
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      repo.add_favorite(cast_id: cast_id2, guest_id: guest_id)

      result = repo.list_favorites(guest_id: guest_id, limit: 10)
      expect(result[:cast_ids]).to contain_exactly(cast_id, cast_id2)
    end

    it "respects limit and returns has_more flag" do
      3.times { repo.add_favorite(cast_id: SecureRandom.uuid, guest_id: guest_id) }

      result = repo.list_favorites(guest_id: guest_id, limit: 2)
      expect(result[:cast_ids].size).to eq(2)
      expect(result[:has_more]).to be true
    end
  end

  describe "#favorite_cast_ids" do
    it "returns all favorited cast IDs" do
      cast_id2 = SecureRandom.uuid
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      repo.add_favorite(cast_id: cast_id2, guest_id: guest_id)

      ids = repo.favorite_cast_ids(guest_id: guest_id)
      expect(ids).to contain_exactly(cast_id, cast_id2)
    end
  end

  describe "#favorite_status_batch" do
    it "returns favorite status for multiple casts" do
      cast_id2 = SecureRandom.uuid
      cast_id3 = SecureRandom.uuid
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)

      status = repo.favorite_status_batch(cast_ids: [cast_id, cast_id2, cast_id3], guest_id: guest_id)
      expect(status[cast_id]).to be true
      expect(status[cast_id2]).to be false
      expect(status[cast_id3]).to be false
    end

    it "returns empty hash for empty input" do
      expect(repo.favorite_status_batch(cast_ids: [], guest_id: guest_id)).to eq({})
    end
  end
end
