# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Reject = remove the pending row outright.
      class RejectFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(target_account_id:, requester_account_id:)
          follow_repo.unfollow(follower_id: requester_account_id, followee_id: target_account_id)
          {}
        end
      end
    end
  end
end
