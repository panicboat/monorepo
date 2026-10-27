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

  def insert_row(id:, stripe_subscription_id:, status:, created_at:)
    Hanami.app["db.gateway"].connection[:billing__subscriptions].insert(
      id: id, account_id: account_id, stripe_subscription_id: stripe_subscription_id,
      stripe_price_id: price_id, status: status, current_period_end: period_end,
      cancel_at_period_end: false, created_at: created_at, updated_at: created_at
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

    it "stores a second row for the same account under another stripe_subscription_id" do
      upsert(status: "canceled")
      upsert(stripe_subscription_id: "sub_next")

      expect(repo.find_by_stripe_subscription_id(sub_id).status).to eq("canceled")
      expect(repo.find_by_stripe_subscription_id("sub_next").status).to eq("active")
    end
  end

  describe "#find_by_account_id" do
    let(:base_time) { Time.now - 3600 }

    it "returns the row with the latest created_at" do
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_old", status: "canceled", created_at: base_time)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_new", status: "active", created_at: base_time + 60)

      expect(repo.find_by_account_id(account_id).stripe_subscription_id).to eq("sub_new")
    end

    it "returns the row with the greater id when created_at ties" do
      insert_row(id: "00000000-0000-7000-8000-000000000001", stripe_subscription_id: "sub_low", status: "canceled", created_at: base_time)
      insert_row(id: "00000000-0000-7000-8000-000000000002", stripe_subscription_id: "sub_high", status: "active", created_at: base_time)

      expect(repo.find_by_account_id(account_id).stripe_subscription_id).to eq("sub_high")
    end

    it "returns nil when the account has no rows" do
      expect(repo.find_by_account_id(account_id)).to be_nil
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

    it "returns the active row when a newer canceled row exists" do
      base_time = Time.now - 3600
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_active", status: "active", created_at: base_time)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_canceled", status: "canceled", created_at: base_time + 60)

      expect(repo.find_active_by_account_id(account_id).stripe_subscription_id).to eq("sub_active")
    end

    it "returns the newest active row when several rows are active" do
      base_time = Time.now - 3600
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_first", status: "active", created_at: base_time)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_second", status: "trialing", created_at: base_time + 60)

      expect(repo.find_active_by_account_id(account_id).stripe_subscription_id).to eq("sub_second")
    end
  end

  describe "#list_uncanceled_by_account_id" do
    it "returns only rows whose status is not canceled" do
      base_time = Time.now - 3600
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_canceled", status: "canceled", created_at: base_time)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_active", status: "active", created_at: base_time + 60)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_past_due", status: "past_due", created_at: base_time + 120)

      rows = repo.list_uncanceled_by_account_id(account_id)

      expect(rows.map(&:stripe_subscription_id)).to contain_exactly("sub_active", "sub_past_due")
    end

    it "returns an empty array when every row is canceled" do
      upsert(status: "canceled")

      expect(repo.list_uncanceled_by_account_id(account_id)).to eq([])
    end

    it "ignores rows of other accounts" do
      upsert(status: "active")

      expect(repo.list_uncanceled_by_account_id(SecureRandom.uuid_v7)).to eq([])
    end
  end

  describe "#list_reconcilable_by_account_id" do
    let(:base_time) { Time.now - 3600 }

    it "returns uncanceled rows newest first and leaves out older canceled rows" do
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_old_canceled", status: "canceled", created_at: base_time)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_active", status: "active", created_at: base_time + 60)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_new_canceled", status: "canceled", created_at: base_time + 120)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_trialing", status: "trialing", created_at: base_time + 180)

      rows = repo.list_reconcilable_by_account_id(account_id)

      expect(rows.map(&:stripe_subscription_id)).to eq(%w[sub_trialing sub_active])
    end

    it "includes the newest row when it is canceled" do
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_active", status: "active", created_at: base_time)
      insert_row(id: SecureRandom.uuid_v7, stripe_subscription_id: "sub_canceled", status: "canceled", created_at: base_time + 60)

      rows = repo.list_reconcilable_by_account_id(account_id)

      expect(rows.map(&:stripe_subscription_id)).to eq(%w[sub_canceled sub_active])
    end

    it "returns the single row once when it is both uncanceled and newest" do
      upsert(status: "active")

      expect(repo.list_reconcilable_by_account_id(account_id).map(&:stripe_subscription_id)).to eq([sub_id])
    end

    it "returns an empty array when the account has no rows" do
      expect(repo.list_reconcilable_by_account_id(account_id)).to eq([])
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

  describe "#mark_cancel_at_period_end" do
    it "sets cancel_at_period_end on the matching row only" do
      upsert
      upsert(stripe_subscription_id: "sub_other")
      repo.mark_cancel_at_period_end(stripe_subscription_id: sub_id)

      expect(repo.find_by_stripe_subscription_id(sub_id).cancel_at_period_end).to be(true)
      expect(repo.find_by_stripe_subscription_id("sub_other").cancel_at_period_end).to be(false)
    end
  end
end
