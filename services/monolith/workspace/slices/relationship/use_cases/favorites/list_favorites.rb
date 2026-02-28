# frozen_string_literal: true

require "concerns/cursor_pagination"

module Relationship
  module UseCases
    module Favorites
      class ListFavorites
        include Relationship::Deps[favorite_repo: "repositories.favorite_repository"]
        include Concerns::CursorPagination

        DEFAULT_LIMIT = 100
        MAX_LIMIT = 200

        def call(guest_user_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          result = favorite_repo.list_favorites(
            guest_user_id: guest_user_id,
            limit: limit,
            cursor: decoded_cursor
          )

          cast_user_ids = result[:cast_user_ids]
          has_more = result[:has_more]

          next_cursor = nil

          { cast_user_ids: cast_user_ids, next_cursor: next_cursor, has_more: has_more }
        end

        private

      end
    end
  end
end
