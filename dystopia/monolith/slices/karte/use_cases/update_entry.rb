# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateEntry
      class UpdateError < StandardError; end
      class AccessError < StandardError; end

      MAX_BODY_LENGTH = 500

      include Karte::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, authorize_cast_access: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @authorize_cast_access = authorize_cast_access
      end

      def call(viewer_account_id:, entry_id:, rating: nil, body: nil)
        raise AccessError, "Karte access required" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)

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

      private

      def authorize_cast_access
        @authorize_cast_access ||= Karte::Slice["use_cases.authorize_cast_access"]
      end
    end
  end
end
