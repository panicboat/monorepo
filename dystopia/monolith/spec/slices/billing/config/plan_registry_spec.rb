# frozen_string_literal: true

require "spec_helper"
require "slices/billing/config/plan_registry"

RSpec.describe Billing::Config::PlanRegistry do
  subject(:registry) do
    described_class.new(guest_price_id: "price_g", cast_price_id: "price_c")
  end

  it "returns guest price for role=1 (Guest)" do
    expect(registry.price_id_for(1)).to eq("price_g")
  end

  it "returns cast price for role=2 (Cast)" do
    expect(registry.price_id_for(2)).to eq("price_c")
  end

  it "raises for unsupported role" do
    expect { registry.price_id_for(99) }.to raise_error(Billing::Config::PlanRegistry::UnsupportedRoleError)
  end
end
