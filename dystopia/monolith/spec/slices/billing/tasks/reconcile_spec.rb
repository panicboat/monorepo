# frozen_string_literal: true

require "spec_helper"
require "support/billing/fake_stripe_client"

RSpec.describe "billing:reconcile", type: :database do
  let(:fake) { Spec::Billing::FakeStripeClient.new }
  let(:customer_repo) { Billing::Repositories::CustomerRepository.new }
  let(:sub_repo) { Billing::Repositories::SubscriptionRepository.new }

  let(:reconcile) do
    require "slices/billing/tasks/reconcile"
    Billing::Tasks::Reconcile.new(
      customer_repo: customer_repo,
      subscription_repo: sub_repo,
      stripe_client: fake
    )
  end

  it "updates local mirror when Stripe status differs from DB" do
    account = SecureRandom.uuid_v7
    customer_repo.upsert_by_account_id(account_id: account, stripe_customer_id: "cus_1")
    sub_repo.upsert_by_stripe_id(
      account_id: account, stripe_subscription_id: "sub_x", stripe_price_id: "price_g",
      status: "trialing", current_period_end: Time.now + 3600, cancel_at_period_end: false
    )
    fake.inject_subscription(
      id: "sub_x", customer_id: "cus_1", price_id: "price_g",
      status: "active", current_period_end: Time.now + 3600
    )

    diff = reconcile.call

    expect(diff[:updated]).to eq(1)
    expect(sub_repo.find_by_stripe_subscription_id("sub_x").status).to eq("active")
  end

  it "propagates status transition to past_due" do
    account = SecureRandom.uuid_v7
    customer_repo.upsert_by_account_id(account_id: account, stripe_customer_id: "cus_2")
    sub_repo.upsert_by_stripe_id(
      account_id: account, stripe_subscription_id: "sub_y", stripe_price_id: "price_g",
      status: "active", current_period_end: Time.now + 3600, cancel_at_period_end: false
    )
    fake.inject_subscription(
      id: "sub_y", customer_id: "cus_2", price_id: "price_g",
      status: "past_due", current_period_end: Time.now + 3600
    )

    reconcile.call

    expect(sub_repo.find_by_stripe_subscription_id("sub_y").status).to eq("past_due")
  end

  it "uses the subscription item current_period_end when Stripe omits a root value" do
    account = SecureRandom.uuid_v7
    period_end = Time.now + 7200
    customer_repo.upsert_by_account_id(account_id: account, stripe_customer_id: "cus_3")
    sub_repo.upsert_by_stripe_id(
      account_id: account, stripe_subscription_id: "sub_z", stripe_price_id: "price_g",
      status: "active", current_period_end: Time.now + 3600, cancel_at_period_end: false
    )
    remote = OpenStruct.new(
      id: "sub_z",
      items: OpenStruct.new(data: [OpenStruct.new(
        price: OpenStruct.new(id: "price_g"),
        current_period_end: period_end.to_i
      )]),
      status: "active",
      cancel_at_period_end: false,
      canceled_at: nil
    )
    allow(fake).to receive(:retrieve_subscription).with(stripe_subscription_id: "sub_z").and_return(remote)

    expect(reconcile.call).to include(updated: 1, errors: 0)
    expect(sub_repo.find_by_stripe_subscription_id("sub_z").current_period_end.to_i).to eq(period_end.to_i)
  end
end
