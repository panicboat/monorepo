# frozen_string_literal: true

module Social
  module UseCases
    class PurgeProfile
      include Social::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository"
      ]

      def call(profile_id:)
        follow_repo.delete_by_profile(profile_id)
        block_repo.delete_by_profile(profile_id)
        nil
      end
    end
  end
end
