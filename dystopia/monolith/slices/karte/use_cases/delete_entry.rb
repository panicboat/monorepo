# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteEntry
      DeleteError = Domain::Errors::NotFound
      AccessError = Domain::Errors::Access

      include Karte::Deps[entry_repo: "repositories.entry_repository", mutate_entry: "use_cases.mutate_entry"]

      def call(viewer_account_id:, entry_id:)
        mutate_entry.call(viewer_account_id: viewer_account_id, entry_id: entry_id, require_open: false) do |entry|
          entry_repo.delete(entry.id)
          nil
        end
      end
    end
  end
end
