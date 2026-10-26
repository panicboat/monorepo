# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::GetUnreadCount, type: :database do
  subject(:use_case) { Notifications::Slice["use_cases.get_unread_count"] }

  let(:repo) { Notifications::Slice["repositories.notification_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:recipient) { create_account_with_profile(username: "unread_recipient") }

  def notification_from(username, account_id: nil)
    actor = create_account_with_profile(username: username, account_id: account_id)
    repo.emit(recipient_profile_id: recipient, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: actor)
    actor
  end

  it "counts the unread rows" do
    notification_from("unread_actor_a")
    notification_from("unread_actor_b")

    expect(use_case.call(recipient_profile_id: recipient)).to eq(2)
  end

  it "does not count the rows of a disabled actor until the profile is shown again" do
    notification_from("unread_actor_a")
    disabled = notification_from("unread_actor_b")
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)

    expect(use_case.call(recipient_profile_id: recipient)).to eq(1)

    db[:profile__profiles].where(id: disabled).update(disabled_at: nil)

    expect(use_case.call(recipient_profile_id: recipient)).to eq(2)
  end

  it "does not count the rows of an actor whose account is deactivated" do
    notification_from("unread_actor_a")
    deactivated_account = create_account
    notification_from("unread_actor_b", account_id: deactivated_account)
    db[:identity__accounts].where(id: deactivated_account).update(deactivated_at: Time.now)

    expect(use_case.call(recipient_profile_id: recipient)).to eq(1)
  end

  it "does not count the rows already read" do
    notification_from("unread_actor_a")
    notification_from("unread_actor_b")
    repo.mark_all_read(recipient_profile_id: recipient)

    expect(use_case.call(recipient_profile_id: recipient)).to eq(0)
  end

  it "returns 0 when the recipient has no notification" do
    expect(use_case.call(recipient_profile_id: recipient)).to eq(0)
  end
end
