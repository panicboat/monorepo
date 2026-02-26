# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Portfolio::Repositories::CastRepository", type: :database do
  let(:repo) { Hanami.app.slices[:portfolio]["repositories.cast_repository"] }
  let(:user_id) { SecureRandom.uuid }
  let(:cast) { repo.find_by_user_id(user_id) }

  before do
    # Cleanup before each test if needed
  end

  describe "#find_by_user_id_with_plans" do
    it "returns nil when cast does not exist" do
      expect(repo.find_by_user_id_with_plans(SecureRandom.uuid)).to be_nil
    end

    it "returns cast with plans when exists" do
      # Setup data
      uid = SecureRandom.uuid
      cast_data = { user_id: uid, name: "Found", visibility: "public" }
      repo.create(cast_data)

      result = repo.find_by_user_id_with_plans(uid)
      expect(result).not_to be_nil
      expect(result.name).to eq("Found")
    end
  end

  # Note: save_plans and save_schedules methods moved to Offer slice.
  # See spec/slices/offer/repositories/offer_repository_spec.rb for those tests.

  describe "#is_online?" do
    let!(:cast_with_schedule) do
      repo.create(user_id: SecureRandom.uuid, name: "Online Cast", visibility: "public")
    end

    let!(:cast_without_schedule) do
      repo.create(user_id: SecureRandom.uuid, name: "Offline Cast", visibility: "public")
    end

    before do
      schedule_repo = Hanami.app.slices[:offer]["relations.schedules"]
      # Use fixed time range that works regardless of current time (00:00 - 23:59)
      schedule_repo.changeset(:create, {
        cast_user_id: cast_with_schedule.user_id,
        date: Date.today,
        start_time: "00:00",
        end_time: "23:59"
      }).commit
    end

    it "returns true for cast with schedule within current time" do
      expect(repo.is_online?(cast_with_schedule.user_id)).to be true
    end

    it "returns false for cast without schedule" do
      expect(repo.is_online?(cast_without_schedule.user_id)).to be false
    end
  end

  describe "#online_cast_ids" do
    let!(:online_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Online", visibility: "public")
    end

    let!(:offline_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Offline", visibility: "public")
    end

    before do
      schedule_repo = Hanami.app.slices[:offer]["relations.schedules"]
      # Use fixed time range that works regardless of current time (00:00 - 23:59)
      schedule_repo.changeset(:create, {
        cast_user_id: online_cast.user_id,
        date: Date.today,
        start_time: "00:00",
        end_time: "23:59"
      }).commit
    end

    it "returns array of online cast IDs" do
      result = repo.online_cast_ids
      expect(result).to include(online_cast.user_id)
      expect(result).not_to include(offline_cast.user_id)
    end
  end

  describe "#list_casts_with_filters" do
    let!(:public_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "PublicCast", visibility: "public", registered_at: Time.now)
    end

    let!(:private_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "PrivateCast", visibility: "private", registered_at: Time.now)
    end

    let!(:unregistered_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Unregistered", visibility: "public", registered_at: nil)
    end

    it "filters by visibility" do
      result = repo.list_casts_with_filters(visibility_filter: "public")
      names = result.map(&:name)
      expect(names).to include("PublicCast")
      expect(names).not_to include("PrivateCast")
    end

    it "returns empty array when no casts match filters" do
      result = repo.list_casts_with_filters(visibility_filter: "nonexistent")
      expect(result).to eq([])
    end

    it "applies limit" do
      5.times do |i|
        repo.create(user_id: SecureRandom.uuid, name: "Cast#{i}", visibility: "public", registered_at: Time.now)
      end

      result = repo.list_casts_with_filters(visibility_filter: "public", limit: 2)
      expect(result.size).to eq(3) # limit + 1 for has_more check
    end

    it "filters by registered_only" do
      result = repo.list_casts_with_filters(registered_only: true)
      names = result.map(&:name)
      expect(names).to include("PublicCast", "PrivateCast")
      expect(names).not_to include("Unregistered")
    end

    context "with status filter :online" do
      let!(:online_cast) do
        repo.create(user_id: SecureRandom.uuid, name: "OnlineNow", visibility: "public", registered_at: Time.now)
      end

      before do
        schedule_repo = Hanami.app.slices[:offer]["relations.schedules"]
        # Use fixed time range that works regardless of current time (00:00 - 23:59)
        schedule_repo.changeset(:create, {
          cast_user_id: online_cast.user_id,
          date: Date.today,
          start_time: "00:00",
          end_time: "23:59"
        }).commit
      end

      it "returns only casts with active schedule" do
        result = repo.list_casts_with_filters(status_filter: :online)
        names = result.map(&:name)
        expect(names).to include("OnlineNow")
      end
    end

    context "with status filter :new" do
      let!(:new_cast) do
        repo.create(user_id: SecureRandom.uuid, name: "NewCast", visibility: "public", registered_at: Time.now)
      end

      it "returns casts created within 7 days" do
        result = repo.list_casts_with_filters(status_filter: :new)
        names = result.map(&:name)
        expect(names).to include("NewCast")
      end
    end

    context "with text search query" do
      let!(:cast_with_name) do
        repo.create(user_id: SecureRandom.uuid, name: "かわいいキャスト", visibility: "public", registered_at: Time.now, tagline: "test")
      end

      let!(:cast_with_tagline) do
        repo.create(user_id: SecureRandom.uuid, name: "Normal", visibility: "public", registered_at: Time.now, tagline: "清楚系美少女")
      end

      let!(:cast_with_tag) do
        repo.create(
          user_id: SecureRandom.uuid,
          name: "Another",

          visibility: "public",
          registered_at: Time.now,
          tags: Sequel.pg_jsonb(["元アイドル", "美人"])
        )
      end

      let!(:unmatched_cast) do
        repo.create(user_id: SecureRandom.uuid, name: "Unmatched", visibility: "public", registered_at: Time.now, tagline: "other")
      end

      it "finds casts by name (case insensitive)" do
        result = repo.list_casts_with_filters(query: "かわいい")
        names = result.map(&:name)
        expect(names).to include("かわいいキャスト")
        expect(names).not_to include("Normal")
      end

      it "finds casts by tagline" do
        result = repo.list_casts_with_filters(query: "清楚系")
        names = result.map(&:name)
        expect(names).to include("Normal")
      end

      it "finds casts by tag" do
        result = repo.list_casts_with_filters(query: "元アイドル")
        names = result.map(&:name)
        expect(names).to include("Another")
      end

      it "returns empty when no matches" do
        result = repo.list_casts_with_filters(query: "存在しない検索語")
        expect(result).to be_empty
      end

      it "ignores empty or whitespace query" do
        result = repo.list_casts_with_filters(query: "   ")
        expect(result.size).to be >= 4
      end
    end
  end

  describe "#get_popular_tags" do
    it "returns tags sorted by usage count" do
      # Create casts with tags (registered = has registered_at)
      repo.create(
        user_id: SecureRandom.uuid,
        name: "TaggedCast1",

        visibility: "public",
        registered_at: Time.now,
        tags: Sequel.pg_jsonb(["tag1", "tag2"])
      )
      repo.create(
        user_id: SecureRandom.uuid,
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
        user_id: SecureRandom.uuid,
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
        user_id: SecureRandom.uuid,
        name: "Registered",

        visibility: "public",
        registered_at: Time.now,
        tags: Sequel.pg_jsonb(["visible"])
      )
      repo.create(
        user_id: SecureRandom.uuid,
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
