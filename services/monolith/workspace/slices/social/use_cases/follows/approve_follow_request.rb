# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        # @param target_account_id [String] the account being followed (= viewer / approver)
        # @param requester_account_id [String] the account that requested to follow
        def call(target_account_id:, requester_account_id:)
          follow_repo.update_status(
            follower_id: requester_account_id,
            followee_id: target_account_id,
            status: "approved"
          )
          {}
        end
      end
    end
  end
end
