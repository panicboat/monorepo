# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::User::PurgeDeactivatedAccounts do
  let(:use_case) do
    described_class.new(
      user_repo: user_repo,
      purge_notifications: purge_notifications,
      purge_footprints: purge_footprints,
      purge_bookmarks: purge_bookmarks,
      purge_karte: purge_karte,
      purge_messaging: purge_messaging,
      purge_social: purge_social,
      purge_post: purge_post,
      purge_media: purge_media,
      purge_profile: purge_profile,
      purge_identity: purge_identity,
      logger: logger
    )
  end
  let(:user_repo) { double(:user_repository) }
  let(:purge_notifications) { double(:purge, call: nil) }
  let(:purge_footprints) { double(:purge, call: nil) }
  let(:purge_bookmarks) { double(:purge, call: nil) }
  let(:purge_karte) { double(:purge, call: nil) }
  let(:purge_messaging) { double(:purge, call: nil) }
  let(:purge_social) { double(:purge, call: nil) }
  let(:purge_post) { double(:purge, call: nil) }
  let(:purge_media) { double(:purge, call: nil) }
  let(:purge_profile) { double(:purge, call: nil) }
  let(:purge_identity) { double(:purge_identity, call: nil) }
  let(:logger) { double(:logger, info: nil, error: nil) }

  let(:now) { Time.now }

  it "calls each slice's purge in the spec's order for every eligible user" do
    user_a = double(:user, id: "user-a")
    user_b = double(:user, id: "user-b")
    allow(user_repo).to receive(:list_deactivated_before).and_return([user_a, user_b])

    [user_a, user_b].each do |u|
      expect(purge_notifications).to receive(:call).with(account_id: u.id).ordered
      expect(purge_footprints).to receive(:call).with(account_id: u.id).ordered
      expect(purge_bookmarks).to receive(:call).with(account_id: u.id).ordered
      expect(purge_karte).to receive(:call).with(account_id: u.id).ordered
      expect(purge_messaging).to receive(:call).with(account_id: u.id).ordered
      expect(purge_social).to receive(:call).with(account_id: u.id).ordered
      expect(purge_post).to receive(:call).with(account_id: u.id).ordered
      expect(purge_media).to receive(:call).with(account_id: u.id).ordered
      expect(purge_profile).to receive(:call).with(account_id: u.id).ordered
      expect(purge_identity).to receive(:call).with(account_id: u.id).ordered
    end

    use_case.call(now: now)
  end

  it "uses now - 30 days as the cutoff" do
    expect(user_repo).to receive(:list_deactivated_before).with(now - 30 * 24 * 3600).and_return([])
    use_case.call(now: now)
  end

  it "continues to the next user when one user's purge raises" do
    user_a = double(:user, id: "user-a")
    user_b = double(:user, id: "user-b")
    allow(user_repo).to receive(:list_deactivated_before).and_return([user_a, user_b])

    allow(purge_notifications).to receive(:call).with(account_id: "user-a").and_raise("boom")
    allow(logger).to receive(:error)

    expect(purge_notifications).to receive(:call).with(account_id: "user-b") # second user still attempted
    expect(logger).to receive(:error).with(/user-a/)

    expect { use_case.call(now: now) }.not_to raise_error
  end
end
