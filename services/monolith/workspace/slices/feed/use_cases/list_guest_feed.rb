# frozen_string_literal: true

require "concerns/cursor_pagination"

module Feed
  module UseCases
    class ListGuestFeed
      include Concerns::CursorPagination

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
        limit = normalize_limit(limit)
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

        pagination = build_pagination_result(items: posts, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        { posts: pagination[:items], next_cursor: pagination[:next_cursor], has_more: pagination[:has_more], authors: authors }
      end

      private

      def list_all_posts(guest_id:, limit:, cursor:, exclude_cast_ids:)
        public_cast_user_ids = @cast_adapter.public_cast_ids
        followed_cast_user_ids = @relationship_adapter.following_cast_user_ids(guest_user_id: guest_id)

        posts = @post_adapter.list_all_for_authenticated(
          public_cast_user_ids: public_cast_user_ids,
          followed_cast_user_ids: followed_cast_user_ids,
          limit: limit,
          cursor: cursor,
          exclude_cast_user_ids: exclude_cast_ids
        )

        authors = load_authors(posts)
        [posts, authors]
      end

      def list_following_posts(guest_id:, limit:, cursor:, exclude_cast_ids:)
        cast_user_ids = @relationship_adapter.following_cast_user_ids(guest_user_id: guest_id)
        return [[], {}] if cast_user_ids.empty?

        posts = @post_adapter.list_all_by_cast_user_ids(
          cast_user_ids: cast_user_ids,
          limit: limit,
          cursor: cursor,
          exclude_cast_user_ids: exclude_cast_ids
        )

        authors = load_authors(posts)
        [posts, authors]
      end

      def list_favorite_posts(guest_id:, limit:, cursor:, exclude_cast_ids:)
        cast_user_ids = @relationship_adapter.favorite_cast_user_ids(guest_user_id: guest_id)
        return [[], {}] if cast_user_ids.empty?

        posts = @post_adapter.list_public_posts(
          limit: limit,
          cursor: cursor,
          cast_user_ids: cast_user_ids,
          exclude_cast_user_ids: exclude_cast_ids
        )

        authors = load_authors(posts)
        [posts, authors]
      end

      def load_authors(posts)
        return {} if posts.empty?

        cast_user_ids = posts.map(&:cast_user_id).uniq
        @cast_adapter.find_by_cast_ids(cast_user_ids)
      end

    end
  end
end
