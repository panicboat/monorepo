# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteEntry
      class DeleteError < StandardError; end
      class AccessError < StandardError; end

      include Karte::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, authorize_cast_access: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @authorize_cast_access = authorize_cast_access
      end

      def call(viewer_account_id:, entry_id:)
        raise AccessError, "Karte access required" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)

        entry = entry_repo.find_by_id(entry_id)
        raise DeleteError, "Entry not found" unless entry
        raise DeleteError, "Not the author" unless entry.author_account_id == viewer_account_id

        entry_repo.delete(entry_id)
        nil
      end

      private

      def authorize_cast_access
        @authorize_cast_access ||= Karte::Slice["use_cases.authorize_cast_access"]
      end
    end
  end
end
