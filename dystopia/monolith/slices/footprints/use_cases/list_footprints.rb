# frozen_string_literal: true

require "concerns/cursor_pagination"

module Footprints
  module UseCases
    class ListFootprints
      include ::Concerns::CursorPagination
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      MAX_LIMIT = 50

      def call(viewer_profile_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        excluded_visitor_profile_ids = excluded_visitor_profile_ids_for(viewer_profile_id)

        rows = footprints_repo.list_for_visited(
          visited_profile_id: viewer_profile_id,
          limit: limit,
          cursor: cursor,
          exclude_visitor_profile_ids: excluded_visitor_profile_ids
        )

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last[:last_visited_at].iso8601, id: last[:id])
        end

        last_read = footprints_repo.last_read_at(profile_id: viewer_profile_id)

        decorated = result[:items].map do |row|
          {
            visitor_profile_id: row[:visitor_profile_id],
            last_visited_at: row[:last_visited_at],
            visit_count: row[:visit_count],
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

      def excluded_visitor_profile_ids_for(viewer_profile_id)
        Social::Slice["repositories.block_repository"]
          .bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id)
      end
    end
  end
end
