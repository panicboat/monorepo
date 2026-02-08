# frozen_string_literal: true

module Portfolio
  module UseCases
    module Guest
      module Queries
        # Query for batch-fetching guests by IDs.
        # Intended for cross-slice communication (e.g., Social slice).
        class GetByIds
          include Portfolio::Deps[repo: "repositories.guest_repository"]

          # Find guests by guest IDs.
          #
          # @param guest_ids [Array<String>] guest IDs to look up
          # @return [Array<Guest>] array of Guest entities
          def call(guest_ids:)
            return [] if guest_ids.nil? || guest_ids.empty?

            repo.find_by_ids(guest_ids)
          end
        end
      end
    end
  end
end
