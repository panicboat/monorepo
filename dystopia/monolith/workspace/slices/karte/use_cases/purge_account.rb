# frozen_string_literal: true

module Karte
  module UseCases
    class PurgeAccount
      include Karte::Deps[
        access_repo: "repositories.access_repository",
        report_repo: "repositories.report_repository"
      ]

      def call(account_id:)
        access_repo.revoke(account_id)
        report_repo.delete_by_reporter(account_id)
        nil
      end
    end
  end
end
