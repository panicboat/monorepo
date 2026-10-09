# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetSocialCounts
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(profile_id:)
          return { following_count: 0, followers_count: 0 } unless get_profile.call(profile_id: profile_id)

          {
            following_count: follow_repo.count_following(profile_id: profile_id),
            followers_count: follow_repo.count_followers(profile_id: profile_id)
          }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end
      end
    end
  end
end
