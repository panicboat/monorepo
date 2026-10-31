# frozen_string_literal: true

require "spec_helper"

RSpec.describe "lock judgment in social", type: :database do
  let(:uc) { Social::Slice["use_cases.list_lock_passable_profile_ids"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:owner_account) { create_account }
  let(:target) { create_account_with_profile(account_id: owner_account, username: "target", is_private: true) }
  let(:viewer) { create_account_with_profile(username: "viewer") }

  def pass?(viewer_profile_id, profile_id)
    uc.call(viewer_profile_id: viewer_profile_id, profile_ids: [profile_id]).include?(profile_id)
  end

  it "passes an unlocked profile for anyone, nil viewer included" do
    open = create_account_with_profile(username: "open", is_private: false)

    expect([viewer, nil].map { |v| pass?(v, open) }).to eq([true, true])
  end

  it "passes a locked profile for the profile itself" do
    expect(pass?(target, target)).to be true
  end

  it "passes a locked profile for an approved follower" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: target, status: "approved")

    expect(pass?(viewer, target)).to be true
  end

  it "does not pass a locked profile for a pending follower" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: target, status: "pending")

    expect(pass?(viewer, target)).to be false
  end

  it "does not pass a locked profile for an unrelated viewer or a nil viewer" do
    expect([viewer, nil].map { |v| pass?(v, target) }).to eq([false, false])
  end

  it "does not pass a locked profile for another profile of the same account" do
    sibling = create_account_with_profile(account_id: owner_account, username: "sibling")

    expect(pass?(sibling, target)).to be false
  end

  it "passes a disabled locked profile" do
    disabled = create_account_with_profile(username: "disabled", is_private: true, disabled_at: Time.now)

    expect(pass?(viewer, disabled)).to be true
  end

  it "judges an uppercase id as the profile it names and returns lowercase ids" do
    open = create_account_with_profile(username: "open", is_private: false)

    expect(uc.call(viewer_profile_id: viewer, profile_ids: [target.upcase])).to eq(Set.new)
    expect(uc.call(viewer_profile_id: viewer, profile_ids: [open.upcase])).to eq(Set[open])

    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: target, status: "approved")

    expect(uc.call(viewer_profile_id: viewer.upcase, profile_ids: [target.upcase])).to eq(Set[target])
    expect(uc.call(viewer_profile_id: target.upcase, profile_ids: [target.upcase])).to eq(Set[target])
  end

  it "does not pass an id that is not a canonical UUID, a locked profile's id without hyphens included" do
    open = create_account_with_profile(username: "open", is_private: false)

    expect(uc.call(viewer_profile_id: viewer, profile_ids: [target.delete("-")])).to eq(Set.new)
    expect(uc.call(viewer_profile_id: nil, profile_ids: [target.delete("-"), "not-a-uuid", open])).to eq(Set[open])
  end

  it "reflects the lock turned off without any data change" do
    expect(pass?(viewer, target)).to be false

    db[:profile__profiles].where(id: target).update(is_private: false)

    expect(pass?(viewer, target)).to be true
  end
end
