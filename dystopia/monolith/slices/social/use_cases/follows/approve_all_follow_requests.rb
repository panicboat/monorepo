# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveAllFollowRequests
        include Social::Deps[follow_repo: "repositories.follow_repository", block_repo: "repositories.block_repository"]

        def call(target_profile_id:)
          blocked_ids = block_repo.bidirectionally_blocked_profile_ids(profile_id: target_profile_id).map(&:to_s)
          pending_ids = follow_repo.pending_requester_ids(profile_id: target_profile_id).reject { |id| blocked_ids.include?(id.to_s) }
          requester_ids = list_visible_profile_ids.call(profile_ids: pending_ids)
          requester_ids.each do |requester_profile_id|
            follow_repo.approve_pending(follower_profile_id: requester_profile_id, followee_profile_id: target_profile_id)
          end

          { approved_count: requester_ids.length }
        end

        private

        def list_visible_profile_ids
          @list_visible_profile_ids ||= Profile::Slice["use_cases.list_visible_profile_ids"]
        end
      end
    end
  end
end
