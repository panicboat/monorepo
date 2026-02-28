# frozen_string_literal: true

module Post
  module UseCases
    module Likes
      class GetLikeStatus
        include Post::Deps[like_repo: "repositories.like_repository"]

        def call(post_ids:, guest_user_id:)
          like_repo.liked_status_batch(post_ids: post_ids, guest_user_id: guest_user_id)
        end
      end
    end
  end
end
