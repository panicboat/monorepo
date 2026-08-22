# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Symmetric Follow. Looks up the target's profile.is_private (cross-slice) and decides
      # whether to insert pending or approved. Returns the resulting status.
      class Follow
        include Social::Deps[follow_repo: "repositories.follow_repository", block_repo: "repositories.block_repository"]

        # @return [Hash{status: String, reason: Symbol?}]
        def call(follower_id:, target_account_id:)
          if block_repo.blocked?(blocker_id: target_account_id, blocked_id: follower_id) ||
             block_repo.blocked?(blocker_id: follower_id, blocked_id: target_account_id)
            return { status: "none", reason: :blocked }
          end

          profile = get_profile.call(account_id: target_account_id)
          is_private = profile.respond_to?(:is_private) ? !!profile.is_private : false
          status = is_private ? "pending" : "approved"

          result = follow_repo.follow(follower_id: follower_id, followee_id: target_account_id, status: status)

          notification_type = result[:status] == "approved" ? "follow_approved" : "follow_request"
          notifications_emit.call(
            recipient_id: target_account_id,
            type: notification_type,
            target_resource_id: follower_id,
            actor_id: follower_id
          )

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
