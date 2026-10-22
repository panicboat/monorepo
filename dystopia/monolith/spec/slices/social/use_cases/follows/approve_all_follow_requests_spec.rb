# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::UseCases::Follows::ApproveAllFollowRequests", type: :database do
  let(:approve_all) { Social::Slice["use_cases.follows.approve_all_follow_requests"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:target) { create_account_with_profile(role: 2, username: "approve_target") }
  let(:first_requester) { create_account_with_profile(username: "approve_first") }
  let(:second_requester) { create_account_with_profile(username: "approve_second") }
  let(:other_target) { create_account_with_profile(role: 2, username: "approve_other") }

  it "approves every pending request to the target without notifying the requesters" do
    follow_repo.follow(follower_profile_id: first_requester, followee_profile_id: target, status: "pending")
    follow_repo.follow(follower_profile_id: second_requester, followee_profile_id: target, status: "pending")
    follow_repo.follow(follower_profile_id: first_requester, followee_profile_id: other_target, status: "pending")

    expect(approve_all.call(target_profile_id: target)).to eq(approved_count: 2)

    expect(follow_repo.status_batch(follower_profile_id: first_requester, followee_profile_ids: [target, other_target]))
      .to eq(target => "approved", other_target => "pending")
    expect(follow_repo.find(follower_profile_id: second_requester, followee_profile_id: target).status).to eq("approved")
    expect(db[:notifications__notifications].where(recipient_profile_id: [first_requester, second_requester]).count).to eq(0)
  end

  it "skips requesters the pending list does not show" do
    hidden = create_account_with_profile(username: "approve_hidden")
    follow_repo.follow(follower_profile_id: first_requester, followee_profile_id: target, status: "pending")
    follow_repo.follow(follower_profile_id: hidden, followee_profile_id: target, status: "pending")
    db[:profile__profiles].where(id: hidden).update(disabled_at: Time.now)

    expect(approve_all.call(target_profile_id: target)).to eq(approved_count: 1)
    expect(follow_repo.find(follower_profile_id: hidden, followee_profile_id: target).status).to eq("pending")
  end
end
