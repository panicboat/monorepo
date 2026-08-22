# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Same as Unfollow but semantically used while status='pending'. The repo doesn't
      # distinguish so this is a thin alias.
      class CancelFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_id:, target_account_id:)
          follow_repo.unfollow(follower_id: follower_id, followee_id: target_account_id)
          {}
        end
      end
    end
  end
end
