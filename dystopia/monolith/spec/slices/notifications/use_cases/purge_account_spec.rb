# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::PurgeAccount, type: :database do
  let(:purge) { Notifications::Slice["use_cases.purge_account"] }
  let(:subscriptions) { Notifications::Slice["repositories.push_subscription_repository"] }
  let(:account_id) { create_account }
  let(:bystander_id) { create_account }

  it "deletes every subscription of the account and keeps the others" do
    subscriptions.upsert(account_id: account_id, endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth")
    subscriptions.upsert(account_id: account_id, endpoint: "https://web.push.apple.com/b", p256dh: "BKey", auth: "auth")
    subscriptions.upsert(account_id: bystander_id, endpoint: "https://fcm.googleapis.com/fcm/send/c", p256dh: "BKey", auth: "auth")

    purge.call(account_id: account_id)

    expect(subscriptions.list_by_account(account_id)).to be_empty
    expect(subscriptions.list_by_account(bystander_id).map(&:endpoint)).to eq(["https://fcm.googleapis.com/fcm/send/c"])
  end
end
