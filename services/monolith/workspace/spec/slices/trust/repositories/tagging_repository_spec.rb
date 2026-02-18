# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Trust::Repositories::TaggingRepository", type: :database do
  let(:repo) { Hanami.app.slices[:trust]["repositories.tagging_repository"] }
  let(:tag_repo) { Hanami.app.slices[:trust]["repositories.tag_repository"] }
  let(:tagger_id) { SecureRandom.uuid }
  let(:target_id) { SecureRandom.uuid }
  let(:tag) { tag_repo.create(identity_id: tagger_id, name: "test-tag") }

  describe "#add" do
    it "creates an approved tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(result[:success]).to be true
      expect(result[:status]).to eq("approved")
    end

    it "creates a pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      expect(result[:success]).to be true
      expect(result[:status]).to eq("pending")
    end

    it "returns error for duplicate tagging" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(result[:success]).to be false
      expect(result[:error]).to eq(:already_exists)
    end
  end

  describe "#remove" do
    it "removes a tagging by id and tagger" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(repo.remove(id: result[:id], tagger_id: tagger_id)).to be true
    end

    it "does not remove another tagger's tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(repo.remove(id: result[:id], tagger_id: SecureRandom.uuid)).to be false
    end
  end

  describe "#list_by_target" do
    it "returns approved taggings for a target" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      taggings = repo.list_by_target(target_id: target_id)
      expect(taggings.size).to eq(1)
    end

    it "does not return pending taggings" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      taggings = repo.list_by_target(target_id: target_id)
      expect(taggings.size).to eq(0)
    end
  end

  describe "#approve" do
    it "approves a pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      expect(repo.approve(id: result[:id])).to be true
    end

    it "returns false for non-pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      expect(repo.approve(id: result[:id])).to be false
    end
  end

  describe "#reject" do
    it "rejects a pending tagging" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      expect(repo.reject(id: result[:id])).to be true
    end
  end

  describe "#list_pending_by_target" do
    it "returns pending taggings for a target" do
      repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "pending")
      result = repo.list_pending_by_target(target_id: target_id, limit: 20)
      expect(result[:taggings].size).to eq(1)
    end
  end

  describe "#find_by_id" do
    it "returns a tagging by id" do
      result = repo.add(tag_id: tag[:id], tagger_id: tagger_id, target_id: target_id, status: "approved")
      found = repo.find_by_id(id: result[:id])
      expect(found).not_to be_nil
    end
  end
end
