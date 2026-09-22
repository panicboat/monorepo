# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::CastRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }

  describe "#find_by_user_id" do
    it "returns nil when the cast does not exist" do
      expect(repo.find_by_user_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns the cast row when it exists" do
      user_id = SecureRandom.uuid_v7
      repo.create(user_id: user_id)

      expect(repo.find_by_user_id(user_id).user_id).to eq(user_id)
    end
  end

  describe "#upsert" do
    it "creates a cast row when one does not exist" do
      user_id = SecureRandom.uuid_v7

      repo.upsert(user_id: user_id, attrs: { age: 24, industry: "fuzoku" })

      cast = repo.find_by_user_id(user_id)
      expect(cast.age).to eq(24)
      expect(cast.industry).to eq("fuzoku")
    end

    it "updates the existing cast row instead of creating a second one" do
      user_id = SecureRandom.uuid_v7
      repo.create(user_id: user_id)

      repo.upsert(user_id: user_id, attrs: { age: 30 })

      expect(repo.find_by_user_id(user_id).age).to eq(30)
    end
  end
end
