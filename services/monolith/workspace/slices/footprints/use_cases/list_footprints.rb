# frozen_string_literal: true

require "concerns/cursor_pagination"

module Footprints
  module UseCases
    # Cursor-paginated list of accounts who visited viewer_id. Mutually-blocked
    # visitors are excluded; each row gets is_unread = (last_visited_at >
    # viewer.last_read_visit_at). Visitor Profile hydration is done by the
    # handler (cross-slice cost is centralized there).
    class ListFootprints
      include ::Concerns::CursorPagination
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      MAX_LIMIT = 50

      # @return [Hash] { rows: Array<{visitor_id, last_visited_at, is_unread}>, next_cursor:, has_more: }
      def call(viewer_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        exclude_ids = excluded_visitor_ids_for(viewer_id)

        rows = footprints_repo.list_for_visited(
          visited_id: viewer_id,
          limit: limit,
          cursor: cursor,
          exclude_visitor_ids: exclude_ids
        )

        result = build_pagination_result(items: rows, limit: limit) do |last|
          # NOTE: cursor key must be `:created_at` because Concerns::CursorPagination#decode_cursor
          # only Time.parses that specific key. Repository's apply_cursor compares the decoded
          # :created_at value against the last_visited_at column.
          encode_cursor(created_at: last[:last_visited_at].iso8601, id: last[:id])
        end

        last_read = footprints_repo.last_read_at(account_id: viewer_id)

        decorated = result[:items].map do |row|
          {
            visitor_id: row[:visitor_id],
            last_visited_at: row[:last_visited_at],
            is_unread: last_read.nil? || row[:last_visited_at] > last_read
          }
        end

        {
          rows: decorated,
          next_cursor: result[:next_cursor],
          has_more: result[:has_more]
        }
      end

      private

      # Union of: visitors viewer has blocked + visitors who have blocked viewer.
      def excluded_visitor_ids_for(viewer_id)
        Social::Slice["repositories.block_repository"]
          .bidirectionally_blocked_ids(account_id: viewer_id)
      end
    end
  end
end
