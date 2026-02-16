# frozen_string_literal: true

require "base64"
require "json"

module Feed
  module UseCases
    class ListCastFeed
      DEFAULT_LIMIT = 20
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
        limit = [[limit, 1].max, MAX_LIMIT].min
        decoded_cursor = decode_cursor(cursor)

        posts = @post_adapter.list_posts_for_cast(
          cast_id: cast_id,
          limit: limit,
          cursor: decoded_cursor
        )

        has_more = posts.length > limit
        posts = posts.first(limit) if has_more

        next_cursor = if has_more && posts.any?
          last = posts.last
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        author = @cast_adapter.find_by_cast_id(cast_id)

        { posts: posts, next_cursor: next_cursor, has_more: has_more, author: author }
      end

      private

      def decode_cursor(cursor)
        return nil if cursor.nil? || cursor.empty?

        parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
        { created_at: Time.parse(parsed["created_at"]), id: parsed["id"] }
      rescue StandardError
        nil
      end

      def encode_cursor(data)
        Base64.urlsafe_encode64(JSON.generate(data), padding: false)
      end
    end
  end
end
