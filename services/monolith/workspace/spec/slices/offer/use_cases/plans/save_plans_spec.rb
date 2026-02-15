# frozen_string_literal: true

require "spec_helper"

RSpec.describe Offer::UseCases::Plans::SavePlans do
  let(:use_case) { described_class.new(repo: repo, contract: contract, portfolio_adapter: adapter) }
  let(:repo) { double(:repo) }
  let(:contract) { Offer::Contracts::SavePlansContract.new }
  let(:adapter) { double(:adapter) }
  let(:cast_id) { SecureRandom.uuid }
  let(:plans) { [{ name: "Plan A", price: 1000, duration_minutes: 60, is_recommended: false }] }

  describe "#call" do
    context "when validation passes and cast exists" do
      let(:saved_plans) { [double(:plan, name: "Plan A")] }

      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(true)
        allow(repo).to receive(:save_plans).with(cast_id: cast_id, plans_data: plans).and_return(saved_plans)
      end

      it "saves plans and returns result" do
        result = use_case.call(cast_id: cast_id, plans: plans)
        expect(result).to eq(saved_plans)
      end
    end

    context "when cast does not exist" do
      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(false)
      end

      it "raises CastNotFoundError" do
        expect { use_case.call(cast_id: cast_id, plans: plans) }
          .to raise_error(described_class::CastNotFoundError)
      end
    end

    context "when validation fails" do
      let(:invalid_plans) { [{ name: "", price: 1000, duration_minutes: 60 }] }

      it "raises ValidationError" do
        expect { use_case.call(cast_id: cast_id, plans: invalid_plans) }
          .to raise_error(described_class::ValidationError)
      end
    end
  end
end
