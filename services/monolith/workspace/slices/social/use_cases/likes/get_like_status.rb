# frozen_string_literal: true

module Social
  module UseCases
    module Likes
      class GetLikeStatus
        include Social::Deps[like_repo: "repositories.like_repository"]

        def call(post_ids:, guest_id:)
          like_repo.liked_status_batch(post_ids: post_ids, guest_id: guest_id)
        end
      end
    end
  end
end
