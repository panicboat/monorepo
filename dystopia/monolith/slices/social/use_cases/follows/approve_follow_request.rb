# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(target_profile_id:, requester_profile_id:)
          follow_repo.update_status(
            follower_profile_id: requester_profile_id,
            followee_profile_id: target_profile_id,
            status: "approved"
          )

          notifications_emit.call(
            recipient_id: requester_profile_id,
            type: "follow_approved",
            target_resource_id: target_profile_id,
            actor_id: target_profile_id
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
