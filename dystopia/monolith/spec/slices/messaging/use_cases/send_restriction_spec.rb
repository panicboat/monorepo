# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::SendRestriction do
  let(:use_case) { described_class.new(authorize_message: authorize_message, block_repo: block_repo) }
  let(:authorize_message) { double(:authorize_message) }
  let(:block_repo) { double(:block_repository, blocked?: false) }

  let(:sender_profile_id) { "sender-1" }
  let(:recipient_profile_id) { "recipient-1" }

  def restriction
    use_case.call(sender_profile_id: sender_profile_id, recipient_profile_id: recipient_profile_id)
  end

  it "is nil when nothing blocks the pair and AuthorizeMessage allows the sender" do
    allow(authorize_message).to receive(:call).with(sender_profile_id: sender_profile_id, recipient_profile_id: recipient_profile_id).and_return(true)

    expect(restriction).to be_nil
  end

  it "is :follow_required when AuthorizeMessage denies the sender" do
    allow(authorize_message).to receive(:call).with(sender_profile_id: sender_profile_id, recipient_profile_id: recipient_profile_id).and_return(false)

    expect(restriction).to eq(:follow_required)
  end

  it "is :blocked when the sender blocks the recipient, without consulting AuthorizeMessage" do
    allow(block_repo).to receive(:blocked?).with(blocker_profile_id: sender_profile_id, blocked_profile_id: recipient_profile_id).and_return(true)
    expect(authorize_message).not_to receive(:call)

    expect(restriction).to eq(:blocked)
  end

  it "is :blocked when the recipient blocks the sender, without consulting AuthorizeMessage" do
    allow(block_repo).to receive(:blocked?).with(blocker_profile_id: recipient_profile_id, blocked_profile_id: sender_profile_id).and_return(true)
    expect(authorize_message).not_to receive(:call)

    expect(restriction).to eq(:blocked)
  end
end
