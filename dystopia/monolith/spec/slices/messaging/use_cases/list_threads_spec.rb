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
end
