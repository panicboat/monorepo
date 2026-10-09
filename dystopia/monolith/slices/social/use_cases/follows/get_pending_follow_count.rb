# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetPendingFollowCount
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(profile_id:)
          list_visible_profile_ids.call(profile_ids: follow_repo.pending_requester_ids(profile_id: profile_id)).length
        end

        private

        def list_visible_profile_ids
          @list_visible_profile_ids ||= Profile::Slice["use_cases.list_visible_profile_ids"]
        end
      end
    end
  end
end
