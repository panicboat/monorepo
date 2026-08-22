# frozen_string_literal: true

require "concerns/cursor_pagination"

module Discovery
  module UseCases
    # Suggests newest-first profiles of the viewer's opposite role (cast↔guest),
    # excluding self / approved-following / bidirectionally-blocked accounts.
    # Mirrors SearchUsers: Profile repo supplies rows, get_profile hydrates them.
    class SuggestUsers
      include ::Concerns::CursorPagination

      MAX_LIMIT = 50

      # identity.users.role: 1 = guest, 2 = cast. Suggest the opposite role.
      OPPOSITE_ROLE = { 1 => 2, 2 => 1 }.freeze

      def call(viewer_account_id:, limit: DEFAULT_LIMIT, cursor: nil)
        limit = normalize_limit(limit)
        role_filter = OPPOSITE_ROLE[viewer_role(viewer_account_id)]
        exclude_ids = exclusion_ids(viewer_account_id)

        rows = profile_repo.list_recent(
          limit: limit,
          cursor: cursor,
          exclude_account_ids: exclude_ids,
          role_filter: role_filter
        )

        result = build_pagination_result(items: rows, limit: limit) do |last|
          encode_cursor(created_at: last.created_at.iso8601, id: last.account_id)
        end

        profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.account_id) }

        { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
      end

      private

      def exclusion_ids(viewer_account_id)
        following = follow_repo.following_account_ids(account_id: viewer_account_id)
        blocked = block_repo.bidirectionally_blocked_ids(account_id: viewer_account_id)
        ([viewer_account_id] + following + blocked).uniq
      end

      def viewer_role(viewer_account_id)
        user_repo.find_by_id(viewer_account_id)&.role
      end

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def user_repo
        @user_repo ||= Identity::Slice["repositories.user_repository"]
      end
    end
  end
end
