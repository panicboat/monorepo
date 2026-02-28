# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class GetFollowStatus
        include Relationship::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_user_ids:, guest_user_id:)
          follow_repo.following_status_batch(cast_user_ids: cast_user_ids, guest_user_id: guest_user_id)
        end
      end
    end
  end
end
