# frozen_string_literal: true

module Relationship
  module UseCases
    module Blocks
      class BlockUser
        include Relationship::Deps[
          block_repo: "repositories.block_repository",
          follow_repo: "repositories.follow_repository"
        ]

        def call(blocker_id:, blocker_type:, blocked_id:, blocked_type:)
          block_repo.block(
            blocker_id: blocker_id,
            blocker_type: blocker_type,
            blocked_id: blocked_id,
            blocked_type: blocked_type
          )

          # Remove follow relationship when blocking
          if blocker_type == "cast" && blocked_type == "guest"
            follow_repo.unfollow(cast_user_id: blocker_id, guest_user_id: blocked_id)
          end

          { success: true }
        end
      end
    end
  end
end
