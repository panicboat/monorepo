# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/get_my_subscription"

RSpec.describe Billing::UseCases::GetMySubscription do
  let(:sub_repo) { double(:subscription_repo) }
  subject(:use_case) { described_class.new(subscription_repo: sub_repo) }

  let(:account_id) { "a1" }

  it "returns nil when no subscription row exists" do
    allow(sub_repo).to receive(:find_by_account_id).with(account_id).and_return(nil)
    expect(use_case.call(account_id: account_id)).to be_nil
  end

  it "returns a hash mirroring the row" do
    period_end = Time.now + 3600
    row = OpenStruct.new(
      status: "trialing",
      current_period_end: period_end,
      cancel_at_period_end: false,
      stripe_price_id: "price_g"
    )
    allow(sub_repo).to receive(:find_by_account_id).with(account_id).and_return(row)

    result = use_case.call(account_id: account_id)
    expect(result).to eq(
      status: "trialing",
      current_period_end: period_end,
      cancel_at_period_end: false,
      price_id: "price_g"
    )
  end
end
