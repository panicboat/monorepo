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
          follow_repo.pending_requester_ids(profile_id: target_profile_id).each do |requester_profile_id|
            approve_follow_request.call(target_profile_id: target_profile_id, requester_profile_id: requester_profile_id)
          end

          {}
        end
      end
    end
  end
end
