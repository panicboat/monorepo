# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Schedules::SaveSchedules do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_id) { 1 }
    let(:schedules) { [{ date: "2026-01-20", start_time: "10:00", end_time: "18:00", plan_id: "1" }] }
    let(:cast_with_schedules) { double(:cast) }

    it "updates schedules and returns cast with schedules" do
      expect(repo).to receive(:update_schedules).with(id: cast_id, schedules: schedules)
      expect(repo).to receive(:find_with_plans).with(cast_id).and_return(cast_with_schedules)

      result = use_case.call(cast_id: cast_id, schedules: schedules)
      expect(result).to eq(cast_with_schedules)
    end
  end
end
