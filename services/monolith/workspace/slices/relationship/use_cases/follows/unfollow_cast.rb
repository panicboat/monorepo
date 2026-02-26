# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class UnfollowCast
        include Relationship::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_user_id:, guest_user_id:)
          follow_repo.unfollow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
          { success: true }
        end
      end
    end
  end
end
