# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::SendMessage do
  let(:use_case) { described_class.new(messaging_repo: messaging_repo, send_restriction: send_restriction, get_profile: get_profile) }
  let(:get_profile) { double(:get_profile, call: double(:profile)) }
  let(:messaging_repo)   { double(:messaging_repository) }
  let(:send_restriction) { double(:send_restriction) }

  let(:sender_profile_id) { "sender-1" }
  let(:recipient_profile_id) { "recipient-1" }

  def restrict(reason)
    allow(send_restriction).to receive(:call).with(sender_profile_id: sender_profile_id, recipient_profile_id: recipient_profile_id).and_return(reason)
  end

  it "raises FollowRequiredError when the sender must follow the recipient first" do
    restrict(:follow_required)

    expect {
      use_case.call(sender_profile_id: sender_profile_id, content: "hi", recipient_profile_id: recipient_profile_id)
    }.to raise_error(described_class::FollowRequiredError)
  end

  it "raises BlockedError when a block stands between the sender and the recipient" do
    restrict(:blocked)

    expect {
      use_case.call(sender_profile_id: sender_profile_id, content: "hi", recipient_profile_id: recipient_profile_id)
    }.to raise_error(described_class::BlockedError)
  end

  it "sends the message when nothing restricts the sender" do
    restrict(nil)
    thread = double(:thread, id: "thread-1", :[] => nil)
    message = double(:message, id: "message-1")
    allow(messaging_repo).to receive(:upsert_thread).with(profile_a: "recipient-1", profile_b: "sender-1").and_return(thread)
    allow(messaging_repo).to receive(:insert_message).with(thread_id: "thread-1", sender_profile_id: sender_profile_id, content: "hi").and_return(message)

    result = use_case.call(sender_profile_id: sender_profile_id, content: "hi", recipient_profile_id: recipient_profile_id)
    expect(result[:message]).to eq(message)
  end

  it "applies the restriction to the other participant when replying through a thread id" do
    restrict(:follow_required)
    allow(messaging_repo).to receive(:find_thread).with(id: "thread-1").and_return(double(:thread, profile_a: recipient_profile_id, profile_b: sender_profile_id))

    expect {
      use_case.call(sender_profile_id: sender_profile_id, content: "hi", thread_id: "thread-1")
    }.to raise_error(described_class::FollowRequiredError)
  end

  it "raises RecipientUnresolvedError for a recipient that is not visible, without checking the restriction" do
    allow(get_profile).to receive(:call).with(profile_id: recipient_profile_id).and_return(nil)
    expect(send_restriction).not_to receive(:call)

    expect {
      use_case.call(sender_profile_id: sender_profile_id, content: "hi", recipient_profile_id: recipient_profile_id)
    }.to raise_error(described_class::RecipientUnresolvedError)
  end
end
