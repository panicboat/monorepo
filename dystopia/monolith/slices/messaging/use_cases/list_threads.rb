# frozen_string_literal: true

require "concerns/cursor_pagination"

module Messaging
  module UseCases
    # Cursor-paginated list of the viewer's threads, ordered by (last_message_at, id) DESC.
    # Each thread row is augmented with: counterpart profile (via Profile slice),
    # last_message row, unread_count, and the response carries total_unread_count
    # so the bottom-tab badge avoids a second round-trip.
    class ListThreads
      include ::Concerns::CursorPagination
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      MAX_LIMIT = 50

      def call(account_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        rows = messaging_repo.list_threads(account_id: account_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          last_time = last.last_message_at || last.created_at
          encode_cursor(created_at: last_time.iso8601, id: last.id)
        end

        threads = result[:items].map do |row|
          counterpart_id = row.account_a.to_s == account_id.to_s ? row.account_b : row.account_a
          {
            row: row,
            counterpart: get_profile.call(account_id: counterpart_id),
            last_message: messaging_repo.last_message(thread_id: row.id),
            unread_count: messaging_repo.unread_count(thread_id: row.id, account_id: account_id)
          }
        end

        {
          threads: threads,
          next_cursor: result[:next_cursor],
          has_more: result[:has_more],
          total_unread_count: messaging_repo.total_unread_count(account_id: account_id)
        }
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
