# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::PurgeProfile do
  let(:use_case) { described_class.new(notification_repo: notification_repo) }
  let(:notification_repo) { double(:notification_repository) }

  it "deletes notifications (recipient or latest_actor) and preferences for the profile" do
    expect(notification_repo).to receive(:delete_notifications_by_profile).with("cast-1")
    expect(notification_repo).to receive(:delete_preferences_by_profile).with("cast-1")
    use_case.call(profile_id: "cast-1")
  end
end
