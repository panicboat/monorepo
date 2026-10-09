# frozen_string_literal: true

require "concerns/cursor_pagination"

module Notifications
  module UseCases
    class ListNotifications
      include Concerns::CursorPagination
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      MAX_LIMIT = 50

      def call(recipient_profile_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        rows = notification_repo.list(recipient_profile_id: recipient_profile_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.latest_event_at.iso8601, id: last.id)
        end

        actor_profile_ids = result[:items].map(&:latest_actor_profile_id).uniq
        profiles_by_actor_profile_id = actor_profile_ids.each_with_object({}) do |aid, h|
          h[aid] = get_profile.call(profile_id: aid)
        end

        {
          rows: result[:items].select { |row| profiles_by_actor_profile_id[row.latest_actor_profile_id] },
          profiles_by_actor_profile_id: profiles_by_actor_profile_id,
          next_cursor: result[:next_cursor],
          has_more: result[:has_more],
          unread_count: notification_repo.count_unread(recipient_profile_id: recipient_profile_id)
        }
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
