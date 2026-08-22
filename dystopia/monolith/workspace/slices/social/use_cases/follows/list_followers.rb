# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Follows
      class ListFollowers
        include Concerns::CursorPagination
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        MAX_LIMIT = 50

        def call(account_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          rows = follow_repo.list_followers(account_id: account_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.follower_id) }

          { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end
      end
    end
  end
end
