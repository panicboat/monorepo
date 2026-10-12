# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteEvent
      include Karte::Deps[entry_repo: "repositories.entry_repository", event_repo: "repositories.event_repository", mutate_entry: "use_cases.mutate_entry"]

      def call(viewer_account_id:, entry_id:, event_id:)
        mutate_entry.call(viewer_account_id: viewer_account_id, entry_id: entry_id) do |entry|
          raise Domain::Errors::Validation, "出来事IDが正しくありません" unless MutateEntry::UUID_FORMAT.match?(event_id.to_s)
          events = event_repo.list_by_entry(entry_id: entry.id)
          raise Domain::Errors::NotFound, "出来事が見つかりません" unless events.any? { |event| event.id == event_id.downcase }
          raise Domain::Errors::Validation, "最後の出来事は削除できません" if events.length <= 1

          event_repo.delete(entry_id: entry.id, event_id: event_id)
          Domain::EventRules.validate_entry!(rating: entry.rating, body: entry.body, events: event_repo.list_by_entry(entry_id: entry.id))
          entry_repo.update(entry.id, {})
        end
      end
    end
  end
end
