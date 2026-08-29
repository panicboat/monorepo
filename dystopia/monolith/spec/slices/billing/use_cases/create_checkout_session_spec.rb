# frozen_string_literal: true

require "spec_helper"
require "slices/billing/plan_registry"
require "slices/billing/use_cases/create_checkout_session"
require "support/billing/fake_stripe_client"

RSpec.describe Billing::UseCases::CreateCheckoutSession do
  let(:customer_repo) { double(:customer_repo) }
  let(:subscription_repo) { double(:subscription_repo) }
  let(:account_repo) { double(:account_repo) }
  let(:plan_registry) { Billing::PlanRegistry.new(guest_price_id: "price_g", cast_price_id: "price_c") }
  let(:stripe_client) { Spec::Billing::FakeStripeClient.new }

  subject(:use_case) do
    described_class.new(
      customer_repo: customer_repo,
      subscription_repo: subscription_repo,
      account_repo: account_repo,
      plan_registry: plan_registry,
      stripe_client: stripe_client,
      success_url: "https://app/success",
      cancel_url: "https://app/cancel"
    )
  end

  let(:account_id) { "a1" }
  let(:guest_account) { OpenStruct.new(id: account_id, role: 1) }
  let(:cast_account) { OpenStruct.new(id: account_id, role: 2) }

  before do
    allow(subscription_repo).to receive(:find_active_by_account_id).with(account_id).and_return(nil)
  end

  context "when account is a guest with no prior customer" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(guest_account)
      allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
      allow(customer_repo).to receive(:upsert_by_account_id)
    end

    it "creates a Stripe customer, upserts, and returns checkout url" do
      expect(customer_repo).to receive(:upsert_by_account_id).with(account_id: account_id, stripe_customer_id: match(/\Acus_fake_/))
      result = use_case.call(account_id: account_id)
      expect(result[:url]).to match(%r{\Ahttps://checkout\.stripe\.test/})
      calls = stripe_client.recorded_calls.map { |call| call[:method] }
      expect(calls).to include(:create_customer, :create_checkout_session)
    end

    it "uses the guest price id for role=1" do
      use_case.call(account_id: account_id)
      checkout_call = stripe_client.recorded_calls.find { |call| call[:method] == :create_checkout_session }
      expect(checkout_call[:args][:price_id]).to eq("price_g")
    end

    it "tags the Stripe Checkout session with the billing integration_identifier" do
      use_case.call(account_id: account_id)
      checkout_call = stripe_client.recorded_calls.find { |call| call[:method] == :create_checkout_session }
      expect(checkout_call[:args]).to include(integration_identifier: "billing-EXeWm39u")
    end
  end

  context "when account is a cast with existing customer" do
    let(:existing_customer) { OpenStruct.new(account_id: account_id, stripe_customer_id: "cus_existing") }

    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(cast_account)
      allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(existing_customer)
    end

    it "does NOT create a new Stripe customer" do
      use_case.call(account_id: account_id)
      call_methods = stripe_client.recorded_calls.map { |call| call[:method] }
      expect(call_methods).not_to include(:create_customer)
      expect(call_methods).to include(:create_checkout_session)
    end

    it "uses the cast price id and existing customer id" do
      use_case.call(account_id: account_id)
      checkout_call = stripe_client.recorded_calls.find { |call| call[:method] == :create_checkout_session }
      expect(checkout_call[:args][:price_id]).to eq("price_c")
      expect(checkout_call[:args][:customer_id]).to eq("cus_existing")
    end
  end

  context "when account already has an active subscription" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(guest_account)
      allow(subscription_repo).to receive(:find_active_by_account_id).with(account_id).and_return(OpenStruct.new)
    end

    it "raises AlreadyActiveError" do
      expect { use_case.call(account_id: account_id) }.to raise_error(described_class::AlreadyActiveError)
    end
  end

  context "when account is unknown" do
    before { allow(account_repo).to receive(:find_by_id).with(account_id).and_return(nil) }

    it "raises AccountNotFoundError" do
      expect { use_case.call(account_id: account_id) }.to raise_error(described_class::AccountNotFoundError)
    end
  end

  context "when account role has no billing plan" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(OpenStruct.new(id: account_id, role: 99))
    end

    it "raises UnsupportedRoleError" do
      expect { use_case.call(account_id: account_id) }.to raise_error(described_class::UnsupportedRoleError)
    end
  end

  context "when Stripe raises APIConnectionError" do
    before do
      allow(account_repo).to receive(:find_by_id).with(account_id).and_return(guest_account)
      allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
      allow(customer_repo).to receive(:upsert_by_account_id)
      stripe_client.raise_on_next_call(Stripe::APIConnectionError.new("network"))
    end

    it "propagates the Stripe error" do
      expect { use_case.call(account_id: account_id) }.to raise_error(Stripe::APIConnectionError)
    end
  end
end
