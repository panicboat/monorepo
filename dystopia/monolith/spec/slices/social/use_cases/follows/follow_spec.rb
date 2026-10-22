# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Social::UseCases::Follows::Follow", type: :database do
  let(:follow) { Social::Slice["use_cases.follows.follow"] }
  let(:follower) { create_account_with_profile(username: "follow_viewer") }

  [
    [false, false, "approved"],
    [false, true, "pending"],
    [true, false, "approved"],
    [true, true, "pending"]
  ].each do |is_private, follow_approval_required, status|
    it "follows as #{status} when is_private is #{is_private} and follow_approval_required is #{follow_approval_required}" do
      target = create_account_with_profile(
        role: 2, username: "follow_target", is_private: is_private, follow_approval_required: follow_approval_required
      )

      expect(follow.call(follower_profile_id: follower, target_profile_id: target)).to eq(status: status)
    end
  end

  describe "notifications" do
    let(:notification_repo) { Notifications::Slice["repositories.notification_repository"] }
    let(:approve) { Social::Slice["use_cases.follows.approve_follow_request"] }

    def types_for(profile_id)
      notification_repo.list(recipient_profile_id: profile_id).map(&:type)
    end

    it "tells a profile without approval that someone followed it" do
      target = create_account_with_profile(role: 2, username: "open_target")

      follow.call(follower_profile_id: follower, target_profile_id: target)

      expect(types_for(target)).to eq(["follow"])
    end

    it "sends a request to a profile that approves followers, and nothing when it approves" do
      target = create_account_with_profile(role: 2, username: "gated_target", follow_approval_required: true)

      follow.call(follower_profile_id: follower, target_profile_id: target)
      approve.call(target_profile_id: target, requester_profile_id: follower)

      expect(types_for(target)).to eq(["follow_request"])
      expect(types_for(follower)).to be_empty
    end
  end
end
