# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::Emit, type: :database do
  let(:send_push) { double(:send_push, call: nil) }
  let(:use_case) { described_class.new(send_push: send_push) }
  let(:notification_repo) { Notifications::Slice["repositories.notification_repository"] }
  let(:update_preferences) { Notifications::Slice["use_cases.update_preferences"] }
  let(:defaults) { Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES }
  let(:recipient_profile_id) { create_account_with_profile }
  let(:actor_profile_id) { create_account_with_profile }
  let(:target_resource_id) { SecureRandom.uuid_v7 }

  def emit(type: "mention", **rest)
    use_case.call(recipient_profile_id: recipient_profile_id, type: type, target_resource_id: target_resource_id, actor_profile_id: actor_profile_id, **rest)
  end

  it "lists the notification even when the recipient turned that kind off for devices" do
    update_preferences.call(profile_id: recipient_profile_id, preferences: defaults.merge(mention: false))

    expect(emit).not_to be_nil
    expect(notification_repo.list(recipient_profile_id: recipient_profile_id).map(&:type)).to eq(["mention"])
  end

  it "hands the event to the device push with its post and text" do
    post_id = SecureRandom.uuid_v7

    emit(type: "reply", target_post_id: post_id, excerpt: "ありがとう")

    expect(send_push).to have_received(:call).with(
      recipient_profile_id: recipient_profile_id, kind: "reply", actor_profile_id: actor_profile_id, post_id: post_id, excerpt: "ありがとう"
    )
  end

  it "uses the liked post as the post of a like" do
    emit(type: "like")

    expect(send_push).to have_received(:call).with(hash_including(kind: "like", post_id: target_resource_id, excerpt: nil))
  end

  it "neither lists nor pushes a notification to oneself or from a blocked profile" do
    use_case.call(recipient_profile_id: recipient_profile_id, type: "like", target_resource_id: target_resource_id, actor_profile_id: recipient_profile_id)
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: recipient_profile_id, blocked_profile_id: actor_profile_id)
    emit

    expect(notification_repo.list(recipient_profile_id: recipient_profile_id)).to be_empty
    expect(send_push).not_to have_received(:call)
  end
end
