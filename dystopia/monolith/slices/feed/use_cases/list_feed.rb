# frozen_string_literal: true

require "concerns/cursor_pagination"

module Feed
  module UseCases
    class ListFeed
      include Concerns::CursorPagination

      MAX_LIMIT = 50

      def initialize
        @block_adapter = Feed::Adapters::BlockAdapter.new
        @follow_adapter = Feed::Adapters::FollowAdapter.new
      end

      def call(filter:, viewer_account_id:, prefecture: nil, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor)
        excluded = @block_adapter.bidirectionally_blocked_account_ids(account_id: viewer_account_id)

        author_ids = case filter
        when "all"
          nil
        when "area"
          list_profile_ids_by_prefecture_uc.call(prefecture: prefecture)
        when "following"
          @follow_adapter.following_account_ids(account_id: viewer_account_id)
        else
          raise ArgumentError, "unknown filter: #{filter.inspect}"
        end

        post_ids = post_repo.list_public_post_ids(
          limit: limit,
          cursor: decoded_cursor,
          author_profile_ids: author_ids,
          excluded_author_profile_ids: excluded
        )

        has_more = post_ids.length > limit
        truncated = has_more ? post_ids.first(limit) : post_ids

        next_cursor = if has_more && truncated.any?
          last_created_at = post_repo.created_at_for_id(truncated.last)
          last_created_at ? encode_cursor(created_at: last_created_at.iso8601, id: truncated.last) : nil
        end

        { post_ids: truncated, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_profile_ids_by_prefecture_uc
        @list_profile_ids_by_prefecture_uc ||= Profile::Slice["use_cases.list_profile_ids_by_prefecture"]
      end
    end
  end
end
