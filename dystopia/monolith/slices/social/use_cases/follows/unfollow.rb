# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class Unfollow
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_profile_id:, target_profile_id:)
          follow_repo.unfollow(follower_profile_id: follower_profile_id, followee_profile_id: target_profile_id)
          {}
        end
      end
    end
  end
end
