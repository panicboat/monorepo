# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/notifications/grpc/notification_handler"

RSpec.describe "Notification preferences RPCs", type: :database do
  let(:profile_id) { create_account_with_profile(username: "prefs_owner") }

  def rpc(method, message)
    Notifications::Grpc::NotificationHandler.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  before do
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  after { Current.clear }

  it "saves and returns the comment preference with the remaining fields" do
    input = Notifications::V1::NotificationPreferences.new(
      comment: false, like: true, reply: false, follow: true,
      mention: false, message: true, footprint_unread_badge: false, footprints_record_my_visits: true
    )

    saved = rpc(:update_notification_preferences, Notifications::V1::UpdateNotificationPreferencesRequest.new(preferences: input)).preferences
    fetched = rpc(:get_notification_preferences, Notifications::V1::GetNotificationPreferencesRequest.new).preferences

    expect(saved).to eq(input)
    expect(fetched).to eq(input)
    expect(fetched.to_h).not_to have_key(:push_enabled)
  end

  it "returns every preference turned on for a profile that has saved none" do
    fetched = rpc(:get_notification_preferences, Notifications::V1::GetNotificationPreferencesRequest.new).preferences

    expect(fetched.to_h.values).to all(be(true))
    expect(fetched.to_h.keys).to contain_exactly(
      :comment, :like, :reply, :follow, :mention, :message, :footprint_unread_badge, :footprints_record_my_visits
    )
  end
end
