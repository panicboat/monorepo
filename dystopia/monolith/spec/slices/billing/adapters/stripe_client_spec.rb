# frozen_string_literal: true

require "spec_helper"
require "slices/billing/adapters/stripe_client"

RSpec.describe Billing::Adapters::StripeClient do
  subject(:client) { described_class.new(api_key: "sk_test_dummy") }

  it "responds to create_customer" do
    expect(client).to respond_to(:create_customer)
  end

  it "responds to create_checkout_session" do
    expect(client).to respond_to(:create_checkout_session)
  end

  it "responds to create_billing_portal_session" do
    expect(client).to respond_to(:create_billing_portal_session)
  end

  it "responds to retrieve_subscription" do
    expect(client).to respond_to(:retrieve_subscription)
  end

  it "responds to construct_webhook_event" do
    expect(client).to respond_to(:construct_webhook_event)
  end

  describe "#cancel_at_period_end" do
    it "sets cancel_at_period_end on the subscription without an idempotency key" do
      expect(::Stripe::Subscription).to receive(:update).with(
        "sub_1",
        { cancel_at_period_end: true },
        { api_key: "sk_test_dummy" }
      )

      client.cancel_at_period_end(stripe_subscription_id: "sub_1")
    end
  end

  describe "#delete_customer" do
    it "deletes the Stripe customer without an idempotency key" do
      expect(::Stripe::Customer).to receive(:delete).with("cus_1", {}, { api_key: "sk_test_dummy" })

      client.delete_customer(stripe_customer_id: "cus_1")
    end

    it "treats a customer that no longer exists as deleted" do
      missing = ::Stripe::InvalidRequestError.new("No such customer: 'cus_1'", "id", http_status: 404, code: "resource_missing")
      allow(::Stripe::Customer).to receive(:delete).and_raise(missing)

      expect { client.delete_customer(stripe_customer_id: "cus_1") }.not_to raise_error
    end

    it "raises an invalid request that is not a missing resource" do
      invalid = ::Stripe::InvalidRequestError.new("Invalid request", nil, http_status: 400, code: "parameter_invalid_empty")
      allow(::Stripe::Customer).to receive(:delete).and_raise(invalid)

      expect { client.delete_customer(stripe_customer_id: "cus_1") }.to raise_error(::Stripe::InvalidRequestError, "Invalid request")
    end

    it "raises an error that is not an invalid request" do
      allow(::Stripe::Customer).to receive(:delete).and_raise(::Stripe::APIConnectionError.new("stripe down"))

      expect { client.delete_customer(stripe_customer_id: "cus_1") }.to raise_error(::Stripe::APIConnectionError, "stripe down")
    end
  end
end
