# frozen_string_literal: true

require "spec_helper"

RSpec.describe Offer::UseCases::Plans::GetPlans do
  let(:use_case) { described_class.new(repo: repo, portfolio_adapter: adapter) }
  let(:repo) { double(:repo) }
  let(:adapter) { double(:adapter) }
  let(:cast_id) { SecureRandom.uuid }

  describe "#call" do
    context "when cast exists" do
      let(:plans) { [double(:plan, name: "Plan A")] }

      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(true)
        allow(repo).to receive(:find_plans_by_cast_id).with(cast_id).and_return(plans)
      end

      it "returns plans for the cast" do
        result = use_case.call(cast_id: cast_id)
        expect(result).to eq(plans)
      end
    end

    context "when cast does not exist" do
      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(false)
      end

      it "raises CastNotFoundError" do
        expect { use_case.call(cast_id: cast_id) }
          .to raise_error(described_class::CastNotFoundError)
      end
    end
  end
end
