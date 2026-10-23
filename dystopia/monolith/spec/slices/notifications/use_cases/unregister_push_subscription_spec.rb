# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::UnregisterPushSubscription, type: :database do
  let(:unregister) { Notifications::Slice["use_cases.unregister_push_subscription"] }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:account_id) { create_account }
  let(:profile_a) { create_account_with_profile(account_id: account_id) }
  let(:profile_b) { create_account_with_profile(account_id: account_id) }
  let(:endpoint) { "https://fcm.googleapis.com/fcm/send/device-1" }

  it "deletes the row of the profile and keeps the rows of other profiles on the same endpoint" do
    [profile_a, profile_b].each do |profile_id|
      subscriptions.upsert(account_id: account_id, profile_id: profile_id, endpoint: endpoint, p256dh: "BKey", auth: "auth")
    end

    unregister.call(profile_id: profile_a, endpoint: endpoint)

    expect(subscriptions.list_by_profile(profile_a)).to be_empty
    expect(subscriptions.list_by_profile(profile_b).map(&:endpoint)).to eq([endpoint])
  end
end
