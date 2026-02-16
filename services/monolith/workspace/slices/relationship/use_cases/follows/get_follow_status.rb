# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class GetFollowStatus
        include Relationship::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_ids:, guest_id:)
          follow_repo.following_status_batch(cast_ids: cast_ids, guest_id: guest_id)
        end
      end
    end
  end
end
