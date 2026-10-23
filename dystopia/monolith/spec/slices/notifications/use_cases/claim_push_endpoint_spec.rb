# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::ClaimPushEndpoint, type: :database do
  let(:claim) { Notifications::Slice["use_cases.claim_push_endpoint"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:account_id) { create_account }
  let(:other_account_id) { create_account }
  let(:profile_id) { create_account_with_profile(account_id: account_id) }
  let(:other_profile_id) { create_account_with_profile(account_id: other_account_id) }
  let(:endpoint) { "https://fcm.googleapis.com/fcm/send/device-1" }

  it "deletes the rows of other accounts on the endpoint and keeps the rows of the account" do
    subscriptions.upsert(account_id: account_id, profile_id: profile_id, endpoint: endpoint, p256dh: "BKey", auth: "auth")
    db[:notifications__push_subscriptions].insert(
      id: SecureRandom.uuid_v7, account_id: other_account_id, profile_id: other_profile_id, endpoint: endpoint, p256dh: "BKey", auth: "auth"
    )

    claim.call(account_id: account_id, endpoint: endpoint)

    expect(subscriptions.list_by_profile(other_profile_id)).to be_empty
    expect(subscriptions.list_by_profile(profile_id).map(&:endpoint)).to eq([endpoint])
  end
end
