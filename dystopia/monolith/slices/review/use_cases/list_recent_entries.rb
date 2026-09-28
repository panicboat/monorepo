# frozen_string_literal: true

require "set"
require "concerns/cursor_pagination"

module Review
  module UseCases
    class ListRecentEntries
      AuthorRef = Struct.new(:author_id)

      include Concerns::CursorPagination
      include Review::Deps[
        entry_repo: "repositories.entry_repository",
        cast_settings_repo: "repositories.cast_settings_repository"
      ]

      def initialize(entry_repo: nil, cast_settings_repo: nil, block_adapter: nil, filter_visible_posts: nil,
                     get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo, cast_settings_repo: cast_settings_repo).compact)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, limit: 20, cursor: nil)
        limit = normalize_limit(limit)
        page = entry_repo.list_recent(limit: limit, cursor: cursor)
        has_more = page.length > limit
        page = page.take(limit)

        visible = filter_visible(viewer_account_id, page)

        next_cursor = if has_more && page.any?
          last = page.last
          encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
        end

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def filter_visible(viewer_account_id, entries)
        return [] if entries.empty?

        not_hidden = entries.reject(&:hidden)
        visible_target_ids = not_hidden.map(&:target_account_id).uniq.select { |id| reviews_visible?(id) }
        not_hidden = not_hidden.select { |e| visible_target_ids.include?(e.target_account_id) }
        return [] if not_hidden.empty?

        blocked_ids = block_adapter.bidirectionally_blocked_ids(account_id: viewer_account_id)
        not_blocked = not_hidden.reject do |e|
          blocked_ids.include?(e.author_account_id) || blocked_ids.include?(e.target_account_id)
        end
        return [] if not_blocked.empty?

        reachable_ids = reachable_account_ids(viewer_account_id, not_blocked)
        not_blocked.select do |e|
          reachable_ids.include?(e.author_account_id) && reachable_ids.include?(e.target_account_id)
        end
      end

      def reachable_account_ids(viewer_account_id, entries)
        candidate_ids = (entries.map(&:author_account_id) + entries.map(&:target_account_id)).uniq
        refs = candidate_ids.map { |id| AuthorRef.new(id) }
        filter_visible_posts.call(viewer_account_id: viewer_account_id, posts: refs).map(&:author_id).to_set
      end

      def reviews_visible?(target_account_id)
        settings = cast_settings_repo.find_by_account(target_account_id)
        settings.nil? || settings.reviews_visible != false
      end

      def present_with_author(e, profile_cache)
        profile = profile_cache[e.author_account_id] ||= get_profile.call(account_id: e.author_account_id)
        target_profile = profile_cache[e.target_account_id] ||= get_profile.call(account_id: e.target_account_id)
        {
          id: e.id,
          author_account_id: e.author_account_id,
          target_account_id: e.target_account_id,
          author_username: profile&.username,
          author_avatar_url: avatar_url_for(profile),
          target_username: target_profile&.username,
          target_avatar_url: avatar_url_for(target_profile),
          rating: e.rating.to_f,
          body: e.body,
          hidden: e.hidden,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end

      def avatar_url_for(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?
        media_adapter.find_url(profile.avatar_media_id)
      end

      def block_adapter
        @block_adapter ||= Review::Adapters::BlockAdapter.new
      end

      def filter_visible_posts
        @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Review::Adapters::MediaAdapter.new
      end
    end
  end
end
