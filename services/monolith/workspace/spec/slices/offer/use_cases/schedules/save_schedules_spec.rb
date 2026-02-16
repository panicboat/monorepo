# frozen_string_literal: true

require "spec_helper"

RSpec.describe Offer::UseCases::Schedules::SaveSchedules do
  let(:use_case) { described_class.new(repo: repo, contract: contract, portfolio_adapter: adapter) }
  let(:repo) { double(:repo) }
  let(:contract) { Offer::Contracts::SaveSchedulesContract.new }
  let(:adapter) { double(:adapter) }
  let(:cast_id) { SecureRandom.uuid }
  let(:schedules) { [{ date: Date.today.to_s, start_time: "10:00", end_time: "18:00" }] }

  describe "#call" do
    context "when validation passes and cast exists" do
      let(:saved_schedules) { [double(:schedule, date: Date.today)] }

      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(true)
        allow(repo).to receive(:save_schedules).with(cast_id: cast_id, schedules_data: schedules).and_return(saved_schedules)
      end

      it "saves schedules and returns result" do
        result = use_case.call(cast_id: cast_id, schedules: schedules)
        expect(result).to eq(saved_schedules)
      end
    end

    context "when cast does not exist" do
      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(false)
      end

      it "raises CastNotFoundError" do
        expect { use_case.call(cast_id: cast_id, schedules: schedules) }
          .to raise_error(described_class::CastNotFoundError)
      end
    end

    context "when validation fails" do
      let(:invalid_schedules) { [{ date: "", start_time: "10:00", end_time: "18:00" }] }

      it "raises ValidationError" do
        expect { use_case.call(cast_id: cast_id, schedules: invalid_schedules) }
          .to raise_error(described_class::ValidationError)
      end
    end
  end
end
