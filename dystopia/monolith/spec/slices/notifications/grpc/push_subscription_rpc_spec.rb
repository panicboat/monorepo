# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/notifications/grpc/notification_handler"

RSpec.describe "Push subscription RPCs", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:account_id) { create_account }
  let(:other_account_id) { create_account }
  let(:profile_id) { create_account_with_profile(account_id: account_id) }
  let(:second_profile_id) { create_account_with_profile(account_id: account_id) }
  let(:other_profile_id) { create_account_with_profile(account_id: other_account_id) }
  let(:endpoint) { "https://fcm.googleapis.com/fcm/send/device-1" }

  def rpc(method, message, **deps)
    Notifications::Grpc::NotificationHandler.new(
      method_key: method, service: double, rpc_desc: double, active_call: double, message: message, **deps
    ).public_send(method)
  end

  def act_as_account(id)
    Current.account_id = id
    Current.profile_id = nil
  end

  def act_as(account, profile)
    Current.account_id = account
    Current.profile_id = profile
  end

  def register(endpoint: self.endpoint, p256dh: "BNcRdreALRFX", auth: "tBHItJI5svbpez7KI4CCXg")
    rpc(:register_push_subscription, Notifications::V1::RegisterPushSubscriptionRequest.new(endpoint: endpoint, p256dh: p256dh, auth: auth))
  end

  def unregister(endpoint: self.endpoint)
    rpc(:unregister_push_subscription, Notifications::V1::UnregisterPushSubscriptionRequest.new(endpoint: endpoint))
  end

  def status(endpoint: self.endpoint)
    rpc(:get_push_subscription_status, Notifications::V1::GetPushSubscriptionStatusRequest.new(endpoint: endpoint)).subscribed
  end

  def claim(endpoint: self.endpoint)
    rpc(:claim_push_endpoint, Notifications::V1::ClaimPushEndpointRequest.new(endpoint: endpoint))
  end

  def rows
    db[:notifications__push_subscriptions].order(:created_at).select_map(%i[account_id profile_id endpoint p256dh auth])
  end

  def invalid_argument
    raise_error(GRPC::BadStatus) { |error| expect(error.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT) }
  end

  after { Current.clear }

  it "returns the VAPID public key, or an empty one when push is not configured" do
    act_as_account(account_id)
    request = Notifications::V1::GetPushConfigRequest.new

    expect(rpc(:get_push_config, request, web_push_sender: double(:sender, public_key: "BPublicKey")).vapid_public_key).to eq("BPublicKey")
    expect(rpc(:get_push_config, request, web_push_sender: double(:sender, public_key: nil)).vapid_public_key).to eq("")
  end

  it "registers a subscription for the acting profile" do
    act_as(account_id, profile_id)

    register

    expect(rows).to eq([[account_id, profile_id, endpoint, "BNcRdreALRFX", "tBHItJI5svbpez7KI4CCXg"]])
  end

  it "keeps a row per profile on an endpoint and gives the endpoint to the account that registered it last with the latest keys" do
    act_as(account_id, profile_id)
    register
    register(p256dh: "BRotated", auth: "rotatedAuth")
    act_as(account_id, second_profile_id)
    register(p256dh: "BSecond", auth: "secondAuth")
    act_as(other_account_id, other_profile_id)
    register(p256dh: "BOther", auth: "otherAuth")

    expect(rows).to eq([[other_account_id, other_profile_id, endpoint, "BOther", "otherAuth"]])
  end

  it "accepts each known push service" do
    act_as(account_id, profile_id)
    %w[
      https://fcm.googleapis.com/fcm/send/a
      https://web.push.apple.com/b
      https://api.push.apple.com/c
      https://updates.push.services.mozilla.com/wpush/v2/d
      https://wns2-par02p.notify.windows.com/w/?token=e
    ].each { |url| register(endpoint: url) }

    expect(rows.length).to eq(5)
  end

  it "rejects endpoints outside the known push services and malformed keys" do
    act_as(account_id, profile_id)
    [
      "http://fcm.googleapis.com/fcm/send/a",
      "https://evil.example/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.example/a",
      "https://169.254.169.254/latest",
      "https://fcm.googleapis.com:8443/a",
      "https://user@fcm.googleapis.com/a",
      "https://fcm.googleapis.com/#{'a' * 2048}",
      "not a url"
    ].each { |url| expect { register(endpoint: url) }.to invalid_argument }
    expect { register(p256dh: "") }.to invalid_argument
    expect { register(auth: "bad key!") }.to invalid_argument

    expect(rows).to be_empty
  end

  it "unregisters only the acting profile's subscription" do
    act_as(account_id, profile_id)
    register
    act_as(account_id, second_profile_id)
    register

    unregister

    expect(rows.map { |row| row[1] }).to eq([profile_id])
  end

  it "reports whether the acting profile is registered on the endpoint" do
    act_as(account_id, profile_id)
    register

    expect(status).to be(true)
    expect(status(endpoint: "https://fcm.googleapis.com/fcm/send/device-2")).to be(false)
    act_as(account_id, second_profile_id)
    expect(status).to be(false)
  end

  it "deletes the rows of other accounts on the endpoint when an account claims it" do
    act_as(account_id, profile_id)
    register
    act_as(other_account_id, other_profile_id)
    register(endpoint: "https://fcm.googleapis.com/fcm/send/device-2")

    act_as_account(other_account_id)
    claim

    expect(rows.map { |row| row[1] }).to eq([other_profile_id])
  end

  it "requires an active profile to register" do
    act_as_account(account_id)

    expect { register }.to raise_error(GRPC::BadStatus) { |error| expect(error.code).to eq(GRPC::Core::StatusCodes::FAILED_PRECONDITION) }
  end

  it "requires a signed-in account" do
    Current.clear

    expect { register }.to raise_error(GRPC::BadStatus) { |error| expect(error.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED) }
    expect { claim }.to raise_error(GRPC::BadStatus) { |error| expect(error.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED) }
  end
end
