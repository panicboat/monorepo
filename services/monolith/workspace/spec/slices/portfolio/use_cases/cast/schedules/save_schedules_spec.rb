# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Schedules::SaveSchedules do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_id) { "550e8400-e29b-41d4-a716-446655440000" }
    let(:schedules) { [{ date: Date.parse("2026-01-22"), start_time: "10:00", end_time: "18:00" }] }
    let(:cast_with_schedules) { double(:cast) }

    it "saves schedules and returns cast with schedules" do
      expect(repo).to receive(:save_schedules).with(id: cast_id, schedules: schedules)
      expect(repo).to receive(:find_with_plans).with(cast_id).and_return(cast_with_schedules)

      result = use_case.call(cast_id: cast_id, schedules: schedules)
      expect(result).to eq(cast_with_schedules)
    end
  end
end
