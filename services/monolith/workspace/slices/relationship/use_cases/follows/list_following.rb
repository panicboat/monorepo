# frozen_string_literal: true

require "concerns/cursor_pagination"

module Relationship
  module UseCases
    module Follows
      class ListFollowing
        include Relationship::Deps[follow_repo: "repositories.follow_repository"]
        include Concerns::CursorPagination

        DEFAULT_LIMIT = 100
        MAX_LIMIT = 500

        def call(guest_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          result = follow_repo.list_following(
            guest_id: guest_id,
            limit: limit,
            cursor: decoded_cursor
          )

          # Repository now returns { cast_ids:, has_more: }
          cast_ids = result[:cast_ids]
          has_more = result[:has_more]

          next_cursor = nil # Cursor handling simplified since repo handles pagination

          { cast_ids: cast_ids, next_cursor: next_cursor, has_more: has_more }
        end

        private

      end
    end
  end
end
