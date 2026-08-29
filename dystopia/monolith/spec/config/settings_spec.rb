# frozen_string_literal: true

require "spec_helper"

RSpec.describe "billing settings" do
  let(:settings) { Hanami.app["settings"] }

  it "exposes stripe_api_key" do
    expect(settings.stripe_api_key).to be_a(String)
  end

  it "exposes stripe_webhook_secret" do
    expect(settings.stripe_webhook_secret).to be_a(String)
  end

  it "exposes both price ids and billing URLs" do
    expect(settings.stripe_price_id_guest).to be_a(String)
    expect(settings.stripe_price_id_cast).to be_a(String)
    expect(settings.billing_success_url).to be_a(String)
    expect(settings.billing_cancel_url).to be_a(String)
    expect(settings.billing_portal_return_url).to be_a(String)
  end
end
