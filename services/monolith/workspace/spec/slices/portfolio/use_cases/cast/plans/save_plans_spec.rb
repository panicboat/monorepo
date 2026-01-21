# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::UseCases::Cast::Plans::SavePlans do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  describe "#call" do
    let(:cast_id) { "550e8400-e29b-41d4-a716-446655440000" }
    let(:plans) { [{ name: "Plan A", price: 1000, duration_minutes: 60 }] }
    let(:cast_with_plans) { double(:cast) }

    it "saves plans and returns cast with plans" do
      expect(repo).to receive(:save_plans).with(id: cast_id, plans_data: plans).and_return(cast_with_plans)

      result = use_case.call(cast_id: cast_id, plans: plans)
      expect(result).to eq(cast_with_plans)
    end
  end
end
