# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      # Batch follow status check. Missing keys = NONE (not following).
      class GetFollowStatus
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_id:, target_account_ids:)
          target_account_ids = (target_account_ids || []).compact.uniq
          present = follow_repo.status_batch(follower_id: follower_id, followee_ids: target_account_ids)
          target_account_ids.each_with_object({}) do |id, h|
            h[id.to_s] = present[id.to_s] || "none"
          end
        end
      end
    end
  end
end
