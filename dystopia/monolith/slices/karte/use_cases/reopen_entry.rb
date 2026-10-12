# frozen_string_literal: true

module Karte
  module UseCases
    class ReopenEntry
      include Karte::Deps[entry_repo: "repositories.entry_repository", mutate_entry: "use_cases.mutate_entry"]

      def call(viewer_account_id:, entry_id:)
        mutate_entry.call(viewer_account_id: viewer_account_id, entry_id: entry_id, require_open: false) do |entry|
          next entry if entry.status == "open"

          entry_repo.update(entry.id, status: "open", closed_at: nil)
        end
      end
    end
  end
end
