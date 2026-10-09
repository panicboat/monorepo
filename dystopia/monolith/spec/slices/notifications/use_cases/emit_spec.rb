# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Notifications::UseCases::Emit", type: :database do
  let(:use_case) { Hanami.app.slices[:notifications]["use_cases.emit"] }
  let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
  let(:update_preferences) { Hanami.app.slices[:notifications]["use_cases.update_preferences"] }

  let(:recipient_profile_id) { SecureRandom.uuid_v7 }
  let(:actor_profile_id) { SecureRandom.uuid_v7 }
  let(:target_resource_id) { SecureRandom.uuid_v7 }

  it "emits a mention notification by default" do
    result = use_case.call(
      recipient_profile_id: recipient_profile_id,
      type: "mention",
      target_resource_id: target_resource_id,
      actor_profile_id: actor_profile_id
    )

    expect(result).not_to be_nil
    expect(notification_repo.list(recipient_profile_id: recipient_profile_id).first.type).to eq("mention")
  end

  it "does not emit a mention notification when the recipient disabled it" do
    preferences = Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES.merge(mention: false)
    update_preferences.call(profile_id: recipient_profile_id, preferences: preferences)

    result = use_case.call(
      recipient_profile_id: recipient_profile_id,
      type: "mention",
      target_resource_id: target_resource_id,
      actor_profile_id: actor_profile_id
    )

    expect(result).to be_nil
    expect(notification_repo.list(recipient_profile_id: recipient_profile_id)).to eq([])
  end
end
