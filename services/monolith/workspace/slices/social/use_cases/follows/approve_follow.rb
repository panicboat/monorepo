# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class ApproveFollow
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(cast_id:, guest_id:)
          result = follow_repo.approve_follow(cast_id: cast_id, guest_id: guest_id)
          { success: result }
        end
      end
    end
  end
end
