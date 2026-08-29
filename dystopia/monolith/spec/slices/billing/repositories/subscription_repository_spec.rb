# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/subscription_repository"

RSpec.describe Billing::Repositories::SubscriptionRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:account_id) { SecureRandom.uuid_v7 }
  let(:sub_id) { "sub_#{SecureRandom.hex(8)}" }
  let(:price_id) { "price_test_guest" }
  let(:period_end) { Time.now + 30 * 24 * 60 * 60 }

  def upsert(overrides = {})
    repo.upsert_by_stripe_id(
      account_id: account_id,
      stripe_subscription_id: sub_id,
      stripe_price_id: price_id,
      status: "active",
      current_period_end: period_end,
      cancel_at_period_end: false,
      **overrides
    )
  end

  describe "#upsert_by_stripe_id" do
    it "creates a new row on first call" do
      row = upsert
      expect(row.stripe_subscription_id).to eq(sub_id)
      expect(row.status).to eq("active")
      expect(row.cancel_at_period_end).to be(false)
    end

    it "updates an existing row on second call with same stripe_subscription_id" do
      upsert
      updated = upsert(status: "past_due", cancel_at_period_end: true)
      expect(updated.status).to eq("past_due")
      expect(updated.cancel_at_period_end).to be(true)
      expect(repo.find_by_account_id(account_id).stripe_subscription_id).to eq(sub_id)
    end
  end

  describe "#find_active_by_account_id" do
    it "returns row when status=active and current_period_end in future" do
      upsert(status: "active", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_account_id(account_id)).not_to be_nil
    end

    it "returns row when status=trialing and current_period_end in future" do
      upsert(status: "trialing", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_account_id(account_id)).not_to be_nil
    end

    it "returns nil when status=past_due" do
      upsert(status: "past_due", current_period_end: Time.now + 3600)
      expect(repo.find_active_by_account_id(account_id)).to be_nil
    end

    it "returns nil when current_period_end is in the past even if status=active" do
      upsert(status: "active", current_period_end: Time.now - 3600)
      expect(repo.find_active_by_account_id(account_id)).to be_nil
    end
  end

  describe "#mark_canceled" do
    it "sets status to canceled and canceled_at" do
      upsert
      canceled_time = Time.now
      repo.mark_canceled(stripe_subscription_id: sub_id, canceled_at: canceled_time)
      row = repo.find_by_stripe_subscription_id(sub_id)
      expect(row.status).to eq("canceled")
      expect(row.canceled_at).to be_within(1).of(canceled_time)
    end
  end
end
