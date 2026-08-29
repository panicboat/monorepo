# frozen_string_literal: true

require "spec_helper"
require "slices/billing/repositories/stripe_event_repository"

RSpec.describe Billing::Repositories::StripeEventRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:event_id) { "evt_#{SecureRandom.hex(8)}" }
  let(:payload) { { "id" => event_id, "type" => "customer.subscription.created" } }

  describe "#insert_received" do
    it "inserts a row with processed_at nil" do
      row = repo.insert_received(stripe_event_id: event_id, event_type: "customer.subscription.created", payload: payload)
      expect(row.stripe_event_id).to eq(event_id)
      expect(row.event_type).to eq("customer.subscription.created")
      expect(row.processed_at).to be_nil
      expect(row.error_message).to be_nil
    end

    it "raises when stripe_event_id duplicates (unique constraint)" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      expect {
        repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      }.to raise_error(Sequel::UniqueConstraintViolation)
    end
  end

  describe "#find_by_stripe_event_id" do
    it "returns nil when not found" do
      expect(repo.find_by_stripe_event_id("evt_missing")).to be_nil
    end

    it "returns row when it exists" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      expect(repo.find_by_stripe_event_id(event_id).stripe_event_id).to eq(event_id)
    end
  end

  describe "#mark_processed" do
    it "sets processed_at and clears error_message" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      repo.mark_failed(stripe_event_id: event_id, error_message: "boom")
      repo.mark_processed(stripe_event_id: event_id)
      row = repo.find_by_stripe_event_id(event_id)
      expect(row.processed_at).not_to be_nil
      expect(row.error_message).to be_nil
    end
  end

  describe "#mark_failed" do
    it "sets error_message and leaves processed_at nil" do
      repo.insert_received(stripe_event_id: event_id, event_type: "x", payload: payload)
      repo.mark_failed(stripe_event_id: event_id, error_message: "kaboom")
      row = repo.find_by_stripe_event_id(event_id)
      expect(row.error_message).to eq("kaboom")
      expect(row.processed_at).to be_nil
    end
  end
end
