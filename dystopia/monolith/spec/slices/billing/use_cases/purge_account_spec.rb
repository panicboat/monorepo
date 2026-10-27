# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/purge_account"
require "support/billing/fake_stripe_client"

RSpec.describe Billing::UseCases::PurgeAccount, type: :database do
  subject(:use_case) do
    described_class.new(customer_repo: customer_repo, subscription_repo: subscription_repo, stripe_client: stripe_client)
  end

  let(:customer_repo) { Billing::Repositories::CustomerRepository.new }
  let(:subscription_repo) { Billing::Repositories::SubscriptionRepository.new }
  let(:stripe_client) { Spec::Billing::FakeStripeClient.new }
  let(:account_id) { SecureRandom.uuid_v7 }
  let(:bystander_id) { SecureRandom.uuid_v7 }

  def store_subscription(owner_id, stripe_subscription_id, status: "active")
    subscription_repo.upsert_by_stripe_id(
      account_id: owner_id,
      stripe_subscription_id: stripe_subscription_id,
      stripe_price_id: "price_g",
      status: status,
      current_period_end: Time.now + 3600,
      cancel_at_period_end: false
    )
  end

  def delete_customer_calls
    stripe_client.recorded_calls.select { |call| call[:method] == :delete_customer }
  end

  context "when the account has a customer row" do
    before do
      customer_repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: "cus_purged")
      store_subscription(account_id, "sub_active")
      store_subscription(account_id, "sub_old", status: "canceled")
      customer_repo.upsert_by_account_id(account_id: bystander_id, stripe_customer_id: "cus_bystander")
      store_subscription(bystander_id, "sub_bystander")
    end

    it "deletes the Stripe customer, then the subscription rows and the customer row of the account" do
      expect(use_case.call(account_id: account_id)).to be_nil

      expect(delete_customer_calls.map { |call| call[:args] }).to eq([{ stripe_customer_id: "cus_purged" }])
      expect(customer_repo.find_by_account_id(account_id)).to be_nil
      expect(subscription_repo.find_by_account_id(account_id)).to be_nil
    end

    it "keeps the rows of other accounts" do
      use_case.call(account_id: account_id)

      expect(customer_repo.find_by_account_id(bystander_id).stripe_customer_id).to eq("cus_bystander")
      expect(subscription_repo.find_by_account_id(bystander_id).stripe_subscription_id).to eq("sub_bystander")
    end

    it "raises the Stripe error and leaves every row of the account" do
      stripe_client.raise_on_next_call(Stripe::APIConnectionError.new("stripe down"))

      expect { use_case.call(account_id: account_id) }.to raise_error(Stripe::APIConnectionError, "stripe down")
      expect(customer_repo.find_by_account_id(account_id).stripe_customer_id).to eq("cus_purged")
      expect(subscription_repo.find_by_stripe_subscription_id("sub_active")).not_to be_nil
      expect(subscription_repo.find_by_stripe_subscription_id("sub_old")).not_to be_nil
    end

    it "finishes on the next call after the Stripe error" do
      stripe_client.raise_on_next_call(Stripe::APIConnectionError.new("stripe down"))
      expect { use_case.call(account_id: account_id) }.to raise_error(Stripe::APIConnectionError)

      use_case.call(account_id: account_id)

      expect(customer_repo.find_by_account_id(account_id)).to be_nil
      expect(subscription_repo.find_by_account_id(account_id)).to be_nil
    end
  end

  context "when the account has no customer row" do
    it "does not call Stripe" do
      use_case.call(account_id: account_id)

      expect(delete_customer_calls).to be_empty
    end

    it "deletes the subscription rows that remain" do
      store_subscription(account_id, "sub_orphan")

      use_case.call(account_id: account_id)

      expect(delete_customer_calls).to be_empty
      expect(subscription_repo.find_by_account_id(account_id)).to be_nil
    end
  end
end
