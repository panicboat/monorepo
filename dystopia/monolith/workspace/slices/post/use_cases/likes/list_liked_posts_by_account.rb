# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Likes
      # Lists posts liked by `account_id` (newest like first) for the "いいね" tab on /u/[username].
      # Hydrates Post protos via the shared `list_posts_by_ids` use_case which applies
      # `Social::FilterVisiblePosts` (privacy / block filtering) transparently.
      class ListLikedPostsByAccount
        include ::Concerns::CursorPagination
        include Post::Deps[like_repo: "repositories.like_repository"]

        MAX_LIMIT = 50

        def call(account_id:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          rows = like_repo.liked_post_ids_by_account(
            account_id: account_id,
            limit: limit,
            cursor: decoded_cursor
          )

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Preserve like-row order when hydrating; drop any post that the viewer
          # cannot see (FilterVisiblePosts removes it from the hydrated hash).
          post_ids = result[:items].map(&:post_id)
          posts_map = list_posts_uc.call(post_ids: post_ids, viewer_account_id: viewer_account_id)
          ordered_posts = post_ids.filter_map { |id| posts_map[id.to_s] }

          {
            posts: ordered_posts,
            next_cursor: result[:next_cursor],
            has_more: result[:has_more]
          }
        end

        private

        def list_posts_uc
          @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
        end
      end
    end
  end
end
