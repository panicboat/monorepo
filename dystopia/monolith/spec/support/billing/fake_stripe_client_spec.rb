# frozen_string_literal: true

require "spec_helper"
require "support/billing/fake_stripe_client"
require "slices/billing/adapters/stripe_client"

RSpec.describe Spec::Billing::FakeStripeClient do
  subject(:fake) { described_class.new }

  it "has every public method the real StripeClient exposes" do
    real_methods = Billing::Adapters::StripeClient.instance_methods(false)
    real_methods.each do |method|
      expect(described_class.instance_methods).to include(method), "fake is missing #{method}"
    end
  end

  it "create_customer returns a customer-like object with id and account_id metadata" do
    result = fake.create_customer(account_id: "acct-1", idempotency_key: "k1")
    expect(result.id).to match(/\Acus_fake_/)
    expect(result.metadata["account_id"]).to eq("acct-1")
  end

  it "create_customer is idempotent by idempotency_key" do
    a = fake.create_customer(account_id: "acct-1", idempotency_key: "same-key")
    b = fake.create_customer(account_id: "acct-1", idempotency_key: "same-key")
    expect(a.id).to eq(b.id)
  end

  it "create_checkout_session returns object with .url" do
    fake.create_customer(account_id: "acct-1", idempotency_key: "k1")
    session = fake.create_checkout_session(
      customer_id: "cus_fake_1", price_id: "price_x",
      success_url: "https://s", cancel_url: "https://c", idempotency_key: "k2"
    )
    expect(session.url).to match(%r{\Ahttps://checkout\.stripe\.test/cs_fake_})
  end

  it "construct_webhook_event verifies signature and returns event" do
    payload = { id: "evt_1", type: "customer.subscription.created", data: {} }.to_json
    sig = fake.generate_test_signature(payload: payload, timestamp: Time.now.to_i)
    event = fake.construct_webhook_event(payload: payload, sig_header: sig, secret: "whsec_fake")
    expect(event.id).to eq("evt_1")
  end

  it "construct_webhook_event raises on bad signature" do
    payload = { id: "evt_1", type: "x" }.to_json
    expect {
      fake.construct_webhook_event(payload: payload, sig_header: "t=1,v1=bad", secret: "whsec_fake")
    }.to raise_error(Stripe::SignatureVerificationError)
  end
end
