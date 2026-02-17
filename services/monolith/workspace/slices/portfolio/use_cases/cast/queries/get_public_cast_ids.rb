# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Queries
        # Query for getting IDs of all public, registered casts.
        # Intended for cross-slice communication (e.g., Feed slice).
        class GetPublicCastIds
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          # Get all public cast IDs.
          #
          # @return [Array<String>] array of cast IDs
          def call
            repo.public_cast_ids
          end
        end
      end
    end
  end
end
