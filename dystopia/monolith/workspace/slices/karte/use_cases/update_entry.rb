# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateEntry
      class UpdateError < StandardError; end
      class AccessError < StandardError; end

      MAX_BODY_LENGTH = 500

      include Karte::Deps[
        entry_repo: "repositories.entry_repository",
        access_repo: "repositories.access_repository"
      ]

      def initialize(entry_repo: nil, access_repo: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo, access_repo: access_repo).compact)
      end

      def call(viewer_account_id:, entry_id:, rating: nil, body: nil)
        raise AccessError, "Karte access required" unless access_repo.find_by_account(viewer_account_id)

        entry = entry_repo.find_by_id(entry_id)
        raise UpdateError, "Entry not found" unless entry
        raise UpdateError, "Not the author" unless entry.author_account_id == viewer_account_id

        if rating
          raise UpdateError, "Rating must be 1..5" unless (1..5).cover?(rating)
        end
        if body
          raise UpdateError, "Body too long" if body.length > MAX_BODY_LENGTH
        end

        attrs = {}
        attrs[:rating] = rating if rating
        attrs[:body] = body if body

        entry_repo.update(entry_id, attrs)
      end
    end
  end
end
