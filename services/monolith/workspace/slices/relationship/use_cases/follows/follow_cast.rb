# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class FollowCast
        include Relationship::Deps[
          follow_repo: "repositories.follow_repository",
          block_repo: "repositories.block_repository"
        ]

        # @param cast_id [String] UUID of the cast to follow
        # @param guest_id [String] UUID of the guest following
        # @param visibility [String] "public" or "private" - determines follow status
        def call(cast_id:, guest_id:, visibility: "public")
          # Check if cast has blocked this guest
          if block_repo.blocked?(blocker_id: cast_id, blocked_id: guest_id)
            return { success: false, error: :blocked }
          end

          status = visibility == "private" ? "pending" : "approved"
          result = follow_repo.follow(cast_id: cast_id, guest_id: guest_id, status: status)

          if result[:success]
            { success: true, status: status }
          else
            { success: false, error: :already_following, status: result[:status] }
          end
        end
      end
    end
  end
end
