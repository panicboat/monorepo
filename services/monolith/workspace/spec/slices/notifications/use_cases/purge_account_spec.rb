# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(notification_repo: notification_repo) }
  let(:notification_repo) { double(:notification_repository) }

  it "deletes notifications (recipient or latest_actor) and preferences for the account" do
    expect(notification_repo).to receive(:delete_notifications_by_account).with("cast-1")
    expect(notification_repo).to receive(:delete_preferences_by_account).with("cast-1")
    use_case.call(account_id: "cast-1")
  end
end
