# frozen_string_literal: true

module Review
  module UseCases
    class HideEntry
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def call(viewer_account_id:, entry_id:)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry
        raise PermissionError, "Not the target" unless entry.target_account_id == viewer_account_id

        entry_repo.update(entry_id, hidden: true)
      end
    end
  end
end
