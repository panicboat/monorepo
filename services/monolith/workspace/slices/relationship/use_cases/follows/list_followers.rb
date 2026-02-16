# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class ListFollowers
        include Relationship::Deps[
          follow_repo: "repositories.follow_repository",
          block_repo: "repositories.block_repository"
        ]

        def call(cast_id:, limit: 20, cursor: nil)
          blocked_guest_ids = block_repo.blocked_guest_ids(blocker_id: cast_id)

          result = follow_repo.list_followers(
            cast_id: cast_id,
            blocked_guest_ids: blocked_guest_ids,
            limit: limit,
            cursor: cursor
          )

          followers = result[:followers].map do |follower|
            {
              guest_id: follower.guest_id,
              followed_at: follower.created_at
            }
          end

          {
            followers: followers,
            total: result[:total],
            has_more: result[:has_more],
            next_cursor: result[:followers].last&.then { |f| { created_at: f.created_at } }
          }
        end
      end
    end
  end
end
