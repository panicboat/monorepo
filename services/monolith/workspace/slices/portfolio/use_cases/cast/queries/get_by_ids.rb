# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Queries
        # Query for batch-fetching casts by IDs.
        # Intended for cross-slice communication (e.g., Post, Relationship slice).
        class GetByIds
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          # Find casts by cast IDs.
          #
          # @param cast_ids [Array<String>] cast IDs to look up
          # @return [Array<Cast>] array of Cast entities
          def call(cast_ids:)
            return [] if cast_ids.nil? || cast_ids.empty?

            repo.find_by_ids(cast_ids)
          end
        end
      end
    end
  end
end
