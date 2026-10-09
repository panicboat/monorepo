# frozen_string_literal: true

require "spec_helper"

RSpec.describe Profile::UseCases::PurgeProfile, type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }
  let(:account_id) { create_account(role: 2) }
  let(:purged) { create_account_with_profile(account_id: account_id) }
  let(:sibling) { create_account_with_profile(account_id: account_id) }

  before do
    cast_repo.create(profile_id: purged)
    cast_repo.create(profile_id: sibling)
  end

  it "purges every slice for the profile, then deletes its cast and profile rows and keeps the account's other profile" do
    first = double(:slice_purge)
    second = double(:slice_purge)
    expect(first).to receive(:call).with(profile_id: purged).ordered
    expect(second).to receive(:call).with(profile_id: purged).ordered

    expect(described_class.new(slice_purges: [first, second]).call(profile_id: purged)).to be_nil

    expect(repo.find_by_id(purged)).to be_nil
    expect(cast_repo.find_by_profile_id(purged)).to be_nil
    expect(repo.find_by_id(sibling)).not_to be_nil
    expect(cast_repo.find_by_profile_id(sibling)).not_to be_nil
  end

  it "undoes the slices already purged and keeps the profile when a later slice fails" do
    earlier = double(:slice_purge)
    failing = double(:slice_purge)
    later = double(:slice_purge)
    allow(earlier).to receive(:call) { cast_repo.delete_by_profile_ids([sibling]) }
    allow(failing).to receive(:call).and_raise(RuntimeError, "slice failed")
    expect(later).not_to receive(:call)

    expect {
      described_class.new(slice_purges: [earlier, failing, later]).call(profile_id: purged)
    }.to raise_error(RuntimeError, "slice failed")

    expect(repo.find_by_id(purged)).not_to be_nil
    expect(cast_repo.find_by_profile_id(purged)).not_to be_nil
    expect(cast_repo.find_by_profile_id(sibling)).not_to be_nil
  end

  it "resolves a purge for every slice that stores rows per profile" do
    purges = Hanami.app.slices[:profile]["use_cases.purge_profile"].send(:slice_purges)

    expect(purges.map { |purge| purge.class.name }).to match_array(%w[
      Notifications::UseCases::PurgeProfile
      Footprints::UseCases::PurgeProfile
      Bookmarks::UseCases::PurgeProfile
      Messaging::UseCases::PurgeProfile
      Social::UseCases::PurgeProfile
      Review::UseCases::PurgeProfile
      Post::UseCases::PurgeProfile
      Media::UseCases::PurgeProfile
      Schedule::UseCases::PurgeProfile
    ])
  end
end
