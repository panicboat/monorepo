# frozen_string_literal: true

require "concerns/cursor_pagination"

module Notifications
  module UseCases
    # Cursor-paginated list of the recipient's notifications, with each row's
    # latest_actor hydrated to profile.v1.Profile via the Profile slice. The
    # response is bundled with the recipient's total unread_count so the frontend
    # avoids a separate round-trip on page load.
    class ListNotifications
      include Concerns::CursorPagination
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      MAX_LIMIT = 50

      # @return [Hash] { rows: Array<row>, profiles_by_actor_id: Hash, next_cursor: String|nil, has_more: Boolean, unread_count: Integer }
      def call(recipient_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        rows = notification_repo.list(recipient_id: recipient_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.latest_event_at.iso8601, id: last.id)
        end

        actor_ids = result[:items].map(&:latest_actor_id).uniq
        profiles_by_actor_id = actor_ids.each_with_object({}) do |aid, h|
          h[aid] = get_profile.call(account_id: aid)
        end

        {
          rows: result[:items],
          profiles_by_actor_id: profiles_by_actor_id,
          next_cursor: result[:next_cursor],
          has_more: result[:has_more],
          unread_count: notification_repo.count_unread(recipient_id: recipient_id)
        }
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
