# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetSocialCounts
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(profile_id:)
          {
            following_count: follow_repo.count_following(profile_id: profile_id),
            followers_count: follow_repo.count_followers(profile_id: profile_id)
          }
        end
      end
    end
  end
end
