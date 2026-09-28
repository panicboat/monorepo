# frozen_string_literal: true

module Karte
  module UseCases
    class GetMyAccess
      include Karte::Deps[
        access_repo: "repositories.access_repository"
      ]

      def initialize(access_repo: nil, **kwargs)
        super(**kwargs.merge(access_repo: access_repo).compact)
      end

      def call(viewer_account_id:)
        row = access_repo.find_by_account(viewer_account_id)
        # TODO: gate on row presence again once the billing purchase flow grants access rows
        { has_access: true, granted_at: row&.granted_at }
      end
    end
  end
end
