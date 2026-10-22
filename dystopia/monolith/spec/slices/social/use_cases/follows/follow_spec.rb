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
end
