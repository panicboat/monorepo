# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Follows
      class ListPendingFollowRequests
        include Concerns::CursorPagination
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        MAX_LIMIT = 50

        def call(profile_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          rows = follow_repo.list_pending_to(profile_id: profile_id, limit: limit, cursor: cursor)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
          end

          profiles = list_visible_profiles.call(profile_ids: result[:items].map(&:follower_profile_id))

          { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end

        private

        def list_visible_profiles
          @list_visible_profiles ||= Profile::Slice["use_cases.list_visible_profiles"]
        end
      end
    end
  end
end
