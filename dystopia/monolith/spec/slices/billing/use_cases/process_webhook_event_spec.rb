# frozen_string_literal: true

require "spec_helper"
require "slices/billing/use_cases/process_webhook_event"

RSpec.describe Billing::UseCases::ProcessWebhookEvent, type: :database do
  subject(:use_case) do
    described_class.new(
      stripe_event_repo: stripe_event_repo,
      customer_repo: customer_repo,
      subscription_repo: subscription_repo
    )
  end

  let(:stripe_event_repo) { Billing::Repositories::StripeEventRepository.new }
  let(:customer_repo) { Billing::Repositories::CustomerRepository.new }
  let(:subscription_repo) { Billing::Repositories::SubscriptionRepository.new }

  let(:account_id) { SecureRandom.uuid_v7 }
  let(:stripe_customer_id) { "cus_1" }
  let(:stripe_subscription_id) { "sub_1" }
  let(:period_end) { Time.now + 3600 }

  before do
    customer_repo.upsert_by_account_id(account_id: account_id, stripe_customer_id: stripe_customer_id)
  end

  def make_event(type, subscription_status: "active", cancel_at_period_end: false, canceled_at: nil, price_id: "price_g")
    OpenStruct.new(
      id: "evt_#{SecureRandom.hex(6)}",
      type: type,
      data: OpenStruct.new(object: OpenStruct.new(
        id: stripe_subscription_id,
        customer: stripe_customer_id,
        status: subscription_status,
        cancel_at_period_end: cancel_at_period_end,
        canceled_at: canceled_at,
        items: OpenStruct.new(data: [OpenStruct.new(
          current_period_end: period_end.to_i,
          price: OpenStruct.new(id: price_id)
        )])
      )),
      to_hash: { "id" => "evt_x", "type" => type }
    )
  end

  describe "customer.subscription.created" do
    it "upserts subscription and marks event processed" do
      event = make_event("customer.subscription.created", subscription_status: "trialing")

      expect(use_case.call(event: event)).to eq(:processed)

      sub = subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
      expect(sub.status).to eq("trialing")
      expect(sub.account_id).to eq(account_id)
      expect(stripe_event_repo.find_by_stripe_event_id(event.id).processed_at).not_to be_nil
    end
  end

  describe "customer.subscription.updated" do
    it "updates status to past_due" do
      use_case.call(event: make_event("customer.subscription.created", subscription_status: "active"))
      use_case.call(event: make_event("customer.subscription.updated", subscription_status: "past_due"))

      expect(subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id).status).to eq("past_due")
    end
  end

  describe "customer.subscription.deleted" do
    it "marks subscription canceled" do
      use_case.call(event: make_event("customer.subscription.created"))
      use_case.call(event: make_event("customer.subscription.deleted"))

      sub = subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
      expect(sub.status).to eq("canceled")
      expect(sub.canceled_at).not_to be_nil
    end

    it "creates a canceled sentinel when deleted arrives before created and preserves it" do
      use_case.call(event: make_event("customer.subscription.deleted"))
      use_case.call(event: make_event("customer.subscription.created", subscription_status: "active"))

      sub = subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
      expect(sub.status).to eq("canceled")
      expect(sub.canceled_at).not_to be_nil
    end
  end

  describe "out-of-order: updated after deleted" do
    it "keeps status canceled (canceled is terminal)" do
      use_case.call(event: make_event("customer.subscription.created"))
      use_case.call(event: make_event("customer.subscription.deleted"))
      use_case.call(event: make_event("customer.subscription.updated", subscription_status: "active"))

      expect(subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id).status).to eq("canceled")
    end
  end

  describe "dedupe" do
    it "returns :duplicate on the second call with the same event id" do
      event = make_event("customer.subscription.created")
      use_case.call(event: event)

      expect(use_case.call(event: event)).to eq(:duplicate)
    end
  end

  describe "unhandled event type" do
    it "returns :ignored and marks processed" do
      event = OpenStruct.new(
        id: "evt_x1", type: "invoice.upcoming",
        data: OpenStruct.new(object: OpenStruct.new),
        to_hash: { "id" => "evt_x1", "type" => "invoice.upcoming" }
      )

      expect(use_case.call(event: event)).to eq(:ignored)
      expect(stripe_event_repo.find_by_stripe_event_id("evt_x1").processed_at).not_to be_nil
    end
  end

  describe "handler failure" do
    it "leaves processed_at nil and records error_message, then re-raises" do
      allow(subscription_repo).to receive(:upsert_by_stripe_id).and_raise(StandardError, "boom")
      event = make_event("customer.subscription.created")

      expect { use_case.call(event: event) }.to raise_error(StandardError, "boom")

      row = stripe_event_repo.find_by_stripe_event_id(event.id)
      expect(row.processed_at).to be_nil
      expect(row.error_message).to include("boom")
    end
  end
end
