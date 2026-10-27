# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::ListNotifications, type: :database do
  subject(:use_case) { Notifications::Slice["use_cases.list_notifications"] }

  let(:repo) { Notifications::Slice["repositories.notification_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:recipient) { create_account_with_profile(username: "list_recipient") }

  def notification_from(username)
    actor = create_account_with_profile(username: username)
    repo.emit(recipient_profile_id: recipient, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: actor)
    actor
  end

  it "counts the unread rows of the actors that are shown and lists only their rows" do
    shown = notification_from("list_actor_a")
    disabled = notification_from("list_actor_b")
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)

    result = use_case.call(recipient_profile_id: recipient)

    expect(result[:unread_count]).to eq(1)
    expect(result[:rows].map(&:latest_actor_profile_id)).to eq([shown])
  end
end
