# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class RejectFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(target_profile_id:, requester_profile_id:)
          follow_repo.unfollow(follower_profile_id: requester_profile_id, followee_profile_id: target_profile_id)
          {}
        end
      end
    end
  end
end
