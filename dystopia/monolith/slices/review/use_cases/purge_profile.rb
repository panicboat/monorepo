# frozen_string_literal: true

module Review
  module UseCases
    class PurgeProfile
      include Review::Deps[review_repo: "repositories.review_repository"]

      def call(profile_id:)
        review_repo.delete_by_profile(profile_id)
        nil
      end
    end
  end
end
