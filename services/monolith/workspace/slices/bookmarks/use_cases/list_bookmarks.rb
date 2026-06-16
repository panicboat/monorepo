# frozen_string_literal: true

require "concerns/cursor_pagination"

module Bookmarks
  module UseCases
    class ListBookmarks
      include ::Concerns::CursorPagination
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      MAX_LIMIT = 50

      def call(account_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        rows = bookmark_repo.list(account_id: account_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        post_ids = result[:items].map(&:post_id)
        post_protos_map = list_posts_uc.call(post_ids: post_ids, viewer_account_id: account_id)

        # Preserve bookmark order (most-recent first) instead of hash order.
        ordered_posts = post_ids.filter_map { |id| post_protos_map[id.to_s] }

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
