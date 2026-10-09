# frozen_string_literal: true

require "concerns/cursor_pagination"

module Messaging
  module UseCases
    class ListThreads
      include ::Concerns::CursorPagination
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      MAX_LIMIT = 50

      def call(profile_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)

        rows = messaging_repo.list_threads(profile_id: profile_id, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          last_time = last.last_message_at || last.created_at
          encode_cursor(created_at: last_time.iso8601, id: last.id)
        end

        threads = result[:items].map do |row|
          counterpart_id = row.profile_a.to_s == profile_id.to_s ? row.profile_b : row.profile_a
          counterpart = get_profile.call(profile_id: counterpart_id)
          {
            row: row,
            counterpart: counterpart,
            hidden_sender_profile_id: counterpart ? nil : counterpart_id,
            last_message: messaging_repo.last_message(thread_id: row.id),
            unread_count: messaging_repo.unread_count(thread_id: row.id, profile_id: profile_id)
          }
        end

        {
          threads: threads,
          next_cursor: result[:next_cursor],
          has_more: result[:has_more],
          total_unread_count: messaging_repo.total_unread_count(profile_id: profile_id)
        }
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
