# frozen_string_literal: true

require "concerns/cursor_pagination"

module Portfolio
  module UseCases
    module Cast
      module Listing
        class ListCasts
          include Portfolio::Deps[repo: "repositories.cast_repository"]
          include Concerns::CursorPagination

          MAX_LIMIT = 50

          def call(visibility_filter: nil, genre_id: nil, tag: nil, status_filter: nil, area_id: nil, query: nil, limit: DEFAULT_LIMIT, cursor: nil)
            limit = normalize_limit(limit)
            decoded_cursor = decode_cursor(cursor)

            casts = repo.list_casts_with_filters(
              visibility_filter: visibility_filter,
              genre_id: genre_id,
              tag: tag,
              status_filter: status_filter,
              area_id: area_id,
              query: query,
              limit: limit,
              cursor: decoded_cursor
            )

            has_more = casts.length > limit
            casts = casts.first(limit) if has_more

            next_cursor = if has_more && casts.any?
              last = casts.last
              encode_cursor(created_at: last.created_at.iso8601, id: last.id)
            end

            { casts: casts, next_cursor: next_cursor, has_more: has_more }
          end
        end
      end
    end
  end
end
