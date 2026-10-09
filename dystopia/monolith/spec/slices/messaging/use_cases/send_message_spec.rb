# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::SendMessage do
  let(:use_case) { described_class.new(messaging_repo: messaging_repo, authorize_message: authorize_message, get_profile: get_profile) }
  let(:get_profile) { double(:get_profile, call: double(:profile)) }
  let(:messaging_repo)    { double(:messaging_repository) }
  let(:authorize_message) { double(:authorize_message) }

  let(:sender_profile_id) { "sender-1" }
  let(:recipient_profile_id) { "recipient-1" }

  before do
    allow(use_case).to receive(:bidirectionally_blocked?).and_return(false)
    allow(use_case).to receive(:publish_message_event)
  end

  it "raises FollowRequiredError when AuthorizeMessage denies the sender" do
    allow(authorize_message).to receive(:call).with(sender_profile_id: sender_profile_id, recipient_profile_id: recipient_profile_id).and_return(false)

    expect {
      use_case.call(sender_profile_id: sender_profile_id, content: "hi", recipient_profile_id: recipient_profile_id)
    }.to raise_error(described_class::FollowRequiredError)
  end

  it "sends the message when AuthorizeMessage allows the sender" do
    allow(authorize_message).to receive(:call).with(sender_profile_id: sender_profile_id, recipient_profile_id: recipient_profile_id).and_return(true)
    thread = double(:thread, id: "thread-1", :[] => nil)
    message = double(:message, id: "message-1")
    allow(messaging_repo).to receive(:upsert_thread).with(profile_a: "recipient-1", profile_b: "sender-1").and_return(thread)
    allow(messaging_repo).to receive(:insert_message).with(thread_id: "thread-1", sender_profile_id: sender_profile_id, content: "hi").and_return(message)

    result = use_case.call(sender_profile_id: sender_profile_id, content: "hi", recipient_profile_id: recipient_profile_id)
    expect(result[:message]).to eq(message)
  end

  it "raises BlockedError before checking AuthorizeMessage when blocked" do
    allow(use_case).to receive(:bidirectionally_blocked?).and_return(true)
    expect(authorize_message).not_to receive(:call)

    expect {
      use_case.call(sender_profile_id: sender_profile_id, content: "hi", recipient_profile_id: recipient_profile_id)
    }.to raise_error(described_class::BlockedError)
  end
end
