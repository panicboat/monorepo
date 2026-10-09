# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/billing/grpc/billing_handler"

RSpec.describe Billing::Grpc::BillingHandler do
  describe "STATUS_MAP" do
    it "maps every status string to a proto enum value" do
      map = described_class.send(:const_get, :STATUS_MAP)
      %w[trialing active incomplete incomplete_expired past_due canceled unpaid paused].each do |status|
        expect(map[status]).not_to be_nil, "missing map entry for #{status}"
      end
    end
  end

  describe "#get_my_subscription" do
    let(:get_uc) { double(:get_my_subscription) }
    let(:handler) do
      described_class.new(
        method_key: :test,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: ::Billing::V1::GetMySubscriptionRequest.new,
        get_uc: get_uc,
        checkout_uc: double(:create_checkout_session),
        portal_uc: double(:create_customer_portal_session)
      )
    end

    after { Current.clear }

    it "looks up the subscription by the account, not by the active profile" do
      Current.account_id = "acc-1"
      Current.profile_id = "prof-1"
      expect(get_uc).to receive(:call).with(account_id: "acc-1").and_return(nil)

      handler.get_my_subscription
    end

    it "works for an account without an active profile" do
      Current.account_id = "acc-1"
      allow(get_uc).to receive(:call).with(account_id: "acc-1").and_return(nil)

      expect { handler.get_my_subscription }.not_to raise_error
    end

    it "raises UNAUTHENTICATED without an account" do
      expect { handler.get_my_subscription }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
      }
    end
  end
end
