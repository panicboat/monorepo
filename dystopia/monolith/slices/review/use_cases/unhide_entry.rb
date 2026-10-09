# frozen_string_literal: true

module Review
  module UseCases
    class UnhideEntry
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def call(viewer_profile_id:, entry_id:)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry
        raise PermissionError, "Not the target" unless entry.target_profile_id == viewer_profile_id

        entry_repo.update(entry_id, hidden: false)
      end
    end
  end
end
