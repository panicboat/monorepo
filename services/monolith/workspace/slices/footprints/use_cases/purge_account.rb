# frozen_string_literal: true

module Footprints
  module UseCases
    class PurgeAccount
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(account_id:)
        footprints_repo.delete_visits_by_account(account_id)
        footprints_repo.delete_read_state_by_account(account_id)
        nil
      end
    end
  end
end
