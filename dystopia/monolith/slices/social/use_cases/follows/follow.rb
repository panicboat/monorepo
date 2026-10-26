# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class Follow
        include Social::Deps[follow_repo: "repositories.follow_repository", block_repo: "repositories.block_repository"]

        def call(follower_profile_id:, target_profile_id:)
          return { status: "none", reason: :self } if follower_profile_id.to_s == target_profile_id.to_s

          if block_repo.blocked?(blocker_profile_id: target_profile_id, blocked_profile_id: follower_profile_id) ||
             block_repo.blocked?(blocker_profile_id: follower_profile_id, blocked_profile_id: target_profile_id)
            return { status: "none", reason: :blocked }
          end

          profile = get_profile.call(profile_id: target_profile_id)
          return { status: "none", reason: :not_found } unless profile

          status = profile.follow_approval_required ? "pending" : "approved"

          result = follow_repo.follow(follower_profile_id: follower_profile_id, followee_profile_id: target_profile_id, status: status)

          if result[:success]
            notification_type = result[:status] == "approved" ? "follow" : "follow_request"
            notifications_emit.call(
              recipient_profile_id: target_profile_id,
              type: notification_type,
              target_resource_id: follower_profile_id,
              actor_profile_id: follower_profile_id
            )
          end

          { status: result[:status] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end

        def notifications_emit
          @notifications_emit ||= Notifications::Slice["use_cases.emit"]
        end
      end
    end
  end
end
