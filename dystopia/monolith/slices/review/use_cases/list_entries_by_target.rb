# frozen_string_literal: true

require "concerns/cursor_pagination"

module Review
  module UseCases
    class ListEntriesByTarget
      include Concerns::CursorPagination
      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, filter_visible_entries: nil, get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @filter_visible_entries = filter_visible_entries
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, target_account_id:, limit: 20, cursor: nil)
        page = entry_repo.list_by_target(target_account_id: target_account_id, limit: limit, cursor: cursor)
        has_more = page.length > limit
        page = page.take(limit)

        visible = filter_visible_entries.call(
          viewer_account_id: viewer_account_id,
          page_owner_account_id: target_account_id,
          entries: page
        )

        next_cursor = if has_more && page.any?
          last = page.last
          # Preserve microseconds so same-second rows remain paginable across boundaries.
          encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
        end

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more }
      end

      private

      def present_with_author(e, profile_cache)
        profile = profile_cache[e.author_account_id] ||= get_profile.call(account_id: e.author_account_id)
        {
          id: e.id,
          author_account_id: e.author_account_id,
          target_account_id: e.target_account_id,
          author_username: profile&.username,
          author_avatar_url: avatar_url_for(profile),
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

      def filter_visible_entries
        @filter_visible_entries ||= Review::Slice["use_cases.filter_visible_entries"]
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
