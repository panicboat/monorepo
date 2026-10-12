# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateEntry
      UpdateError = Domain::Errors::Validation
      AccessError = Domain::Errors::Access

      include Karte::Deps[entry_repo: "repositories.entry_repository", event_repo: "repositories.event_repository", mutate_entry: "use_cases.mutate_entry"]

      def call(viewer_account_id:, entry_id:, attrs:)
        mutate_entry.call(viewer_account_id: viewer_account_id, entry_id: entry_id) do |entry|
          raise UpdateError, "変更内容が正しくありません" unless attrs.is_a?(Hash)
          changes = attrs.slice(:rating, :body)
          next entry if changes.empty?

          changes[:body] = nil if changes[:body] == ""
          Domain::EventRules.validate_entry!(rating: changes.fetch(:rating, entry.rating), body: changes.fetch(:body, entry.body), events: event_repo.list_by_entry(entry_id: entry.id))
          entry_repo.update(entry.id, changes)
        end
      end
    end
  end
end
