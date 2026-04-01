# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Queries
        # Query for getting IDs of public, registered casts filtered by prefecture.
        # Falls back to all public cast IDs when no prefecture is specified.
        # Intended for cross-slice communication (e.g., Feed slice).
        class GetPublicCastIdsInPrefecture
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          # Get public cast IDs filtered by prefecture.
          #
          # @param prefecture [String, nil] prefecture name to filter by
          # @return [Array<String>] array of cast IDs
          def call(prefecture:)
            return repo.public_cast_ids if prefecture.nil? || prefecture.empty?

            area_ids = repo.area_ids_by_prefecture(prefecture)
            return [] if area_ids.empty?

            cast_user_ids_in_prefecture = repo.cast_user_ids_by_area_ids(area_ids)
            public_ids = repo.public_cast_ids
            public_ids & cast_user_ids_in_prefecture
          end
        end
      end
    end
  end
end
