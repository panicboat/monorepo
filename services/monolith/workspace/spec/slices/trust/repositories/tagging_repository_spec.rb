# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Trust::Repositories::TaggingRepository", type: :database do
  let(:repo) { Hanami.app.slices[:trust]["repositories.tagging_repository"] }
  let(:tagger_id) { SecureRandom.uuid }
  let(:target_id) { SecureRandom.uuid }

  describe "#add" do
    it "creates an approved tagging" do
      result = repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      expect(result[:success]).to be true
      expect(result[:id]).to be_a(String)
    end

    it "returns error for duplicate tagging" do
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      result = repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      expect(result[:success]).to be false
      expect(result[:error]).to eq(:already_exists)
    end

    it "allows same tag name from different taggers" do
      other_tagger = SecureRandom.uuid
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      result = repo.add(tag_name: "VIP", tagger_id: other_tagger, target_id: target_id)
      expect(result[:success]).to be true
    end

    it "allows same tag name for different targets" do
      other_target = SecureRandom.uuid
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      result = repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: other_target)
      expect(result[:success]).to be true
    end
  end

  describe "#remove" do
    it "removes a tagging by id and tagger" do
      result = repo.add(tag_name: "temp", tagger_id: tagger_id, target_id: target_id)
      expect(repo.remove(id: result[:id], tagger_id: tagger_id)).to be true
    end

    it "does not remove another tagger's tagging" do
      result = repo.add(tag_name: "temp", tagger_id: tagger_id, target_id: target_id)
      expect(repo.remove(id: result[:id], tagger_id: SecureRandom.uuid)).to be false
    end
  end

  describe "#list_by_target" do
    it "returns approved taggings for a target" do
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      taggings = repo.list_by_target(target_id: target_id)
      expect(taggings.size).to eq(1)
      expect(taggings.first.tag_name).to eq("VIP")
    end

    it "returns taggings from multiple taggers" do
      other_tagger = SecureRandom.uuid
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      repo.add(tag_name: "Regular", tagger_id: other_tagger, target_id: target_id)
      taggings = repo.list_by_target(target_id: target_id)
      expect(taggings.size).to eq(2)
    end
  end

  describe "#list_tagger_tag_names" do
    it "returns distinct tag names used by a tagger" do
      target2 = SecureRandom.uuid
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      repo.add(tag_name: "Regular", tagger_id: tagger_id, target_id: target_id)
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target2)

      names = repo.list_tagger_tag_names(tagger_id: tagger_id)
      expect(names).to eq(["Regular", "VIP"])
    end

    it "does not return other tagger's tag names" do
      other_tagger = SecureRandom.uuid
      repo.add(tag_name: "VIP", tagger_id: tagger_id, target_id: target_id)
      repo.add(tag_name: "Secret", tagger_id: other_tagger, target_id: target_id)

      names = repo.list_tagger_tag_names(tagger_id: tagger_id)
      expect(names).to eq(["VIP"])
    end
  end

  describe "#find_by_id" do
    it "returns a tagging by id" do
      result = repo.add(tag_name: "findme", tagger_id: tagger_id, target_id: target_id)
      found = repo.find_by_id(id: result[:id])
      expect(found).not_to be_nil
      expect(found.tag_name).to eq("findme")
    end
  end
end
