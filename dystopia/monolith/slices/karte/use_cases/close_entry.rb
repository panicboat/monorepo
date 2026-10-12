# frozen_string_literal: true

module Karte
  module UseCases
    class CloseEntry
      include Karte::Deps[entry_repo: "repositories.entry_repository", event_repo: "repositories.event_repository", mutate_entry: "use_cases.mutate_entry"]

      def call(viewer_account_id:, entry_id:)
        mutate_entry.call(viewer_account_id: viewer_account_id, entry_id: entry_id, require_open: false) do |entry|
          next entry if entry.status == "closed"

          Domain::EventRules.validate_entry!(rating: entry.rating, body: entry.body, events: event_repo.list_by_entry(entry_id: entry.id))
          entry_repo.update(entry.id, status: "closed", closed_at: Sequel.function(:clock_timestamp))
        end
      end
    end
  end
end
