# frozen_string_literal: true

module Review
  module UseCases
    class HideEntry
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      include Review::Deps[
        entry_repo: "repositories.entry_repository",
        entry_parties_visible: "use_cases.entry_parties_visible"
      ]

      def call(viewer_profile_id:, entry_id:)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry && entry_parties_visible.call(entry: entry)
        raise PermissionError, "Not the target" unless entry.target_profile_id == viewer_profile_id

        entry_repo.update(entry_id, hidden: true)
      end
    end
  end
end
