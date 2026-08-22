# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class Unfollow
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_id:, target_account_id:)
          follow_repo.unfollow(follower_id: follower_id, followee_id: target_account_id)
          {}
        end
      end
    end
  end
end
