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
end
