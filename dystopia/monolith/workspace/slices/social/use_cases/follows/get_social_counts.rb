# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetSocialCounts
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(account_id:)
          {
            following_count: follow_repo.count_following(account_id: account_id),
            followers_count: follow_repo.count_followers(account_id: account_id)
          }
        end
      end
    end
  end
end
