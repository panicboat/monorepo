# frozen_string_literal: true

require "concerns/cursor_pagination"
require "concerns/visible_page"

module Footprints
  module UseCases
    class ListFootprints
      include ::Concerns::CursorPagination
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      MAX_LIMIT = 50

      def call(viewer_profile_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        excluded_visitor_profile_ids = excluded_visitor_profile_ids_for(viewer_profile_id)

        visitors = {}
        page = ::Concerns::VisiblePage.fill(
          limit: limit,
          cursor: cursor,
          fetch: ->(after) {
            footprints_repo.list_for_visited(
              visited_profile_id: viewer_profile_id,
              limit: limit,
              cursor: after,
              exclude_visitor_profile_ids: excluded_visitor_profile_ids
            )
          },
          keep: ->(rows) {
            visitors.merge!(summarize_profiles.call(profile_ids: rows.map { |row| row[:visitor_profile_id] }.uniq))
            rows.select { |row| visitors.key?(row[:visitor_profile_id].to_s) }
          },
          cursor_of: ->(row) { cursor_for(row) }
        )
        items = page[:items]

        last_read = footprints_repo.last_read_at(profile_id: viewer_profile_id)

        decorated = items.map do |row|
          {
            visitor_profile_id: row[:visitor_profile_id],
            visitor: visitors[row[:visitor_profile_id].to_s],
            last_visited_at: row[:last_visited_at],
            visit_count: row[:visit_count],
            is_unread: last_read.nil? || row[:last_visited_at] > last_read
          }
        end

        {
          rows: decorated,
          next_cursor: page[:has_more] && items.any? ? cursor_for(items.last) : nil,
          has_more: page[:has_more]
        }
      end

      private

      def cursor_for(row)
        encode_cursor(created_at: row[:last_visited_at].iso8601(6), id: row[:id])
      end

      def summarize_profiles
        @summarize_profiles ||= ::Profile::Slice["use_cases.summarize_profiles"]
      end

      def excluded_visitor_profile_ids_for(viewer_profile_id)
        Social::Slice["repositories.block_repository"]
          .bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id)
      end
    end
  end
end
