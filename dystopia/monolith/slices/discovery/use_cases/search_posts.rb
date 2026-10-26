# frozen_string_literal: true

require "concerns/cursor_pagination"
require "concerns/visible_page"

module Discovery
  module UseCases
    class SearchPosts
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50
      HASHTAG_QUERY = /\A[#＃](?<tag>.+)\z/

      def call(query:, viewer_profile_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor, keys: [:published_at, :id])

        post_protos_map = {}
        page = ::Concerns::VisiblePage.fill(
          limit: limit,
          cursor: decoded_cursor,
          fetch: ->(after) { matching_post_ids(query.to_s.strip, limit: limit, cursor: after) },
          keep: ->(ids) {
            post_protos_map.merge!(list_posts_uc.call(post_ids: ids, viewer_profile_id: viewer_profile_id))
            ids.select { |id| post_protos_map.key?(id.to_s) }
          },
          cursor_of: ->(id) { { published_at: post_repo.published_at_for_id(id), id: id } }
        )
        truncated = page[:items]

        next_cursor = if page[:has_more] && truncated.any?
          last_published_at = post_repo.published_at_for_id(truncated.last)
          last_published_at ? encode_cursor(published_at: last_published_at.iso8601(6), id: truncated.last) : nil
        end

        ordered_posts = truncated.map { |id| post_protos_map[id.to_s] }

        { posts: ordered_posts, next_cursor: next_cursor, has_more: page[:has_more] }
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
