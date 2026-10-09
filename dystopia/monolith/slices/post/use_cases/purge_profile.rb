# frozen_string_literal: true

module Post
  module UseCases
    class PurgeProfile
      include Post::Deps[
        post_repo: "repositories.post_repository",
        like_repo: "repositories.like_repository",
        comment_repo: "repositories.comment_repository"
      ]

      def call(profile_id:)
        like_repo.delete_by_profile(profile_id)
        comment_repo.delete_by_profile(profile_id)
        post_repo.delete_by_author(profile_id)
        nil
      end
    end
  end
end
