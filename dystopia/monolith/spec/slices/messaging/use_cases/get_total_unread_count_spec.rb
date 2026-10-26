# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::GetTotalUnreadCount, type: :database do
  subject(:use_case) { Messaging::Slice["use_cases.get_total_unread_count"] }

  let(:repo) { Messaging::Slice["repositories.messaging_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:owner) { create_account_with_profile(username: "total_unread_owner") }

  def message_from(username, account_id: nil)
    sender = create_account_with_profile(username: username, account_id: account_id)
    thread = repo.upsert_thread(profile_a: [owner, sender].min, profile_b: [owner, sender].max)
    repo.insert_message(thread_id: thread[:id], sender_profile_id: sender, content: "hello")
    sender
  end

  it "sums the unread messages across the threads" do
    message_from("total_unread_a")
    message_from("total_unread_b")

    expect(use_case.call(profile_id: owner)).to eq(2)
  end

  it "does not count the messages of a disabled sender until the profile is shown again" do
    message_from("total_unread_a")
    disabled = message_from("total_unread_b")
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)

    expect(use_case.call(profile_id: owner)).to eq(1)

    db[:profile__profiles].where(id: disabled).update(disabled_at: nil)

    expect(use_case.call(profile_id: owner)).to eq(2)
  end

  it "does not count the messages of a sender whose account is deactivated" do
    message_from("total_unread_a")
    deactivated_account = create_account
    message_from("total_unread_b", account_id: deactivated_account)
    db[:identity__accounts].where(id: deactivated_account).update(deactivated_at: Time.now)

    expect(use_case.call(profile_id: owner)).to eq(1)
  end

  it "does not count the messages left in a thread whose other participant was deleted" do
    message_from("total_unread_a")
    deleted = message_from("total_unread_b")
    repo.null_out_sender(deleted)
    repo.null_out_thread_participants(deleted)

    expect(use_case.call(profile_id: owner)).to eq(1)
  end

  it "returns 0 when the viewer has no thread" do
    expect(use_case.call(profile_id: owner)).to eq(0)
  end

  it "returns 0 without a viewer" do
    expect(use_case.call(profile_id: nil)).to eq(0)
  end
end
