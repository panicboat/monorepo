# frozen_string_literal: true

module Profile
  module UseCases
    module Cast
      module Listing
        class GetCastCount
          include ::Profile::Deps[repo: "repositories.cast_repository"]

          def call(prefecture: nil, area_id: nil, status_filter: nil, genre_id: nil, query: nil)
            repo.count_casts_with_filters(
              prefecture: prefecture,
              area_id: area_id,
              status_filter: status_filter,
              genre_id: genre_id,
              query: query
            )
          end
        end
      end
    end
  end
end
