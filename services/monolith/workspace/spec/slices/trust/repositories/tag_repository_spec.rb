# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Trust::Repositories::TagRepository", type: :database do
  let(:repo) { Hanami.app.slices[:trust]["repositories.tag_repository"] }
  let(:identity_id) { SecureRandom.uuid }

  describe "#create" do
    it "creates a tag" do
      result = repo.create(identity_id: identity_id, name: "VIP")
      expect(result).to include(id: a_kind_of(String), name: "VIP")
    end

    it "returns error for duplicate name" do
      repo.create(identity_id: identity_id, name: "VIP")
      result = repo.create(identity_id: identity_id, name: "VIP")
      expect(result[:error]).to eq(:already_exists)
    end

    it "allows same name for different identities" do
      other_id = SecureRandom.uuid
      repo.create(identity_id: identity_id, name: "VIP")
      result = repo.create(identity_id: other_id, name: "VIP")
      expect(result).to include(name: "VIP")
      expect(result[:error]).to be_nil
    end

    it "returns error when tag limit reached" do
      50.times { |i| repo.create(identity_id: identity_id, name: "tag-#{i}") }
      result = repo.create(identity_id: identity_id, name: "one-too-many")
      expect(result[:error]).to eq(:limit_reached)
    end
  end

  describe "#list" do
    it "returns all tags for identity" do
      repo.create(identity_id: identity_id, name: "A")
      repo.create(identity_id: identity_id, name: "B")
      tags = repo.list(identity_id: identity_id)
      expect(tags.size).to eq(2)
    end

    it "does not return other identity's tags" do
      repo.create(identity_id: identity_id, name: "mine")
      repo.create(identity_id: SecureRandom.uuid, name: "theirs")
      tags = repo.list(identity_id: identity_id)
      expect(tags.size).to eq(1)
    end
  end

  describe "#delete" do
    it "deletes a tag owned by identity" do
      tag = repo.create(identity_id: identity_id, name: "temp")
      result = repo.delete(id: tag[:id], identity_id: identity_id)
      expect(result).to be true
    end

    it "does not delete another identity's tag" do
      tag = repo.create(identity_id: SecureRandom.uuid, name: "not-mine")
      result = repo.delete(id: tag[:id], identity_id: identity_id)
      expect(result).to be false
    end
  end

  describe "#find_by_id" do
    it "returns a tag by id" do
      tag = repo.create(identity_id: identity_id, name: "findme")
      found = repo.find_by_id(id: tag[:id])
      expect(found).not_to be_nil
      expect(found.name).to eq("findme")
    end
  end

  describe "#count" do
    it "returns tag count for identity" do
      3.times { |i| repo.create(identity_id: identity_id, name: "t-#{i}") }
      expect(repo.count(identity_id: identity_id)).to eq(3)
    end
  end
end
