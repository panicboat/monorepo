# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class FollowCast
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_id:, guest_id:)
          follow_repo.follow(cast_id: cast_id, guest_id: guest_id)
          { success: true }
        end
      end
    end
  end
end
