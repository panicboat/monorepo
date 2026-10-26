# frozen_string_literal: true

require "concerns/cursor_pagination"
require "concerns/visible_page"

module Notifications
  module UseCases
    class ListNotifications
      include Concerns::CursorPagination
      include Notifications::Deps[
        notification_repo: "repositories.notification_repository",
        get_unread_count: "use_cases.get_unread_count"
      ]

      MAX_LIMIT = 50

      def call(recipient_profile_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        profiles_by_actor_profile_id = {}
        page = ::Concerns::VisiblePage.fill(
          limit: limit,
          cursor: cursor,
          fetch: ->(after) { notification_repo.list(recipient_profile_id: recipient_profile_id, limit: limit, cursor: after) },
          keep: ->(rows) {
            rows.map(&:latest_actor_profile_id).uniq.each do |aid|
              profiles_by_actor_profile_id[aid] = get_profile.call(profile_id: aid) unless profiles_by_actor_profile_id.key?(aid)
            end
            rows.select { |row| profiles_by_actor_profile_id[row.latest_actor_profile_id] }
          },
          cursor_of: ->(row) { cursor_for(row) }
        )
        rows = page[:items]

        {
          rows: rows,
          profiles_by_actor_profile_id: profiles_by_actor_profile_id.slice(*rows.map(&:latest_actor_profile_id)),
          next_cursor: page[:has_more] && rows.any? ? cursor_for(rows.last) : nil,
          has_more: page[:has_more],
          unread_count: get_unread_count.call(recipient_profile_id: recipient_profile_id)
        }
      end

      private

      def cursor_for(row)
        encode_cursor(created_at: row.latest_event_at.iso8601(6), id: row.id)
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
