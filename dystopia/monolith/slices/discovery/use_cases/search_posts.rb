# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    class SearchPosts
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50
      HASHTAG_QUERY = /\A[#＃](?<tag>.+)\z/

      def call(query:, viewer_profile_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor)

        post_ids = matching_post_ids(query.to_s.strip, limit: limit, cursor: decoded_cursor)
        has_more = post_ids.length > limit
        truncated = has_more ? post_ids.first(limit) : post_ids

        next_cursor = if has_more && truncated.any?
          last_created_at = post_repo.created_at_for_id(truncated.last)
          last_created_at ? encode_cursor(created_at: last_created_at.iso8601, id: truncated.last) : nil
        end

        post_protos_map = list_posts_uc.call(post_ids: truncated, viewer_profile_id: viewer_profile_id)
        ordered_posts = truncated.filter_map { |id| post_protos_map[id.to_s] }

        { posts: ordered_posts, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def matching_post_ids(query, limit:, cursor:)
        hashtag = HASHTAG_QUERY.match(query)
        return post_repo.search_by_hashtag(tag: hashtag[:tag], limit: limit, cursor: cursor) if hashtag

        post_repo.search_by_content(query: query, limit: limit, cursor: cursor)
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
