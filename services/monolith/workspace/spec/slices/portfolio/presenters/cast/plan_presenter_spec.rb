# frozen_string_literal: true

require "spec_helper"
require "portfolio/v1/cast_service_pb"

RSpec.describe Portfolio::Presenters::Cast::PlanPresenter do
  describe ".to_proto" do
    let(:plan) do
      double(
        :plan,
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Standard Plan",
        price: 10_000,
        duration_minutes: 60,
        is_recommended: true
      )
    end

    it "returns nil when plan is nil" do
      expect(described_class.to_proto(nil)).to be_nil
    end

    it "converts plan to proto" do
      proto = described_class.to_proto(plan)

      expect(proto).to be_a(::Portfolio::V1::CastPlan)
      expect(proto.id).to eq("550e8400-e29b-41d4-a716-446655440000")
      expect(proto.name).to eq("Standard Plan")
      expect(proto.price).to eq(10_000)
      expect(proto.duration_minutes).to eq(60)
      expect(proto.is_recommended).to be true
    end

    context "when is_recommended is false" do
      let(:plan_not_recommended) do
        double(
          :plan,
          id: "650e8400-e29b-41d4-a716-446655440001",
          name: "Basic Plan",
          price: 5_000,
          duration_minutes: 30,
          is_recommended: false
        )
      end

      it "converts with is_recommended as false" do
        proto = described_class.to_proto(plan_not_recommended)

        expect(proto.is_recommended).to be false
      end
    end

    context "when is_recommended is nil" do
      let(:plan_nil_recommended) do
        double(
          :plan,
          id: "750e8400-e29b-41d4-a716-446655440002",
          name: "Premium Plan",
          price: 20_000,
          duration_minutes: 120,
          is_recommended: nil
        )
      end

      it "defaults is_recommended to false" do
        proto = described_class.to_proto(plan_nil_recommended)

        expect(proto.is_recommended).to be false
      end
    end
  end

  describe ".many_to_proto" do
    let(:plans) do
      [
        double(:plan, id: "1", name: "Plan A", price: 5_000, duration_minutes: 30, is_recommended: false),
        double(:plan, id: "2", name: "Plan B", price: 10_000, duration_minutes: 60, is_recommended: true)
      ]
    end

    it "returns empty array when plans is nil" do
      expect(described_class.many_to_proto(nil)).to eq([])
    end

    it "returns empty array when plans is empty" do
      expect(described_class.many_to_proto([])).to eq([])
    end

    it "converts multiple plans to proto array" do
      protos = described_class.many_to_proto(plans)

      expect(protos.length).to eq(2)
      expect(protos[0].name).to eq("Plan A")
      expect(protos[0].is_recommended).to be false
      expect(protos[1].name).to eq("Plan B")
      expect(protos[1].is_recommended).to be true
    end
  end
end
