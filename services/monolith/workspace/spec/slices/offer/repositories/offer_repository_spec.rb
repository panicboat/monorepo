# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Offer::Repositories::OfferRepository", type: :database do
  let(:repo) { Hanami.app.slices[:offer]["repositories.offer_repository"] }
  let(:portfolio_repo) { Hanami.app.slices[:portfolio]["repositories.cast_repository"] }

  # Helper to create a cast in Portfolio (required for FK constraint)
  def create_cast
    portfolio_repo.create(
      user_id: SecureRandom.uuid,
      name: "Test Cast",
      visibility: "public"
    )
  end

  describe "#find_plans_by_cast_id" do
    it "returns empty array when no plans exist" do
      cast = create_cast
      result = repo.find_plans_by_cast_id(cast.user_id)
      expect(result).to eq([])
    end

    it "returns plans for the cast" do
      cast = create_cast
      repo.save_plans(cast_user_id: cast.user_id, plans_data: [
        { name: "Plan A", price: 1000, duration_minutes: 60, is_recommended: true },
        { name: "Plan B", price: 2000, duration_minutes: 120, is_recommended: false }
      ])

      result = repo.find_plans_by_cast_id(cast.user_id)
      expect(result.size).to eq(2)
      expect(result.map(&:name)).to contain_exactly("Plan A", "Plan B")
    end
  end

  describe "#save_plans" do
    let!(:cast) { create_cast }

    it "creates new plans" do
      plans_data = [{ name: "New Plan", price: 1500, duration_minutes: 90, is_recommended: false }]
      result = repo.save_plans(cast_user_id: cast.user_id, plans_data: plans_data)

      expect(result.size).to eq(1)
      expect(result.first.name).to eq("New Plan")
      expect(result.first.price).to eq(1500)
    end

    it "replaces existing plans" do
      # Create initial plans
      repo.save_plans(cast_user_id: cast.user_id, plans_data: [
        { name: "Old Plan", price: 1000, duration_minutes: 60, is_recommended: false }
      ])

      # Replace with new plans
      result = repo.save_plans(cast_user_id: cast.user_id, plans_data: [
        { name: "New Plan 1", price: 2000, duration_minutes: 90, is_recommended: true },
        { name: "New Plan 2", price: 3000, duration_minutes: 120, is_recommended: false }
      ])

      expect(result.size).to eq(2)
      expect(result.map(&:name)).to contain_exactly("New Plan 1", "New Plan 2")
    end
  end

  describe "#find_schedules_by_cast_id" do
    let!(:cast) { create_cast }

    it "returns empty array when no schedules exist" do
      result = repo.find_schedules_by_cast_id(cast.user_id)
      expect(result).to eq([])
    end

    it "returns schedules ordered by date and time" do
      repo.save_schedules(cast_user_id: cast.user_id, schedules_data: [
        { date: Date.today + 2, start_time: "14:00", end_time: "18:00" },
        { date: Date.today + 1, start_time: "10:00", end_time: "14:00" },
        { date: Date.today + 1, start_time: "16:00", end_time: "20:00" }
      ])

      result = repo.find_schedules_by_cast_id(cast.user_id)
      expect(result.size).to eq(3)
      expect(result.first.date).to eq(Date.today + 1)
      expect(result.first.start_time).to eq("10:00")
    end

    it "filters by date range" do
      repo.save_schedules(cast_user_id: cast.user_id, schedules_data: [
        { date: Date.today + 1, start_time: "10:00", end_time: "14:00" },
        { date: Date.today + 3, start_time: "10:00", end_time: "14:00" },
        { date: Date.today + 5, start_time: "10:00", end_time: "14:00" }
      ])

      result = repo.find_schedules_by_cast_id(
        cast.user_id,
        start_date: Date.today + 2,
        end_date: Date.today + 4
      )

      expect(result.size).to eq(1)
      expect(result.first.date).to eq(Date.today + 3)
    end
  end

  describe "#save_schedules" do
    let!(:cast) { create_cast }

    it "creates new schedules" do
      schedules_data = [
        { date: Date.today, start_time: "10:00", end_time: "14:00" },
        { date: Date.today + 1, start_time: "12:00", end_time: "18:00" }
      ]

      result = repo.save_schedules(cast_user_id: cast.user_id, schedules_data: schedules_data)
      expect(result.size).to eq(2)
    end

    it "replaces future schedules but preserves past schedules" do
      # Create a past schedule directly
      past_date = Date.today - 7
      schedules_relation = Hanami.app.slices[:offer]["relations.schedules"]
      schedules_relation.changeset(:create, {
        cast_user_id: cast.user_id,
        date: past_date,
        start_time: "09:00",
        end_time: "10:00"
      }).commit

      # Save new future schedules
      repo.save_schedules(cast_user_id: cast.user_id, schedules_data: [
        { date: Date.today + 1, start_time: "14:00", end_time: "18:00" }
      ])

      # Should have both past and future schedules
      result = repo.find_schedules_by_cast_id(cast.user_id)
      dates = result.map(&:date)
      expect(dates).to include(past_date)
      expect(dates).to include(Date.today + 1)
    end

    it "ignores past dates in input" do
      past_date = Date.today - 1
      future_date = Date.today + 1

      result = repo.save_schedules(cast_user_id: cast.user_id, schedules_data: [
        { date: past_date, start_time: "10:00", end_time: "14:00" },
        { date: future_date, start_time: "10:00", end_time: "14:00" }
      ])

      # Only future date should be saved
      expect(result.size).to eq(1)
      expect(result.first.date).to eq(future_date)
    end
  end
end
