# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::GetOrCreateThread do
  let(:use_case) { described_class.new(messaging_repo: messaging_repo, send_restriction: send_restriction, get_profile: get_profile) }
  let(:get_profile) { double(:get_profile, call: double(:profile)) }
  let(:messaging_repo)   { double(:messaging_repository) }
  let(:send_restriction) { double(:send_restriction) }

  let(:viewer_profile_id) { "viewer-1" }
  let(:recipient_profile_id) { "recipient-1" }

  def restrict(reason)
    allow(send_restriction).to receive(:call).with(sender_profile_id: viewer_profile_id, recipient_profile_id: recipient_profile_id).and_return(reason)
  end

  it "raises FollowRequiredError when the viewer must follow the recipient first" do
    restrict(:follow_required)

    expect {
      use_case.call(viewer_profile_id: viewer_profile_id, recipient_profile_id: recipient_profile_id)
    }.to raise_error(described_class::FollowRequiredError)
  end

  it "raises BlockedError when a block stands between the viewer and the recipient" do
    restrict(:blocked)

    expect {
      use_case.call(viewer_profile_id: viewer_profile_id, recipient_profile_id: recipient_profile_id)
    }.to raise_error(described_class::BlockedError)
  end

  it "creates the thread when nothing restricts the viewer" do
    restrict(nil)
    thread_row = double(:thread_row, id: "thread-1", :[] => nil)
    allow(messaging_repo).to receive(:upsert_thread).with(profile_a: "recipient-1", profile_b: "viewer-1").and_return(thread_row)
    allow(messaging_repo).to receive(:last_message).with(thread_id: "thread-1").and_return(nil)
    allow(messaging_repo).to receive(:unread_count).with(thread_id: "thread-1", profile_id: viewer_profile_id).and_return(0)

    result = use_case.call(viewer_profile_id: viewer_profile_id, recipient_profile_id: recipient_profile_id)
    expect(result[:row]).to eq(thread_row)
  end
end
