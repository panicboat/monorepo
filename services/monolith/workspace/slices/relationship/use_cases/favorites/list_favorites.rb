# frozen_string_literal: true

require "concerns/cursor_pagination"

module Relationship
  module UseCases
    module Favorites
      class ListFavorites
        include Relationship::Deps[favorite_repo: "repositories.favorite_repository"]
        include Concerns::CursorPagination

        MAX_LIMIT = 200

        def call(guest_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          result = favorite_repo.list_favorites(
            guest_id: guest_id,
            limit: limit,
            cursor: decoded_cursor
          )

          cast_ids = result[:cast_ids]
          has_more = result[:has_more]

          next_cursor = nil

          { cast_ids: cast_ids, next_cursor: next_cursor, has_more: has_more }
        end

        private

      end
    end
  end
end
