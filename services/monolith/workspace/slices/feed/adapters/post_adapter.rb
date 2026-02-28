# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Post slice data.
    class PostAdapter
      def list_posts_for_cast(cast_user_id:, limit:, cursor:)
        post_repo.list_by_cast_user_id(cast_user_id: cast_user_id, limit: limit, cursor: cursor)
      end

      def list_public_posts(limit:, cursor:, cast_user_ids: nil, exclude_cast_user_ids: nil)
        post_repo.list_all_visible(
          limit: limit,
          cursor: cursor,
          cast_user_ids: cast_user_ids,
          exclude_cast_user_ids: exclude_cast_user_ids
        )
      end

      def list_all_for_authenticated(public_cast_user_ids:, followed_cast_user_ids:, limit:, cursor:, exclude_cast_user_ids: nil)
        post_repo.list_all_for_authenticated(
          public_cast_user_ids: public_cast_user_ids,
          followed_cast_user_ids: followed_cast_user_ids,
          limit: limit,
          cursor: cursor,
          exclude_cast_user_ids: exclude_cast_user_ids
        )
      end

      def list_all_by_cast_user_ids(cast_user_ids:, limit:, cursor:, exclude_cast_user_ids: nil)
        post_repo.list_all_by_cast_user_ids(
          cast_user_ids: cast_user_ids,
          limit: limit,
          cursor: cursor,
          exclude_cast_user_ids: exclude_cast_user_ids
        )
      end

      def likes_count_batch(post_ids:)
        like_repo.likes_count_batch(post_ids: post_ids)
      end

      def liked_status_batch(post_ids:, guest_user_id:)
        like_repo.liked_status_batch(post_ids: post_ids, guest_user_id: guest_user_id)
      end

      def comments_count_batch(post_ids:, exclude_user_ids: nil)
        comment_repo.comments_count_batch(post_ids: post_ids, exclude_user_ids: exclude_user_ids)
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def like_repo
        @like_repo ||= Post::Slice["repositories.like_repository"]
      end

      def comment_repo
        @comment_repo ||= Post::Slice["repositories.comment_repository"]
      end
    end
  end
end
