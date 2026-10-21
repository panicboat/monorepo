# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveAllFollowRequests
        include Social::Deps[
          follow_repo: "repositories.follow_repository",
          approve_follow_request: "use_cases.follows.approve_follow_request"
        ]

        def call(target_profile_id:)
          requester_ids = list_visible_profile_ids.call(profile_ids: follow_repo.pending_requester_ids(profile_id: target_profile_id))
          requester_ids.each do |requester_profile_id|
            approve_follow_request.call(target_profile_id: target_profile_id, requester_profile_id: requester_profile_id)
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
