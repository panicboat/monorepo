# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module UseCases
    class ListRecentEntries
      class AccessError < StandardError; end

      include Concerns::CursorPagination
      include Karte::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, user_repo: nil, get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @user_repo = user_repo
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, limit: 20, cursor: nil)
        viewer = user_repo.find_by_id(viewer_account_id)
        raise AccessError, "Karte recent list is cast-only" unless viewer&.role == 2

        result = entry_repo.list_recent(limit: limit, cursor: cursor)
        has_more = result.length > limit
        visible = result.take(limit)

        next_cursor = if has_more && visible.any?
          last = visible.last
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more }
      end

      private

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
          rating: e.rating,
          body: e.body,
          flagged: e.reported_count >= ListEntriesByTarget::MIN_FLAG_REPORTS,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end

      def avatar_url_for(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?
        media_adapter.find_url(profile.avatar_media_id)
      end

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Karte::Adapters::MediaAdapter.new
      end
    end
  end
end
