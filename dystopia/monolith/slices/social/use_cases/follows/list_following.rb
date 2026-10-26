# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Follows
      class ListFollowing
        include Concerns::CursorPagination
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        MAX_LIMIT = 50

        def call(profile_id:, limit: DEFAULT_LIMIT, cursor: nil, query: nil)
          return { profiles: [], next_cursor: nil, has_more: false } unless get_profile.call(profile_id: profile_id)

          limit = normalize_limit(limit)
          followee_profile_ids = profile_repo.visible_ids_matching(query: query) unless query.to_s.strip.empty?
          rows = follow_repo.list_following(profile_id: profile_id, limit: limit, cursor: cursor, followee_profile_ids: followee_profile_ids)

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
          end

          profiles = result[:items].filter_map { |row| get_profile.call(profile_id: row.followee_profile_id) }

          { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end

        private

        def get_profile
          @get_profile ||= Profile::Slice["use_cases.get_profile"]
        end

        def profile_repo
          @profile_repo ||= Profile::Slice["repositories.profile_repository"]
        end
      end
    end
  end
end
