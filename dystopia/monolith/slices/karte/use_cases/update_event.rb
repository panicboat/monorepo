# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateEvent
      include Karte::Deps[entry_repo: "repositories.entry_repository", event_repo: "repositories.event_repository", mutate_entry: "use_cases.mutate_entry"]

      def call(viewer_account_id:, entry_id:, event_id:, event:)
        mutate_entry.call(viewer_account_id: viewer_account_id, entry_id: entry_id) do |entry|
          raise Domain::Errors::Validation, "出来事IDが正しくありません" unless MutateEntry::UUID_FORMAT.match?(event_id.to_s)
          input = Domain::EventRules.validate_event!(event)
          updated = event_repo.update(entry_id: entry.id, event_id: event_id, input: input)
          raise Domain::Errors::NotFound, "出来事が見つかりません" unless updated

          Domain::EventRules.validate_entry!(rating: entry.rating, body: entry.body, events: event_repo.list_by_entry(entry_id: entry.id))
          entry_repo.update(entry.id, {})
        end
      end
    end
  end
end
