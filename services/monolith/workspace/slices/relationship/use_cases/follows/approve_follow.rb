# frozen_string_literal: true

module Relationship
  module UseCases
    module Follows
      class ApproveFollow
        include Relationship::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_user_id:, guest_user_id:)
          result = follow_repo.approve_follow(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
          { success: result }
        end
      end
    end
  end
end
