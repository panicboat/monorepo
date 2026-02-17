# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Queries
        # Query for batch-fetching casts by user IDs.
        # Intended for cross-slice communication (e.g., Post, Relationship slice).
        class GetByUserIds
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          # Find casts by user IDs.
          #
          # @param user_ids [Array<String>] user IDs to look up
          # @return [Array<Cast>] array of Cast entities
          def call(user_ids:)
            return [] if user_ids.nil? || user_ids.empty?

            repo.find_by_user_ids(user_ids)
          end
        end
      end
    end
  end
end
