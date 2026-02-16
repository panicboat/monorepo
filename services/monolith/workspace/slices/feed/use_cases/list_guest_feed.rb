# frozen_string_literal: true

require "base64"
require "json"

module Feed
  module UseCases
    class ListGuestFeed
      DEFAULT_LIMIT = 20
      MAX_LIMIT = 50

      def initialize
        @post_adapter = Feed::Adapters::PostAdapter.new
        @relationship_adapter = Feed::Adapters::RelationshipAdapter.new
        @cast_adapter = Feed::Adapters::CastAdapter.new
        @guest_adapter = Feed::Adapters::GuestAdapter.new
      end

      # @param guest_id [String] the guest ID
      # @param filter [String] "all", "following", or "favorites"
      # @param limit [Integer] max posts to return
      # @param cursor [String, nil] pagination cursor
      # @param blocker_id [String, nil] ID of user to get blocked users for
      # @return [Hash] { posts:, next_cursor:, has_more:, authors: }
      def call(guest_id:, filter:, limit: DEFAULT_LIMIT, cursor: nil, blocker_id: nil)
        limit = [[limit, 1].max, MAX_LIMIT].min
        decoded_cursor = decode_cursor(cursor)

        # Get blocked cast IDs
        blocked_cast_ids = blocker_id ? @relationship_adapter.blocked_cast_ids(blocker_id: blocker_id) : []

        posts, authors = case filter
        when "all"
          list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_cast_ids)
        when "following"
          list_following_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_cast_ids)
        when "favorites"
          list_favorite_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_cast_ids)
        else
          list_all_posts(guest_id: guest_id, limit: limit, cursor: decoded_cursor, exclude_cast_ids: blocked_cast_ids)
        end

        has_more = posts.length > limit
        posts = posts.first(limit) if has_more

        next_cursor = if has_more && posts.any?
          last = posts.last
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        { posts: posts, next_cursor: next_cursor, has_more: has_more, authors: authors }
      end

      private

      def list_all_posts(guest_id:, limit:, cursor:, exclude_cast_ids:)
        public_cast_ids = @cast_adapter.public_cast_ids
        followed_cast_ids = @relationship_adapter.following_cast_ids(guest_id: guest_id)

        posts = @post_adapter.list_all_for_authenticated(
          public_cast_ids: public_cast_ids,
          followed_cast_ids: followed_cast_ids,
          limit: limit,
          cursor: cursor,
          exclude_cast_ids: exclude_cast_ids
        )

        authors = load_authors(posts)
        [posts, authors]
      end

      def list_following_posts(guest_id:, limit:, cursor:, exclude_cast_ids:)
        cast_ids = @relationship_adapter.following_cast_ids(guest_id: guest_id)
        return [[], {}] if cast_ids.empty?

        posts = @post_adapter.list_all_by_cast_ids(
          cast_ids: cast_ids,
          limit: limit,
          cursor: cursor,
          exclude_cast_ids: exclude_cast_ids
        )

        authors = load_authors(posts)
        [posts, authors]
      end

      def list_favorite_posts(guest_id:, limit:, cursor:, exclude_cast_ids:)
        cast_ids = @relationship_adapter.favorite_cast_ids(guest_id: guest_id)
        return [[], {}] if cast_ids.empty?

        posts = @post_adapter.list_public_posts(
          limit: limit,
          cursor: cursor,
          cast_ids: cast_ids,
          exclude_cast_ids: exclude_cast_ids
        )

        authors = load_authors(posts)
        [posts, authors]
      end

      def load_authors(posts)
        return {} if posts.empty?

        cast_ids = posts.map(&:cast_id).uniq
        @cast_adapter.find_by_cast_ids(cast_ids)
      end

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
