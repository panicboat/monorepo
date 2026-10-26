# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    class RankPosts
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50
      VALID_PERIODS = %w[day week all].freeze

      def call(period:, viewer_profile_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        period = period.to_s
        return { posts: [], next_cursor: nil, has_more: false } unless VALID_PERIODS.include?(period)

        visible = visible_ranked(period: period, viewer_profile_id: viewer_profile_id, limit: limit, cursor: decode_cursor(cursor, keys: [:likes, :id]))
        has_more = visible.length > limit
        page = visible.first(limit)

        # Build the cursor from a post the viewer sees, so it never carries the id or likes of one they do not.
        next_cursor = encode_cursor(likes: page.last[:likes], id: page.last[:id]) if has_more

        { posts: page.map { |entry| entry[:post] }, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def visible_ranked(period:, viewer_profile_id:, limit:, cursor:)
        visible = []
        loop do
          rows = post_repo.top_by_likes(period: period, limit: limit, cursor: cursor)
          batch = rows.first(limit)
          post_protos_map = list_posts_uc.call(post_ids: batch.map(&:first), viewer_profile_id: viewer_profile_id)
          batch.each do |id, likes|
            post = post_protos_map[id.to_s]
            visible << { id: id, likes: likes, post: post } if post
          end
          return visible if visible.length > limit || rows.length <= limit

          cursor = { likes: batch.last[1], id: batch.last[0] }
        end
      end

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_posts_uc
        @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end
    end
  end
end
