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

          notifications_emit.call(
            recipient_id: requester_account_id,
            type: "follow_approved",
            target_resource_id: target_account_id,
            actor_id: target_account_id
          )

          {}
        end

        private

        def notifications_emit
          @notifications_emit ||= Notifications::Slice["use_cases.emit"]
        end
      end
    end
  end
end
