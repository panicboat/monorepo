# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteEntry
      class DeleteError < StandardError; end
      class AccessError < StandardError; end

      include Karte::Deps[
        entry_repo: "repositories.entry_repository",
        authorize_cast_access: "use_cases.authorize_cast_access"
      ]

      def call(viewer_account_id:, entry_id:)
        raise AccessError, "Karte access required" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)

        entry = entry_repo.find_by_id(entry_id)
        raise DeleteError, "Entry not found" unless entry
        raise DeleteError, "Not the author" unless entry.author_account_id == viewer_account_id

        entry_repo.delete(entry_id)
        nil
      end
    end
  end
end
