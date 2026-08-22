# frozen_string_literal: true

module Post
  module UseCases
    class PurgeAccount
      include Post::Deps[
        post_repo: "repositories.post_repository",
        like_repo: "repositories.like_repository",
        comment_repo: "repositories.comment_repository"
      ]

      def call(account_id:)
        like_repo.delete_by_account(account_id)
        comment_repo.delete_by_account(account_id)
        post_repo.delete_by_author(account_id)
        nil
      end
    end
  end
end
