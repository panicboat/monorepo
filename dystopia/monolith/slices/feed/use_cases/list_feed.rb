# frozen_string_literal: true

require "concerns/cursor_pagination"
require "concerns/visible_page"

module Feed
  module UseCases
    class ListFeed
      include Concerns::CursorPagination

      MAX_LIMIT = 50

      class PrefectureRequired < StandardError; end

      def initialize
        @block_adapter = Feed::Adapters::BlockAdapter.new
        @follow_adapter = Feed::Adapters::FollowAdapter.new
      end

      def call(filter:, viewer_profile_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        decoded_cursor = decode_cursor(cursor, keys: [:published_at, :id])
        excluded = @block_adapter.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id)

        author_ids = case filter
        when "all"
          nil
        when "area"
          list_profile_ids_by_prefecture_uc.call(prefecture: viewer_prefecture(viewer_profile_id))
        when "following"
          @follow_adapter.following_profile_ids(profile_id: viewer_profile_id)
        when "followers"
          readable_author_ids(viewer_profile_id, @follow_adapter.follower_profile_ids(profile_id: viewer_profile_id))
        else
          raise ArgumentError, "unknown filter: #{filter.inspect}"
        end

        private_author_profile_ids = filter == "followers" ? mutual_ids(viewer_profile_id, author_ids) : []
        hydrated = {}
        page = Concerns::VisiblePage.fill(
          limit: limit,
          cursor: decoded_cursor,
          fetch: ->(after) {
            post_repo.list_post_ids(
              limit: limit,
              cursor: after,
              author_profile_ids: author_ids,
              excluded_author_profile_ids: excluded,
              include_private: filter == "following",
              viewer_profile_id: viewer_profile_id,
              private_author_profile_ids: private_author_profile_ids
            )
          },
          keep: ->(ids) {
            hydrated.merge!(list_posts_by_ids_uc.call(post_ids: ids, viewer_profile_id: viewer_profile_id))
            ids.select { |id| hydrated.key?(id.to_s) }
          },
          cursor_of: ->(id) { { published_at: post_repo.published_at_for_id(id), id: id } }
        )
        truncated = page[:items]

        next_cursor = if page[:has_more] && truncated.any?
          last_published_at = post_repo.published_at_for_id(truncated.last)
          last_published_at ? encode_cursor(published_at: last_published_at.iso8601(6), id: truncated.last) : nil
        end

        { posts: truncated.map { |id| hydrated[id.to_s] }, next_cursor: next_cursor, has_more: page[:has_more] }
      end

      private

      AuthorRef = Struct.new(:author_profile_id)

      def viewer_prefecture(viewer_profile_id)
        prefecture = get_profile.call(profile_id: viewer_profile_id)&.prefecture.to_s
        raise PrefectureRequired if prefecture.empty?

        prefecture
      end

      # Narrow to authors whose public posts the viewer may read, so locked or blocked followers never thin out a page.
      def readable_author_ids(viewer_profile_id, profile_ids)
        refs = profile_ids.map { |id| AuthorRef.new(id) }
        filter_visible_posts.call(viewer_profile_id: viewer_profile_id, posts: refs).map(&:author_profile_id)
      end

      def mutual_ids(viewer_profile_id, follower_ids)
        follower_ids & @follow_adapter.following_profile_ids(profile_id: viewer_profile_id)
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end

      def filter_visible_posts
        @filter_visible_posts ||= Social::Slice["use_cases.filter_visible_posts"]
      end

      def post_repo
        @post_repo ||= Post::Slice["repositories.post_repository"]
      end

      def list_posts_by_ids_uc
        @list_posts_by_ids_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
      end

      def list_profile_ids_by_prefecture_uc
        @list_profile_ids_by_prefecture_uc ||= Profile::Slice["use_cases.list_profile_ids_by_prefecture"]
      end
    end
  end
end
