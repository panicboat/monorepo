# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::AuthorizeMessage do
  let(:use_case) { described_class.new(get_role: get_role, follow_repo: follow_repo) }
  let(:get_role)   { double(:get_role) }
  let(:follow_repo) { double(:follow_repository) }

  let(:sender_id) { "sender-1" }
  let(:recipient_id) { "recipient-1" }

  it "allows a cast sender without checking follow status" do
    allow(get_role).to receive(:call).with(profile_id: sender_id).and_return(2)
    expect(follow_repo).not_to receive(:find)

    expect(use_case.call(sender_id: sender_id, recipient_id: recipient_id)).to be(true)
  end

  it "allows a guest sender who approvedly follows the recipient" do
    allow(get_role).to receive(:call).with(profile_id: sender_id).and_return(1)
    allow(follow_repo).to receive(:find).with(follower_id: sender_id, followee_id: recipient_id)
      .and_return(double(:follow, status: "approved"))

    expect(use_case.call(sender_id: sender_id, recipient_id: recipient_id)).to be(true)
  end

  it "denies a guest sender who does not follow the recipient" do
    allow(get_role).to receive(:call).with(profile_id: sender_id).and_return(1)
    allow(follow_repo).to receive(:find).with(follower_id: sender_id, followee_id: recipient_id).and_return(nil)

    expect(use_case.call(sender_id: sender_id, recipient_id: recipient_id)).to be(false)
  end

  it "denies a guest sender whose follow request is still pending" do
    allow(get_role).to receive(:call).with(profile_id: sender_id).and_return(1)
    allow(follow_repo).to receive(:find).with(follower_id: sender_id, followee_id: recipient_id)
      .and_return(double(:follow, status: "pending"))

    expect(use_case.call(sender_id: sender_id, recipient_id: recipient_id)).to be(false)
  end
end
