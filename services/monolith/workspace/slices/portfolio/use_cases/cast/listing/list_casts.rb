# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Listing
        class ListCasts
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(visibility_filter: nil)
            repo.list_by_visibility(visibility_filter)
          end
        end
      end
    end
  end
end
