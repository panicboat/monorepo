# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::RegisterPushSubscription, type: :database do
  let(:register) { Notifications::Slice["use_cases.register_push_subscription"] }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:account_id) { create_account }
  let(:profile_id) { create_account_with_profile(account_id: account_id) }
  let(:endpoint) { "https://fcm.googleapis.com/fcm/send/device-1" }

  it "stores a subscription for the profile" do
    register.call(account_id: account_id, profile_id: profile_id, endpoint: endpoint, p256dh: "BKey", auth: "auth")

    expect(subscriptions.list_by_profile(profile_id).map { |row| [row.account_id, row.endpoint] }).to eq([[account_id, endpoint]])
  end

  it "rejects an endpoint outside the known push services without storing anything" do
    expect do
      register.call(account_id: account_id, profile_id: profile_id, endpoint: "https://evil.example/a", p256dh: "BKey", auth: "auth")
    end.to raise_error(described_class::InvalidSubscriptionError)

    expect(subscriptions.list_by_profile(profile_id)).to be_empty
  end
end
