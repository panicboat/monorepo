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
        { has_access: !row.nil?, granted_at: row&.granted_at }
      end
    end
  end
end
