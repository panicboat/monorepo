# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteEntry
      class DeleteError < StandardError; end
      class AccessError < StandardError; end

      include Karte::Deps[
        entry_repo: "repositories.entry_repository",
        access_repo: "repositories.access_repository"
      ]

      def initialize(entry_repo: nil, access_repo: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo, access_repo: access_repo).compact)
      end

      def call(viewer_account_id:, entry_id:)
        raise AccessError, "Karte access required" unless access_repo.find_by_account(viewer_account_id)

        entry = entry_repo.find_by_id(entry_id)
        raise DeleteError, "Entry not found" unless entry
        raise DeleteError, "Not the author" unless entry.author_account_id == viewer_account_id

        entry_repo.delete(entry_id)
        nil
      end
    end
  end
end
