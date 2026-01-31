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
      cast_data = { user_id: uid, name: "Found", image_path: "test", status: "offline" }
      repo.create(cast_data)

      result = repo.find_by_user_id_with_plans(uid)
      expect(result).not_to be_nil
      expect(result.name).to eq("Found")
    end
  end

  describe "#save_plans" do
    let!(:existing_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Plan Test", image_path: "p", status: "online")
    end

    it "replaces plans" do
      plans_data = [{ name: "New Plan", price: 2000, duration_minutes: 90 }]
      updated = repo.save_plans(id: existing_cast.id, plans_data: plans_data)

      expect(updated.cast_plans.size).to eq(1)
      expect(updated.cast_plans.first.name).to eq("New Plan")
    end
  end

  describe "#save_schedules" do
    let!(:existing_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Schedule Test", image_path: "s", status: "online")
    end

    it "replaces future schedules" do
      schedules_data = [{ date: Date.today, start_time: "10:00", end_time: "11:00", plan_id: nil }]
      updated = repo.save_schedules(id: existing_cast.id, schedules: schedules_data)

      expect(updated.cast_schedules.size).to eq(1)
      expect(updated.cast_schedules.first.date).to eq(Date.today)
    end

    it "preserves past schedules when saving new ones" do
      # Create a past schedule directly in the database
      past_date = Date.today - 7
      schedule_repo = Hanami.app.slices[:portfolio]["relations.cast_schedules"]
      schedule_repo.changeset(:create, {
        cast_id: existing_cast.id,
        date: past_date,
        start_time: "09:00",
        end_time: "10:00",
        plan_id: nil
      }).commit

      # Save new future schedules
      future_schedules = [{ date: Date.today + 1, start_time: "14:00", end_time: "15:00", plan_id: nil }]
      updated = repo.save_schedules(id: existing_cast.id, schedules: future_schedules)

      # Should have both past and future schedules
      expect(updated.cast_schedules.size).to eq(2)
      dates = updated.cast_schedules.map(&:date)
      expect(dates).to include(past_date)
      expect(dates).to include(Date.today + 1)
    end
  end

  describe "#is_online?" do
    let!(:cast_with_schedule) do
      repo.create(user_id: SecureRandom.uuid, name: "Online Cast", image_path: "o", status: "online")
    end

    let!(:cast_without_schedule) do
      repo.create(user_id: SecureRandom.uuid, name: "Offline Cast", image_path: "off", status: "online")
    end

    before do
      schedule_repo = Hanami.app.slices[:portfolio]["relations.cast_schedules"]
      # Create schedule for today within current time
      now = Time.now
      start_time = (now - 3600).strftime("%H:%M") # 1 hour ago
      end_time = (now + 3600).strftime("%H:%M")   # 1 hour from now
      schedule_repo.changeset(:create, {
        cast_id: cast_with_schedule.id,
        date: Date.today,
        start_time: start_time,
        end_time: end_time,
        plan_id: nil
      }).commit
    end

    it "returns true for cast with schedule within current time" do
      expect(repo.is_online?(cast_with_schedule.id)).to be true
    end

    it "returns false for cast without schedule" do
      expect(repo.is_online?(cast_without_schedule.id)).to be false
    end
  end

  describe "#online_cast_ids" do
    let!(:online_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Online", image_path: "on", status: "online")
    end

    let!(:offline_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Offline", image_path: "off", status: "online")
    end

    before do
      schedule_repo = Hanami.app.slices[:portfolio]["relations.cast_schedules"]
      now = Time.now
      start_time = (now - 3600).strftime("%H:%M")
      end_time = (now + 3600).strftime("%H:%M")
      schedule_repo.changeset(:create, {
        cast_id: online_cast.id,
        date: Date.today,
        start_time: start_time,
        end_time: end_time,
        plan_id: nil
      }).commit
    end

    it "returns array of online cast IDs" do
      result = repo.online_cast_ids
      expect(result).to include(online_cast.id)
      expect(result).not_to include(offline_cast.id)
    end
  end

  describe "#list_casts_with_filters" do
    let!(:published_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Published", image_path: "pub", visibility: "published")
    end

    let!(:unpublished_cast) do
      repo.create(user_id: SecureRandom.uuid, name: "Unpublished", image_path: "unpub", visibility: "unpublished")
    end

    it "filters by visibility" do
      result = repo.list_casts_with_filters(visibility_filter: "published")
      names = result.map(&:name)
      expect(names).to include("Published")
      expect(names).not_to include("Unpublished")
    end

    it "returns empty array when no casts match filters" do
      result = repo.list_casts_with_filters(visibility_filter: "nonexistent")
      expect(result).to eq([])
    end

    it "applies limit and offset" do
      5.times do |i|
        repo.create(user_id: SecureRandom.uuid, name: "Cast#{i}", image_path: "c#{i}", visibility: "published")
      end

      result = repo.list_casts_with_filters(visibility_filter: "published", limit: 2, offset: 1)
      expect(result.size).to eq(2)
    end

    context "with status filter :online" do
      let!(:online_cast) do
        repo.create(user_id: SecureRandom.uuid, name: "OnlineNow", image_path: "on", visibility: "published")
      end

      before do
        schedule_repo = Hanami.app.slices[:portfolio]["relations.cast_schedules"]
        now = Time.now
        start_time = (now - 3600).strftime("%H:%M")
        end_time = (now + 3600).strftime("%H:%M")
        schedule_repo.changeset(:create, {
          cast_id: online_cast.id,
          date: Date.today,
          start_time: start_time,
          end_time: end_time,
          plan_id: nil
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
        repo.create(user_id: SecureRandom.uuid, name: "NewCast", image_path: "new", visibility: "published")
      end

      it "returns casts created within 7 days" do
        result = repo.list_casts_with_filters(status_filter: :new)
        names = result.map(&:name)
        expect(names).to include("NewCast")
      end
    end
  end

  describe "#get_popular_tags" do
    it "returns tags sorted by usage count" do
      # Create casts with tags
      repo.create(
        user_id: SecureRandom.uuid,
        name: "TaggedCast1",
        image_path: "t1",
        visibility: "published",
        tags: Sequel.pg_jsonb(["tag1", "tag2"])
      )
      repo.create(
        user_id: SecureRandom.uuid,
        name: "TaggedCast2",
        image_path: "t2",
        visibility: "published",
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
        image_path: "t",
        visibility: "published",
        tags: Sequel.pg_jsonb(["a", "b", "c"])
      )

      result = repo.get_popular_tags(limit: 1)
      expect(result.size).to eq(1)
    end

    it "only counts published casts" do
      repo.create(
        user_id: SecureRandom.uuid,
        name: "Published",
        image_path: "p",
        visibility: "published",
        tags: Sequel.pg_jsonb(["visible"])
      )
      repo.create(
        user_id: SecureRandom.uuid,
        name: "Unpublished",
        image_path: "u",
        visibility: "unpublished",
        tags: Sequel.pg_jsonb(["hidden"])
      )

      result = repo.get_popular_tags(limit: 10)
      tag_names = result.map { |t| t[:name] }

      expect(tag_names).to include("visible")
      expect(tag_names).not_to include("hidden")
    end
  end
end
