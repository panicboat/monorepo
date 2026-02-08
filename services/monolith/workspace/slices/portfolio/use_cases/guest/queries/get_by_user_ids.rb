# frozen_string_literal: true

module Portfolio
  module UseCases
    module Guest
      module Queries
        # Query for batch-fetching guests by user IDs.
        # Intended for cross-slice communication (e.g., Social slice).
        class GetByUserIds
          include Portfolio::Deps[repo: "repositories.guest_repository"]

          # Find guests by user IDs.
          #
          # @param user_ids [Array<String>] user IDs to look up
          # @return [Array<Guest>] array of Guest entities
          def call(user_ids:)
            return [] if user_ids.nil? || user_ids.empty?

            repo.find_by_user_ids(user_ids)
          end
        end
      end
    end
  end
end
