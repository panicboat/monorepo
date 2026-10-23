# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::GetPushSubscriptionStatus, type: :database do
  let(:status) { Notifications::Slice["use_cases.get_push_subscription_status"] }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:account_id) { create_account }
  let(:profile_a) { create_account_with_profile(account_id: account_id) }
  let(:profile_b) { create_account_with_profile(account_id: account_id) }
  let(:endpoint) { "https://fcm.googleapis.com/fcm/send/device-1" }

  it "is true when the profile is registered on the endpoint" do
    subscriptions.upsert(account_id: account_id, profile_id: profile_a, endpoint: endpoint, p256dh: "BKey", auth: "auth")

    expect(status.call(profile_id: profile_a, endpoint: endpoint)).to be(true)
  end

  it "is false when only another profile is registered on the endpoint" do
    subscriptions.upsert(account_id: account_id, profile_id: profile_b, endpoint: endpoint, p256dh: "BKey", auth: "auth")

    expect(status.call(profile_id: profile_a, endpoint: endpoint)).to be(false)
  end
end
