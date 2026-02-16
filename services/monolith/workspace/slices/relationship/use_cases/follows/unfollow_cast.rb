# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class UnfollowCast
        include Relationship::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_id:, guest_id:)
          follow_repo.unfollow(cast_id: cast_id, guest_id: guest_id)
          { success: true }
        end
      end
    end
  end
end
