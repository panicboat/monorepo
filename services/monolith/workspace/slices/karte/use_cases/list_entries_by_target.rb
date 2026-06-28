# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module UseCases
    class ListEntriesByTarget
      class AccessError < StandardError; end

      MIN_FLAG_REPORTS = 3

      include Concerns::CursorPagination
      include Karte::Deps[
        entry_repo: "repositories.entry_repository",
        access_repo: "repositories.access_repository"
      ]

      def initialize(entry_repo: nil, access_repo: nil, get_profile: nil, media_adapter: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo, access_repo: access_repo).compact)
        @get_profile  = get_profile
        @media_adapter = media_adapter
      end

      def call(viewer_account_id:, target_account_id:, limit: 20, cursor: nil)
        raise AccessError, "Karte access required" unless access_repo.find_by_account(viewer_account_id)

        result = entry_repo.list_by_target(target_account_id: target_account_id, limit: limit, cursor: cursor)
        has_more = result.length > limit
        visible = result.take(limit)

        next_cursor = if has_more && visible.any?
          last = visible.last
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        aggregate = entry_repo.aggregate(target_account_id: target_account_id)

        profile_cache = {}
        entries = visible.map { |e| present_with_author(e, profile_cache) }

        { entries: entries, next_cursor: next_cursor, has_more: has_more, aggregate: aggregate }
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
          rating: e.rating,
          body: e.body,
          flagged: e.reported_count >= MIN_FLAG_REPORTS,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end

      def avatar_url_for(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?
        media_adapter.find_url(profile.avatar_media_id)
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
