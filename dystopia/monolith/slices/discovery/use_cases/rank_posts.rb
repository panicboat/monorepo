# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    # Cross-slice post ranking by like count. Calls Post repository for
    # [[id, likes_count], ...] within the period, then hydrates the truncated
    # id slice via Post::Slice["use_cases.posts.list_posts_by_ids"] which
    # internally applies Social::FilterVisiblePosts (block + is_private).
    # Pagination cursor is (likes_count, id) DESC — semantically reuses the
    # (created_at, id) encoder by stuffing likes_count (as string) into the
    # created_at slot.
    class RankPosts
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50
      VALID_PERIODS = %w[day week all].freeze

      def call(period:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        period = period.to_s
        return { posts: [], next_cursor: nil, has_more: false } unless VALID_PERIODS.include?(period)

        decoded_cursor = decode_cursor(cursor)
        rows = post_repo.top_by_likes(period: period, limit: limit, cursor: decoded_cursor)
        has_more = rows.length > limit
        truncated = has_more ? rows.first(limit) : rows

        next_cursor = if has_more && truncated.any?
          last = truncated.last
          encode_cursor(created_at: last[1].to_s, id: last[0])
        end

        ids = truncated.map(&:first)
        post_protos_map = list_posts_uc.call(post_ids: ids, viewer_account_id: viewer_account_id)
        ordered_posts = ids.filter_map { |id| post_protos_map[id.to_s] }

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
