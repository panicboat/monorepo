# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/customer_repository"

RSpec.describe Billing::Repositories::CustomerRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:account_id) { SecureRandom.uuid_v7 }
  let(:stripe_customer_id) { "cus_test_#{SecureRandom.hex(8)}" }

  describe "#upsert_by_account_id" do
    it "creates a new row when account is new" do
      row = repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
      expect(row.account_id).to eq(account_id)
      expect(row.stripe_customer_id).to eq(stripe_customer_id)
      expect(row.id).not_to be_nil
    end

    it "updates stripe_customer_id when a row for account already exists" do
      repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: "cus_old")
      updated = repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: "cus_new")
      expect(updated.stripe_customer_id).to eq("cus_new")
      expect(repo.find_by_account_id(account_id).stripe_customer_id).to eq("cus_new")
    end
  end

  describe "#find_by_account_id" do
    it "returns nil when no row exists" do
      expect(repo.find_by_account_id(account_id)).to be_nil
    end

    it "returns the row when it exists" do
      repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
      row = repo.find_by_account_id(account_id)
      expect(row.stripe_customer_id).to eq(stripe_customer_id)
    end
  end

  describe "#find_by_stripe_customer_id" do
    it "returns the row when it exists" do
      repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
      row = repo.find_by_stripe_customer_id(stripe_customer_id)
      expect(row.account_id).to eq(account_id)
    end

    it "returns nil when not found" do
      expect(repo.find_by_stripe_customer_id("cus_missing")).to be_nil
    end
  end

  describe "#all" do
    it "returns every customer row" do
      3.times { |i| repo.upsert_by_account_id(account_id: SecureRandom.uuid_v7, stripe_customer_id: "cus_#{i}") }
      expect(repo.all.size).to eq(3)
    end
  end
end
