# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::CastRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }
  let(:user_id) { SecureRandom.uuid_v7 }
  let(:cast) { repo.find_by_user_id(user_id) }

  before do
    # Cleanup before each test if needed
  end

  describe "#find_by_user_id_with_plans" do
    it "returns nil when cast does not exist" do
      expect(repo.find_by_user_id_with_plans(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns cast with plans when exists" do
      # Setup data
      uid = SecureRandom.uuid_v7
      cast_data = { user_id: uid, name: "Found", visibility: "public" }
      repo.create(cast_data)

      result = repo.find_by_user_id_with_plans(uid)
      expect(result).not_to be_nil
      expect(result.name).to eq("Found")
    end
  end

  # Note: save_plans and save_schedules methods were removed in 2026-05-29 commerce dimension drop.

  describe "#get_popular_tags" do
    it "returns tags sorted by usage count" do
      # Create casts with tags (registered = has registered_at)
      repo.create(
        user_id: SecureRandom.uuid_v7,
        name: "TaggedCast1",

        visibility: "public",
        registered_at: Time.now,
        tags: Sequel.pg_jsonb(["tag1", "tag2"])
      )
      repo.create(
        user_id: SecureRandom.uuid_v7,
        name: "TaggedCast2",

        visibility: "public",
        registered_at: Time.now,
        tags: Sequel.pg_jsonb(["tag1", "tag3"])
      )

      result = repo.get_popular_tags(limit: 10)
      tag_names = result.map { |t| t[:name] }

      # tag1 appears in both casts, so it should have count 2
      expect(tag_names).to include("tag1")
      tag1 = result.find { |t| t[:name] == "tag1" }
      expect(tag1[:usage_count]).to eq(2)
    end

    it "respects limit parameter" do
      repo.create(
        user_id: SecureRandom.uuid_v7,
        name: "TaggedCast",

        visibility: "public",
        registered_at: Time.now,
        tags: Sequel.pg_jsonb(["a", "b", "c"])
      )

      result = repo.get_popular_tags(limit: 1)
      expect(result.size).to eq(1)
    end

    it "only counts registered casts" do
      repo.create(
        user_id: SecureRandom.uuid_v7,
        name: "Registered",

        visibility: "public",
        registered_at: Time.now,
        tags: Sequel.pg_jsonb(["visible"])
      )
      repo.create(
        user_id: SecureRandom.uuid_v7,
        name: "Unregistered",

        visibility: "public",
        registered_at: nil,
        tags: Sequel.pg_jsonb(["hidden"])
      )

      result = repo.get_popular_tags(limit: 10)
      tag_names = result.map { |t| t[:name] }

      expect(tag_names).to include("visible")
      expect(tag_names).not_to include("hidden")
    end
  end
end
