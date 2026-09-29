# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::GetOrCreateThread do
  let(:use_case) { described_class.new(messaging_repo: messaging_repo, authorize_message: authorize_message) }
  let(:messaging_repo)   { double(:messaging_repository) }
  let(:authorize_message) { double(:authorize_message) }

  let(:viewer_id) { "viewer-1" }
  let(:recipient_id) { "recipient-1" }

  before do
    allow(use_case).to receive(:bidirectionally_blocked?).and_return(false)
  end

  it "raises FollowRequiredError when AuthorizeMessage denies the sender" do
    allow(authorize_message).to receive(:call).with(sender_id: viewer_id, recipient_id: recipient_id).and_return(false)

    expect {
      use_case.call(viewer_id: viewer_id, recipient_account_id: recipient_id)
    }.to raise_error(described_class::FollowRequiredError)
  end

  it "creates the thread when AuthorizeMessage allows the sender" do
    allow(authorize_message).to receive(:call).with(sender_id: viewer_id, recipient_id: recipient_id).and_return(true)
    allow(use_case).to receive(:get_profile).and_return(double(:get_profile, call: double(:profile)))
    thread_row = double(:thread_row, id: "thread-1", :[] => nil)
    allow(messaging_repo).to receive(:upsert_thread).with(account_a: "recipient-1", account_b: "viewer-1").and_return(thread_row)
    allow(messaging_repo).to receive(:last_message).with(thread_id: "thread-1").and_return(nil)
    allow(messaging_repo).to receive(:unread_count).with(thread_id: "thread-1", account_id: viewer_id).and_return(0)

    result = use_case.call(viewer_id: viewer_id, recipient_account_id: recipient_id)
    expect(result[:row]).to eq(thread_row)
  end

  it "raises BlockedError before checking AuthorizeMessage when blocked" do
    allow(use_case).to receive(:bidirectionally_blocked?).and_return(true)
    expect(authorize_message).not_to receive(:call)

    expect {
      use_case.call(viewer_id: viewer_id, recipient_account_id: recipient_id)
    }.to raise_error(described_class::BlockedError)
  end
end
