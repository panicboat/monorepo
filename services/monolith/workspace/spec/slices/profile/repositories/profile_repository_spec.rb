# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::ProfileRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:account_id) { SecureRandom.uuid_v7 }

  describe "#find_by_account_id" do
    it "returns nil when the profile does not exist" do
      expect(repo.find_by_account_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns the profile after create" do
      repo.create(account_id: account_id, display_name: "Coco", username: "coco")
      result = repo.find_by_account_id(account_id)
      expect(result).not_to be_nil
      expect(result.display_name).to eq("Coco")
      expect(result.username).to eq("coco")
    end
  end

  describe "#find_by_username" do
    it "matches case-insensitively" do
      repo.create(account_id: account_id, display_name: "Coco", username: "Coco")
      expect(repo.find_by_username("coco")).not_to be_nil
      expect(repo.find_by_username("COCO").account_id).to eq(account_id)
    end

    it "returns nil for blank input" do
      expect(repo.find_by_username("")).to be_nil
    end
  end

  describe "#username_available?" do
    before { repo.create(account_id: account_id, display_name: "Coco", username: "coco") }

    it "is false when taken (case-insensitive)" do
      expect(repo.username_available?("COCO")).to be false
    end

    it "is true when free" do
      expect(repo.username_available?("freename")).to be true
    end

    it "excludes the owner so they can keep their own username" do
      expect(repo.username_available?("coco", exclude_account_id: account_id)).to be true
    end
  end

  describe "#upsert" do
    it "creates then updates the same row" do
      repo.upsert(account_id: account_id, attrs: { display_name: "First", username: "first" })
      repo.upsert(account_id: account_id, attrs: { display_name: "Second" })
      result = repo.find_by_account_id(account_id)
      expect(result.display_name).to eq("Second")
      expect(result.username).to eq("first")
    end
  end

  describe "#save_areas / #find_area_ids" do
    let(:area_a) { SecureRandom.uuid_v7 }
    let(:area_b) { SecureRandom.uuid_v7 }

    before do
      repo.create(account_id: account_id, display_name: "Coco")
      areas = Hanami.app.slices[:profile]["relations.areas"]
      [area_a, area_b].each_with_index do |id, i|
        areas.changeset(:create, id: id, prefecture: "東京都", name: "エリア#{i}", code: "tokyo-#{i}").commit
      end
    end

    it "replaces the area set" do
      repo.save_areas(account_id: account_id, area_ids: [area_a, area_b])
      expect(repo.find_area_ids(account_id)).to contain_exactly(area_a, area_b)

      repo.save_areas(account_id: account_id, area_ids: [area_a])
      expect(repo.find_area_ids(account_id)).to contain_exactly(area_a)
    end
  end

  describe "#save_media" do
    let(:avatar) { SecureRandom.uuid_v7 }
    let(:cover) { SecureRandom.uuid_v7 }

    before { repo.create(account_id: account_id, display_name: "Coco") }

    it "updates avatar and cover media ids" do
      repo.save_media(account_id: account_id, avatar_media_id: avatar, cover_media_id: cover)
      result = repo.find_by_account_id(account_id)
      expect(result.avatar_media_id).to eq(avatar)
      expect(result.cover_media_id).to eq(cover)
    end
  end
end
