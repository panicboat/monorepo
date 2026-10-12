# frozen_string_literal: true

module Karte
  module UseCases
    class AddEvent
      include Karte::Deps[entry_repo: "repositories.entry_repository", event_repo: "repositories.event_repository", mutate_entry: "use_cases.mutate_entry"]

      def call(viewer_account_id:, entry_id:, event:)
        mutate_entry.call(viewer_account_id: viewer_account_id, entry_id: entry_id) do |entry|
          input = Domain::EventRules.validate_event!(event)
          event_repo.create(entry_id: entry.id, input: input)
          Domain::EventRules.validate_entry!(rating: entry.rating, body: entry.body, events: event_repo.list_by_entry(entry_id: entry.id))
          entry_repo.update(entry.id, {})
        end
      end
    end
  end
end
