# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class FollowCast
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        # @param cast_id [String] UUID of the cast to follow
        # @param guest_id [String] UUID of the guest following
        # @param visibility [String] "public" or "private" - determines follow status
        def call(cast_id:, guest_id:, visibility: "public")
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
