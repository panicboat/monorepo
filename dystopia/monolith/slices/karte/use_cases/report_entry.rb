# frozen_string_literal: true

module Karte
  module UseCases
    class ReportEntry
      class ReportError < StandardError; end
      class AccessError < StandardError; end

      include Karte::Deps[
        entry_repo: "repositories.entry_repository",
        report_repo: "repositories.report_repository",
        authorize_cast_access: "use_cases.authorize_cast_access"
      ]

      def call(viewer_account_id:, entry_id:, reason:)
        raise AccessError, "Karte access required" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)

        entry = entry_repo.find_by_id(entry_id)
        raise ReportError, "Entry not found" unless entry
        raise ReportError, "Cannot report own entry" if entry.author_account_id == viewer_account_id

        inserted = report_repo.create(
          entry_id: entry_id,
          reporter_account_id: viewer_account_id,
          reason: reason
        )

        entry_repo.increment_reported_count(entry_id) if inserted

        nil
      end
    end
  end
end
