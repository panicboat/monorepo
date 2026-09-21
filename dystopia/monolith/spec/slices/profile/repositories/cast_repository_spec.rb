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
      repo.create(user_id: user_id, visibility: "public")

      expect(repo.find_by_user_id(user_id).user_id).to eq(user_id)
    end
  end

  describe "#save_visibility" do
    it "updates the visibility column" do
      user_id = SecureRandom.uuid_v7
      repo.create(user_id: user_id, visibility: "offline")

      repo.save_visibility(user_id, "public")

      expect(repo.find_by_user_id(user_id).visibility).to eq("public")
    end
  end

  describe "#public_cast_ids" do
    it "returns only user_ids with visibility public" do
      public_id = SecureRandom.uuid_v7
      private_id = SecureRandom.uuid_v7
      repo.create(user_id: public_id, visibility: "public")
      repo.create(user_id: private_id, visibility: "private")

      expect(repo.public_cast_ids).to include(public_id)
      expect(repo.public_cast_ids).not_to include(private_id)
    end
  end
end
