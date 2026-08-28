# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Billing slice container resolution" do
  it "resolves adapters.stripe_client without raising" do
    expect { Billing::Slice["adapters.stripe_client"] }.not_to raise_error
    client = Billing::Slice["adapters.stripe_client"]
    expect(client).to be_a(Billing::Adapters::StripeClient)
  end

  it "resolves use_cases.get_my_subscription" do
    expect { Billing::Slice["use_cases.get_my_subscription"] }.not_to raise_error
  end

  it "resolves use_cases.create_checkout_session" do
    expect { Billing::Slice["use_cases.create_checkout_session"] }.not_to raise_error
  end

  it "resolves use_cases.create_customer_portal_session" do
    expect { Billing::Slice["use_cases.create_customer_portal_session"] }.not_to raise_error
  end

  it "resolves use_cases.process_webhook_event" do
    expect { Billing::Slice["use_cases.process_webhook_event"] }.not_to raise_error
  end

  it "resolves plan_registry" do
    expect { Billing::Slice["plan_registry"] }.not_to raise_error
    expect(Billing::Slice["plan_registry"]).to be_a(Billing::PlanRegistry)
  end

  it "resolves each repository" do
    %w[customer_repository subscription_repository stripe_event_repository].each do |key|
      expect { Billing::Slice["repositories.#{key}"] }.not_to raise_error
    end
  end

  it "loads Billing::Grpc::BillingHandler when stubs/ is on $LOAD_PATH (matches bin/grpc)" do
    # bin/grpc prepends stubs/ before requiring the handler.
    stubs_path = File.expand_path("../../../../stubs", __dir__)
    $LOAD_PATH.unshift(stubs_path) unless $LOAD_PATH.include?(stubs_path)
    expect { require "slices/billing/grpc/billing_handler" }.not_to raise_error
    expect(defined?(::Billing::Grpc::BillingHandler)).to eq("constant")
  end

  it "the handler binds to the generated service class" do
    # Loading the generated service validates its nested service_pb require.
    stubs_path = File.expand_path("../../../../stubs", __dir__)
    $LOAD_PATH.unshift(stubs_path) unless $LOAD_PATH.include?(stubs_path)
    require "slices/billing/grpc/billing_handler"
    expect(::Billing::V1::BillingService::Service.rpc_descs.keys).to include(:GetMySubscription)
  end
end
