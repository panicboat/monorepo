# frozen_string_literal: true

module Post
  module UseCases
    module Likes
      class UnlikePost
        include Post::Deps[
          like_repo: "repositories.like_repository",
          post_repo: "repositories.post_repository"
        ]

        def call(post_id:, guest_id:)
          post = post_repo.find_by_id(post_id)
          raise PostNotFoundError unless post

          like_repo.unlike(post_id: post_id, guest_id: guest_id)
          likes_count = like_repo.likes_count(post_id: post_id)

          { likes_count: likes_count }
        end

        class PostNotFoundError < StandardError; end
      end
    end
  end
end
