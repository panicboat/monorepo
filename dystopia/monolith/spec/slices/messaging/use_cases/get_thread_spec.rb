# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::GetThread do
  let(:use_case) { described_class.new(messaging_repo: messaging_repo, send_restriction: send_restriction, get_profile: get_profile) }
  let(:messaging_repo)   { double(:messaging_repository, last_message: nil, unread_count: 0) }
  let(:send_restriction) { double(:send_restriction) }
  let(:get_profile)      { double(:get_profile) }

  let(:viewer_profile_id) { "viewer-1" }
  let(:counterpart_id) { "counterpart-1" }
  let(:counterpart) { double(:profile) }
  let(:thread) { double(:thread, id: "thread-1", profile_a: counterpart_id, profile_b: viewer_profile_id) }

  before do
    allow(messaging_repo).to receive(:find_thread).with(id: "thread-1").and_return(thread)
    allow(get_profile).to receive(:call).with(profile_id: counterpart_id).and_return(counterpart)
  end

  def get_thread(viewer: viewer_profile_id)
    use_case.call(thread_id: "thread-1", viewer_profile_id: viewer)
  end

  it "returns the thread with the other participant as the counterpart" do
    allow(send_restriction).to receive(:call).and_return(nil)

    result = get_thread

    expect(result[:row]).to eq(thread)
    expect(result[:counterpart]).to eq(counterpart)
    expect(result[:hidden_sender_profile_id]).to be_nil
  end

  it "reports what restricts the viewer from sending to the counterpart" do
    allow(send_restriction).to receive(:call).with(sender_profile_id: viewer_profile_id, recipient_profile_id: counterpart_id).and_return(:follow_required)

    expect(get_thread[:send_restriction]).to eq(:follow_required)
  end

  it "reports no restriction when the viewer may send" do
    allow(send_restriction).to receive(:call).with(sender_profile_id: viewer_profile_id, recipient_profile_id: counterpart_id).and_return(nil)

    expect(get_thread[:send_restriction]).to be_nil
  end

  it "reports :counterpart_unavailable and hides the counterpart when its profile is not visible" do
    allow(get_profile).to receive(:call).with(profile_id: counterpart_id).and_return(nil)
    expect(send_restriction).not_to receive(:call)

    result = get_thread

    expect(result[:send_restriction]).to eq(:counterpart_unavailable)
    expect(result[:counterpart]).to be_nil
    expect(result[:hidden_sender_profile_id]).to eq(counterpart_id)
  end

  it "raises ThreadNotFoundError for an unknown thread" do
    allow(messaging_repo).to receive(:find_thread).with(id: "thread-1").and_return(nil)

    expect { get_thread }.to raise_error(described_class::ThreadNotFoundError)
  end

  it "raises ForbiddenError for a viewer who is not a participant" do
    expect { get_thread(viewer: "outsider-1") }.to raise_error(described_class::ForbiddenError)
  end
end
