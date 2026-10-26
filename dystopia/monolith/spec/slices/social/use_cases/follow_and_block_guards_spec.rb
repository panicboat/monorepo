# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Follow and block requests the API must not carry out", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:owner) { create_account_with_profile(username: "guard_owner", follow_approval_required: true) }
  let(:requester) { create_account_with_profile(username: "guard_requester") }

  def uc(name) = Social::Slice["use_cases.#{name}"]

  def status_of(follower, followee) = follow_repo.find(follower_profile_id: follower, followee_profile_id: followee)&.status

  it "does not let a profile follow itself, with or without approval" do
    [owner, requester].each do |profile|
      expect(uc("follows.follow").call(follower_profile_id: profile, target_profile_id: profile)[:status]).to eq("none")
      expect(status_of(profile, profile)).to be_nil
    end
  end

  it "does not let a profile block itself" do
    uc("blocks.block").call(blocker_profile_id: owner, target_profile_id: owner)

    expect(db[:social__blocks].where(blocker_profile_id: owner).count).to eq(0)
  end

  it "keeps an approved follow when its request is rejected or cancelled afterwards" do
    follow_repo.follow(follower_profile_id: requester, followee_profile_id: owner, status: "approved")

    uc("follows.reject_follow_request").call(target_profile_id: owner, requester_profile_id: requester)
    uc("follows.cancel_follow_request").call(follower_profile_id: requester, target_profile_id: owner)

    expect(status_of(requester, owner)).to eq("approved")
  end

  it "removes a pending request when it is rejected or cancelled" do
    other = create_account_with_profile(username: "guard_other")
    [requester, other].each { |id| follow_repo.follow(follower_profile_id: id, followee_profile_id: owner, status: "pending") }

    uc("follows.reject_follow_request").call(target_profile_id: owner, requester_profile_id: requester)
    uc("follows.cancel_follow_request").call(follower_profile_id: other, target_profile_id: owner)

    expect([status_of(requester, owner), status_of(other, owner)]).to eq([nil, nil])
  end

  it "does not approve a request left pending alongside a block in either direction" do
    blocking = create_account_with_profile(username: "guard_blocking")
    blocked = create_account_with_profile(username: "guard_blocked")
    [blocking, blocked].each { |id| follow_repo.follow(follower_profile_id: id, followee_profile_id: owner, status: "pending") }
    db[:social__blocks].insert(id: SecureRandom.uuid_v7, blocker_profile_id: blocking, blocked_profile_id: owner)
    db[:social__blocks].insert(id: SecureRandom.uuid_v7, blocker_profile_id: owner, blocked_profile_id: blocked)

    approved = uc("follows.approve_all_follow_requests").call(target_profile_id: owner)
    [blocking, blocked].each { |id| uc("follows.approve_follow_request").call(target_profile_id: owner, requester_profile_id: id) }

    expect([status_of(blocking, owner), status_of(blocked, owner), approved[:approved_count]]).to eq(["pending", "pending", 0])
  end

  it "does not approve the request of a disabled requester, and approves a visible one" do
    disabled = create_account_with_profile(username: "guard_disabled")
    [requester, disabled].each { |id| follow_repo.follow(follower_profile_id: id, followee_profile_id: owner, status: "pending") }
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)

    [requester, disabled].each { |id| uc("follows.approve_follow_request").call(target_profile_id: owner, requester_profile_id: id) }

    expect([status_of(requester, owner), status_of(disabled, owner)]).to eq(%w[approved pending])
  end
end
