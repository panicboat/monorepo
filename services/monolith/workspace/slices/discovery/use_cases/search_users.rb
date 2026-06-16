# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    # Cross-slice user search. Calls Profile repository for raw rows, then
    # hydrates each row through Profile::Slice["use_cases.get_profile"] to
    # obtain the canonical Profile::V1::Profile-shaped record.
    # Pagination cursor encodes (created_at, account_id) — profiles table has
    # no separate id column, account_id is the PK.
    class SearchUsers
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50

      def call(query:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        rows = profile_repo.search_by_query(query: query, limit: limit, cursor: cursor)

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.account_id)
        end

        profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.account_id) }

        { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
      end

      private

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
