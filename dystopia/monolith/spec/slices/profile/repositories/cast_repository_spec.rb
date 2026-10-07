# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::CastRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }

  describe "#find_by_profile_id" do
    it "returns nil when the cast row does not exist" do
      expect(repo.find_by_profile_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns the cast row when it exists" do
      profile_id = SecureRandom.uuid_v7
      repo.create(profile_id: profile_id)

      expect(repo.find_by_profile_id(profile_id).profile_id).to eq(profile_id)
    end
  end

  describe "#upsert" do
    it "creates a cast row when one does not exist" do
      profile_id = SecureRandom.uuid_v7

      repo.upsert(profile_id: profile_id, attrs: { age: 24, industry: "fuzoku" })

      cast = repo.find_by_profile_id(profile_id)
      expect(cast.age).to eq(24)
      expect(cast.industry).to eq("fuzoku")
    end

    it "updates the existing cast row instead of creating a second one" do
      profile_id = SecureRandom.uuid_v7
      repo.create(profile_id: profile_id)

      repo.upsert(profile_id: profile_id, attrs: { age: 30 })

      expect(repo.find_by_profile_id(profile_id).age).to eq(30)
    end
  end

  describe "#delete_by_profile_ids" do
    it "deletes only the given cast rows" do
      kept = SecureRandom.uuid_v7
      removed = SecureRandom.uuid_v7
      repo.create(profile_id: kept)
      repo.create(profile_id: removed)

      repo.delete_by_profile_ids([removed])

      expect(repo.find_by_profile_id(removed)).to be_nil
      expect(repo.find_by_profile_id(kept)).not_to be_nil
    end

    it "does nothing for an empty list" do
      expect { repo.delete_by_profile_ids([]) }.not_to raise_error
    end
  end
end
