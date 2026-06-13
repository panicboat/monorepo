# frozen_string_literal: true

require "concerns/cursor_pagination"

module Feed
  module UseCases
    # Symmetric account-authored feed query. Returns ordered post_ids + pagination
    # metadata. Hydration (post -> Post::V1::Post) is the handler's responsibility
    # via the posts cross-slice contract (Post::Slice["use_cases.posts.list_posts_by_ids"]).
    class ListFeed
      include Concerns::CursorPagination

      MAX_LIMIT = 50

      FILTER_ALL = "all"
      FILTER_AREA = "area"
      FILTER_FOLLOWING = "following"

      def initialize
        @block_adapter = Feed::Adapters::BlockAdapter.new
        @follow_adapter = Feed::Adapters::FollowAdapter.new
      end

      # @param filter [String] "all" | "area" | "following"
      # @param viewer_account_id [String] required (handler authenticates first)
      # @param prefecture [String, nil] required when filter == "area"
      # @param limit [Integer]
      # @param cursor [String, nil] base64 cursor
      # @return [Hash] { post_ids: Array<String>, next_cursor: String|nil, has_more: Boolean }
      def call(filter:, viewer_account_id:, prefecture: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor)
        excluded = @block_adapter.bidirectionally_blocked_account_ids(account_id: viewer_account_id)

        author_ids = case filter
        when FILTER_ALL
          nil # no whitelist = all public posts
        when FILTER_AREA
          list_account_ids_by_prefecture_uc.call(prefecture: prefecture)
        when FILTER_FOLLOWING
          @follow_adapter.following_account_ids(account_id: viewer_account_id)
        else
          nil
        end

        post_ids = post_repo.list_public_post_ids(
          limit: limit,
          cursor: decoded_cursor,
          author_ids: author_ids,
          excluded_author_ids: excluded
        )

        has_more = post_ids.length > limit
        truncated = has_more ? post_ids.first(limit) : post_ids

        next_cursor = if has_more && truncated.any?
          # Fetch the last post's created_at to encode cursor (we only have ids).
          last_post = post_repo.find_by_id(truncated.last)
          last_post ? encode_cursor(created_at: last_post.created_at.iso8601, id: last_post.id) : nil
        end

        { post_ids: truncated, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_account_ids_by_prefecture_uc
        @list_account_ids_by_prefecture_uc ||= Profile::Slice["use_cases.list_account_ids_by_prefecture"]
      end
    end
  end
end
