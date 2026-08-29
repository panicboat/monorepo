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
end
