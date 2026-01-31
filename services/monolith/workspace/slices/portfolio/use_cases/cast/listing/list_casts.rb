# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Listing
        class ListCasts
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(visibility_filter: nil, genre_id: nil, tag: nil, status_filter: nil, area_id: nil, query: nil, limit: nil, offset: nil)
            repo.list_casts_with_filters(
              visibility_filter: visibility_filter,
              genre_id: genre_id,
              tag: tag,
              status_filter: status_filter,
              area_id: area_id,
              query: query,
              limit: limit,
              offset: offset
            )
          end
        end
      end
    end
  end
end
