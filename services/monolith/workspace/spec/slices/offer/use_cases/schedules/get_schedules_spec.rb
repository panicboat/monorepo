# frozen_string_literal: true

require "spec_helper"

RSpec.describe Offer::UseCases::Schedules::GetSchedules do
  let(:use_case) { described_class.new(repo: repo, portfolio_adapter: adapter) }
  let(:repo) { double(:repo) }
  let(:adapter) { double(:adapter) }
  let(:cast_id) { SecureRandom.uuid }

  describe "#call" do
    context "when cast exists" do
      let(:schedules) { [double(:schedule, date: Date.today)] }

      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(true)
      end

      it "returns schedules for the cast" do
        allow(repo).to receive(:find_schedules_by_cast_user_id)
          .with(cast_id, start_date: nil, end_date: nil)
          .and_return(schedules)

        result = use_case.call(cast_user_id: cast_id)
        expect(result).to eq(schedules)
      end

      it "passes date filters to repository" do
        start_date = Date.today
        end_date = Date.today + 7

        allow(repo).to receive(:find_schedules_by_cast_user_id)
          .with(cast_id, start_date: start_date, end_date: end_date)
          .and_return(schedules)

        result = use_case.call(cast_user_id: cast_id, start_date: start_date, end_date: end_date)
        expect(result).to eq(schedules)
      end
    end

    context "when cast does not exist" do
      before do
        allow(adapter).to receive(:cast_exists?).with(cast_id).and_return(false)
      end

      it "raises CastNotFoundError" do
        expect { use_case.call(cast_user_id: cast_id) }
          .to raise_error(described_class::CastNotFoundError)
      end
    end
  end
end
