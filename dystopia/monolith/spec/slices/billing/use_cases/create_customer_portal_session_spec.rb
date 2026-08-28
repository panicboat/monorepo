# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/create_customer_portal_session"
require "support/billing/fake_stripe_client"

RSpec.describe Billing::UseCases::CreateCustomerPortalSession do
  let(:customer_repo) { double(:customer_repo) }
  let(:stripe_client) { Spec::Billing::FakeStripeClient.new }

  subject(:use_case) do
    described_class.new(
      customer_repo: customer_repo,
      stripe_client: stripe_client,
      return_url: "https://app/return"
    )
  end

  let(:account_id) { "a1" }

  it "raises when no customer row exists for the account" do
    allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
    expect { use_case.call(account_id: account_id) }.to raise_error(described_class::CustomerNotCreatedError)
  end

  it "returns a portal url when customer exists" do
    allow(customer_repo).to receive(:find_by_account_id).with(account_id).and_return(
      OpenStruct.new(stripe_customer_id: "cus_existing")
    )
    result = use_case.call(account_id: account_id)
    expect(result[:url]).to match(%r{\Ahttps://billing\.stripe\.test/})
    call = stripe_client.recorded_calls.first
    expect(call[:args][:customer_id]).to eq("cus_existing")
    expect(call[:args][:return_url]).to eq("https://app/return")
  end
end
