# frozen_string_literal: true

module Footprints
  module UseCases
    # Count of visits to account_id with last_visited_at > last_read_visit_at.
    # When no read_state row exists, all visits are unread.
    class GetUnreadCount
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(account_id:)
        footprints_repo.count_unread(account_id: account_id)
      end
    end
  end
end
