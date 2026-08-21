# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    # Cross-slice post search. Calls Post repository for public-only id list,
    # then hydrates the truncated id slice via Post::Slice["use_cases.posts.list_posts_by_ids"]
    # which internally applies Social::FilterVisiblePosts (block + is_private).
    # Pagination cursor is (created_at, id) DESC, same shape as feed slice.
    class SearchPosts
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50

      def call(query:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor)

        post_ids = post_repo.search_by_content(query: query, limit: limit, cursor: decoded_cursor)
        has_more = post_ids.length > limit
        truncated = has_more ? post_ids.first(limit) : post_ids

        next_cursor = if has_more && truncated.any?
          last_created_at = post_repo.created_at_for_id(truncated.last)
          last_created_at ? encode_cursor(created_at: last_created_at.iso8601, id: truncated.last) : nil
        end

        post_protos_map = list_posts_uc.call(post_ids: truncated, viewer_account_id: viewer_account_id)
        ordered_posts = truncated.filter_map { |id| post_protos_map[id.to_s] }

        { posts: ordered_posts, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_posts_uc
        @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end
    end
  end
end
