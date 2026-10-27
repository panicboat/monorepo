# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::ListThreads, type: :database do
  subject(:use_case) { Messaging::Slice["use_cases.list_threads"] }

  let(:repo) { Messaging::Slice["repositories.messaging_repository"] }
  let(:owner) { create_account_with_profile(username: "threads_owner") }

  def thread_with(username, last_message_at: nil)
    other = create_account_with_profile(username: username)
    repo.upsert_thread(profile_a: [owner, other].min, profile_b: [owner, other].max).tap do |thread|
      repo.update_thread_last_message_at(thread_id: thread[:id], time: last_message_at) if last_message_at
    end
  end

  it "walks every thread one page at a time, including the ones without a message yet" do
    newer = thread_with("threads_newer", last_message_at: Time.now - 60)
    older = thread_with("threads_older", last_message_at: Time.now - 120)
    empty = thread_with("threads_empty")

    ids = []
    cursor = nil
    5.times do
      page = use_case.call(profile_id: owner, limit: 1, cursor: cursor)
      ids += page[:threads].map { |thread| thread[:row].id }
      break unless page[:has_more]

      cursor = page[:next_cursor]
    end

    expect(ids).to eq([newer[:id], older[:id], empty[:id]])
  end

  describe "unread counts when the counterpart is not visible to others" do
    let(:db) { Hanami.app["db.gateway"].connection }

    def thread_with_unread_message(username, account_id: nil)
      other = create_account_with_profile(username: username, account_id: account_id)
      thread = repo.upsert_thread(profile_a: [owner, other].min, profile_b: [owner, other].max)
      repo.insert_message(thread_id: thread[:id], sender_profile_id: other, content: "hello")
      [other, thread[:id]]
    end

    def unread_by_thread
      page = use_case.call(profile_id: owner)
      [page[:total_unread_count], page[:threads].to_h { |thread| [thread[:row].id, thread[:unread_count]] }]
    end

    it "counts a disabled counterpart's message in neither the total nor its thread, and counts it again once shown" do
      _visible, visible_thread = thread_with_unread_message("unread_visible")
      disabled, disabled_thread = thread_with_unread_message("unread_disabled")
      db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)

      expect(unread_by_thread).to eq([1, { visible_thread => 1, disabled_thread => 0 }])

      db[:profile__profiles].where(id: disabled).update(disabled_at: nil)

      expect(unread_by_thread).to eq([2, { visible_thread => 1, disabled_thread => 1 }])
    end

    it "counts a deactivated account's message in neither the total nor its thread" do
      _visible, visible_thread = thread_with_unread_message("unread_visible")
      deactivated_account = create_account
      _deactivated, deactivated_thread = thread_with_unread_message("unread_deactivated", account_id: deactivated_account)
      db[:identity__accounts].where(id: deactivated_account).update(deactivated_at: Time.now)

      expect(unread_by_thread).to eq([1, { visible_thread => 1, deactivated_thread => 0 }])
    end
  end
end
