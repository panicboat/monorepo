# frozen_string_literal: true

require "concerns/cursor_pagination"

module Feed
  module UseCases
    class ListCastFeed
      include Concerns::CursorPagination

      MAX_LIMIT = 50

      def initialize
        @post_adapter = Feed::Adapters::PostAdapter.new
        @cast_adapter = Feed::Adapters::CastAdapter.new
      end

      # @param cast_id [String] the cast ID
      # @param limit [Integer] max posts to return
      # @param cursor [String, nil] pagination cursor
      # @return [Hash] { posts:, next_cursor:, has_more:, author: }
      def call(cast_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor)

        posts = @post_adapter.list_posts_for_cast(
          cast_id: cast_id,
          limit: limit,
          cursor: decoded_cursor
        )

        pagination = build_pagination_result(items: posts, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        author = @cast_adapter.find_by_cast_id(cast_id)

        { posts: pagination[:items], next_cursor: pagination[:next_cursor], has_more: pagination[:has_more], author: author }
      end

      private

    end
  end
end
