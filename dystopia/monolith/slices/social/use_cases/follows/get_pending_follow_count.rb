# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetPendingFollowCount
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(profile_id:)
          follow_repo.count_pending_to(profile_id: profile_id)
        end
      end
    end
  end
end
