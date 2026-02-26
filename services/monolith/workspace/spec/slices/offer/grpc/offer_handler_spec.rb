# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/offer/grpc/offer_handler"

RSpec.describe Offer::Grpc::OfferHandler do
  let(:handler) {
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      get_plans_uc: get_plans_uc,
      save_plans_uc: save_plans_uc,
      get_schedules_uc: get_schedules_uc,
      save_schedules_uc: save_schedules_uc,
      portfolio_adapter: portfolio_adapter
    )
  }
  let(:message) { double(:message) }
  let(:current_user_id) { 1 }

  # Mocks for dependencies
  let(:get_plans_uc) { double(:get_plans_uc) }
  let(:save_plans_uc) { double(:save_plans_uc) }
  let(:get_schedules_uc) { double(:get_schedules_uc) }
  let(:save_schedules_uc) { double(:save_schedules_uc) }
  let(:portfolio_adapter) { double(:portfolio_adapter) }

  before do
    allow(Current).to receive(:user_id).and_return(current_user_id)
  end

  let(:mock_cast) do
    double("Cast", user_id: "cast-123")
  end

  let(:mock_plan) do
    double("Plan",
      id: "plan-123",
      cast_user_id: "cast-123",
      name: "Plan A",
      price: 1000,
      duration_minutes: 60,
      is_recommended: true,
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  let(:mock_schedule) do
    double("Schedule",
      id: "schedule-123",
      cast_user_id: "cast-123",
      date: Date.today,
      start_time: "10:00",
      end_time: "18:00",
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  describe "#get_plans" do
    let(:message) { ::Offer::V1::GetPlansRequest.new(cast_user_id: "cast-123") }

    it "returns plans for the cast" do
      expect(get_plans_uc).to receive(:call).with(cast_user_id: "cast-123").and_return([mock_plan])

      response = handler.get_plans
      expect(response).to be_a(::Offer::V1::GetPlansResponse)
      expect(response.plans.size).to eq(1)
      expect(response.plans.first.name).to eq("Plan A")
    end

    it "raises NOT_FOUND when cast not found" do
      expect(get_plans_uc).to receive(:call).and_raise(Offer::UseCases::Plans::GetPlans::CastNotFoundError)

      expect { handler.get_plans }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end

  describe "#save_plans" do
    let(:message) do
      ::Offer::V1::SavePlansRequest.new(
        plans: [::Offer::V1::Plan.new(name: "New Plan", price: 2000, duration_minutes: 90, is_recommended: false)]
      )
    end

    it "saves plans and returns response" do
      allow(portfolio_adapter).to receive(:find_cast_by_user_id).with(1).and_return(mock_cast)
      expect(save_plans_uc).to receive(:call).with(
        cast_user_id: "cast-123",
        plans: [{ name: "New Plan", price: 2000, duration_minutes: 90, is_recommended: false }]
      ).and_return([mock_plan])

      response = handler.save_plans
      expect(response).to be_a(::Offer::V1::SavePlansResponse)
    end

    it "raises UNAUTHENTICATED when no user" do
      allow(Current).to receive(:user_id).and_return(nil)

      expect { handler.save_plans }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end

    it "raises NOT_FOUND when cast profile not found" do
      allow(portfolio_adapter).to receive(:find_cast_by_user_id).with(1).and_return(nil)

      expect { handler.save_plans }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end

  describe "#get_schedules" do
    let(:message) { ::Offer::V1::GetSchedulesRequest.new(cast_user_id: "cast-123") }

    it "returns schedules for the cast" do
      expect(get_schedules_uc).to receive(:call)
        .with(cast_user_id: "cast-123", start_date: nil, end_date: nil)
        .and_return([mock_schedule])

      response = handler.get_schedules
      expect(response).to be_a(::Offer::V1::GetSchedulesResponse)
      expect(response.schedules.size).to eq(1)
    end

    it "passes date filters" do
      message_with_dates = ::Offer::V1::GetSchedulesRequest.new(
        cast_user_id: "cast-123",
        start_date: "2026-01-01",
        end_date: "2026-01-31"
      )
      handler_with_dates = described_class.new(
        method_key: :test,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: message_with_dates,
        get_plans_uc: get_plans_uc,
        save_plans_uc: save_plans_uc,
        get_schedules_uc: get_schedules_uc,
        save_schedules_uc: save_schedules_uc,
        portfolio_adapter: portfolio_adapter
      )

      expect(get_schedules_uc).to receive(:call)
        .with(cast_user_id: "cast-123", start_date: "2026-01-01", end_date: "2026-01-31")
        .and_return([])

      handler_with_dates.get_schedules
    end

    it "raises NOT_FOUND when cast not found" do
      expect(get_schedules_uc).to receive(:call).and_raise(Offer::UseCases::Schedules::GetSchedules::CastNotFoundError)

      expect { handler.get_schedules }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end

  describe "#save_schedules" do
    let(:message) do
      ::Offer::V1::SaveSchedulesRequest.new(
        schedules: [::Offer::V1::Schedule.new(date: "2026-01-20", start_time: "10:00", end_time: "18:00")]
      )
    end

    it "saves schedules and returns response" do
      allow(portfolio_adapter).to receive(:find_cast_by_user_id).with(1).and_return(mock_cast)
      expect(save_schedules_uc).to receive(:call).with(
        cast_user_id: "cast-123",
        schedules: [{ date: "2026-01-20", start_time: "10:00", end_time: "18:00" }]
      ).and_return([mock_schedule])

      response = handler.save_schedules
      expect(response).to be_a(::Offer::V1::SaveSchedulesResponse)
    end

    it "raises UNAUTHENTICATED when no user" do
      allow(Current).to receive(:user_id).and_return(nil)

      expect { handler.save_schedules }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end
  end
end
