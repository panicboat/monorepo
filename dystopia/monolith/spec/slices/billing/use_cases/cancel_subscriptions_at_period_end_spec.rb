# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/cancel_subscriptions_at_period_end"
require "support/billing/fake_stripe_client"

RSpec.describe Billing::UseCases::CancelSubscriptionsAtPeriodEnd, type: :database do
  subject(:use_case) do
    described_class.new(subscription_repo: subscription_repo, stripe_client: stripe_client)
  end

  let(:subscription_repo) { Billing::Repositories::SubscriptionRepository.new }
  let(:stripe_client) { Spec::Billing::FakeStripeClient.new }
  let(:account_id) { SecureRandom.uuid_v7 }

  def store(stripe_subscription_id, status: "active")
    subscription_repo.upsert_by_stripe_id(
      account_id: account_id,
      stripe_subscription_id: stripe_subscription_id,
      stripe_price_id: "price_g",
      status: status,
      current_period_end: Time.now + 3600,
      cancel_at_period_end: false
    )
  end

  def cancel_calls
    stripe_client.recorded_calls.select { |call| call[:method] == :cancel_at_period_end }
  end

  it "updates Stripe and the row for every uncanceled subscription" do
    store("sub_a")
    store("sub_b", status: "past_due")

    use_case.call(account_id: account_id)

    expect(cancel_calls.map { |call| call[:args][:stripe_subscription_id] }).to contain_exactly("sub_a", "sub_b")
    expect(subscription_repo.find_by_stripe_subscription_id("sub_a").cancel_at_period_end).to be(true)
    expect(subscription_repo.find_by_stripe_subscription_id("sub_b").cancel_at_period_end).to be(true)
  end

  it "does not call Stripe for a canceled subscription" do
    store("sub_done", status: "canceled")

    use_case.call(account_id: account_id)

    expect(cancel_calls).to be_empty
    expect(subscription_repo.find_by_stripe_subscription_id("sub_done").cancel_at_period_end).to be(false)
  end

  it "does not call Stripe when the account has no subscription" do
    use_case.call(account_id: account_id)

    expect(cancel_calls).to be_empty
  end

  it "raises the Stripe error and leaves the row unchanged" do
    store("sub_a")
    stripe_client.raise_on_next_call(Stripe::APIConnectionError.new("stripe down"))

    expect { use_case.call(account_id: account_id) }.to raise_error(Stripe::APIConnectionError, "stripe down")
    expect(subscription_repo.find_by_stripe_subscription_id("sub_a").cancel_at_period_end).to be(false)
  end
end
