# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveFollowRequest
        include Social::Deps[follow_repo: "repositories.follow_repository", block_repo: "repositories.block_repository"]

        def call(target_profile_id:, requester_profile_id:)
          return {} if list_visible_profile_ids.call(profile_ids: [requester_profile_id]).empty?
          # A block removes pending requests, but a request written while the block commits can outlive it.
          return {} if block_repo.bidirectionally_blocked_profile_ids(profile_id: target_profile_id).map(&:to_s).include?(requester_profile_id.to_s)

          follow_repo.approve_pending(follower_profile_id: requester_profile_id, followee_profile_id: target_profile_id)
          {}
        end

        private

        def list_visible_profile_ids
          @list_visible_profile_ids ||= Profile::Slice["use_cases.list_visible_profile_ids"]
        end
      end
    end
  end
end
