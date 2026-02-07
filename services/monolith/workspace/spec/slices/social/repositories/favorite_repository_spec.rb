# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::Repositories::FavoriteRepository", type: :database do
  let(:repo) { Hanami.app.slices[:social]["repositories.favorite_repository"] }
  let(:cast_id) { SecureRandom.uuid }
  let(:guest_id) { SecureRandom.uuid }

  describe "#add_favorite" do
    it "creates a favorite record" do
      result = repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be true
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be true
    end

    it "returns false when favorite already exists" do
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      result = repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be false
    end

    it "is idempotent - does not create duplicate favorites" do
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)

      cast_ids = repo.favorite_cast_ids(guest_id: guest_id)
      expect(cast_ids.count(cast_id)).to eq(1)
    end
  end

  describe "#remove_favorite" do
    it "removes the favorite record and returns true" do
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      result = repo.remove_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be true
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be false
    end

    it "returns false when favorite does not exist" do
      result = repo.remove_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(result).to be false
    end
  end

  describe "#favorite?" do
    it "returns true when guest has favorited the cast" do
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be true
    end

    it "returns false when guest has not favorited the cast" do
      expect(repo.favorite?(cast_id: cast_id, guest_id: guest_id)).to be false
    end
  end

  describe "#list_favorites" do
    it "returns the list of favorited cast IDs with pagination" do
      cast_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      cast_ids.each { |cid| repo.add_favorite(cast_id: cid, guest_id: guest_id) }

      result = repo.list_favorites(guest_id: guest_id, limit: 10)
      expect(result[:cast_ids].size).to eq(3)
      expect(result[:cast_ids]).to match_array(cast_ids)
      expect(result[:has_more]).to be false
    end

    it "respects limit and returns has_more flag" do
      cast_ids = [SecureRandom.uuid, SecureRandom.uuid, SecureRandom.uuid]
      cast_ids.each { |cid| repo.add_favorite(cast_id: cid, guest_id: guest_id) }

      result = repo.list_favorites(guest_id: guest_id, limit: 2)
      expect(result[:cast_ids].size).to eq(2)
      expect(result[:has_more]).to be true
    end

    it "returns empty list when no favorites" do
      result = repo.list_favorites(guest_id: guest_id, limit: 10)
      expect(result[:cast_ids]).to eq([])
      expect(result[:has_more]).to be false
    end
  end

  describe "#favorite_cast_ids" do
    it "returns all favorited cast IDs" do
      cast_ids = [SecureRandom.uuid, SecureRandom.uuid]
      cast_ids.each { |cid| repo.add_favorite(cast_id: cid, guest_id: guest_id) }

      result = repo.favorite_cast_ids(guest_id: guest_id)
      expect(result).to match_array(cast_ids)
    end

    it "returns empty array when no favorites" do
      expect(repo.favorite_cast_ids(guest_id: guest_id)).to eq([])
    end
  end

  describe "#favorite_status_batch" do
    it "returns favorite status for multiple casts" do
      cast_id2 = SecureRandom.uuid
      repo.add_favorite(cast_id: cast_id, guest_id: guest_id)

      status = repo.favorite_status_batch(cast_ids: [cast_id, cast_id2], guest_id: guest_id)
      expect(status[cast_id]).to be true
      expect(status[cast_id2]).to be false
    end

    it "returns empty hash for empty cast_ids" do
      expect(repo.favorite_status_batch(cast_ids: [], guest_id: guest_id)).to eq({})
    end

    it "returns empty hash for nil guest_id" do
      expect(repo.favorite_status_batch(cast_ids: [cast_id], guest_id: nil)).to eq({})
    end
  end
end
