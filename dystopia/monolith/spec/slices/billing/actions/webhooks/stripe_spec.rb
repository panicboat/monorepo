# frozen_string_literal: true

require "spec_helper"
require "rack/test"
require "support/billing/fake_stripe_client"

RSpec.describe "POST /billing/webhooks/stripe", type: :database do
  include Rack::Test::Methods

  def app
    Hanami.app
  end

  let(:fake_stripe) { Spec::Billing::FakeStripeClient.new }
  let(:process_uc) { double(:process_uc) }

  before do
    allow(Billing::Container).to receive(:[]).and_call_original
    allow(Billing::Container).to receive(:[]).with("adapters.stripe_client").and_return(fake_stripe)
    allow(Billing::Container).to receive(:[]).with("use_cases.process_webhook_event").and_return(process_uc)
  end

  def signed_headers(payload, secret: Hanami.app["settings"].stripe_webhook_secret)
    { "HTTP_STRIPE_SIGNATURE" => fake_stripe.generate_test_signature(payload: payload, secret: secret) }
  end

  it "returns 400 when the signature header is missing" do
    post "/billing/webhooks/stripe", "{}", { "CONTENT_TYPE" => "application/json" }

    expect(last_response.status).to eq(400)
  end

  it "returns 400 when the signature is invalid" do
    payload = { id: "evt_1", type: "customer.subscription.created" }.to_json
    post "/billing/webhooks/stripe", payload, {
      "CONTENT_TYPE" => "application/json",
      "HTTP_STRIPE_SIGNATURE" => "t=1,v1=deadbeef"
    }

    expect(last_response.status).to eq(400)
  end

  it "returns 200 when signature ok and use_case succeeds" do
    allow(process_uc).to receive(:call).and_return(:processed)
    payload = { id: "evt_2", type: "customer.subscription.created", data: { object: {} } }.to_json
    post "/billing/webhooks/stripe", payload, { "CONTENT_TYPE" => "application/json" }.merge(signed_headers(payload))

    expect(last_response.status).to eq(200)
  end

  it "returns 500 when the use_case raises" do
    allow(process_uc).to receive(:call).and_raise(StandardError, "boom")
    payload = { id: "evt_3", type: "customer.subscription.updated", data: { object: {} } }.to_json
    post "/billing/webhooks/stripe", payload, { "CONTENT_TYPE" => "application/json" }.merge(signed_headers(payload))

    expect(last_response.status).to eq(500)
  end
end
