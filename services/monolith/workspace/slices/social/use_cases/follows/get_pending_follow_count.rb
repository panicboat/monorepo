# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetPendingFollowCount
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(account_id:)
          follow_repo.count_pending_to(account_id: account_id)
        end
      end
    end
  end
end
