# frozen_string_literal: true

module Review
  module UseCases
    class UpdateEntry
      class UpdateError < StandardError; end
      class NotFoundError < StandardError; end
      class PermissionError < StandardError; end

      MAX_BODY_LENGTH = 500
      ALLOWED_RATINGS = (1..10).map { |n| n * 0.5 }.freeze

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def call(viewer_account_id:, entry_id:, rating: nil, body: nil)
        entry = entry_repo.find_by_id(entry_id)
        raise NotFoundError, "Entry not found" unless entry
        raise PermissionError, "Not the author" unless entry.author_account_id == viewer_account_id

        if rating
          raise UpdateError, "Rating must be one of #{ALLOWED_RATINGS.join(', ')}" unless ALLOWED_RATINGS.include?(rating)
        end
        raise UpdateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        attrs = {}
        attrs[:rating] = rating if rating
        attrs[:body] = body if body

        entry_repo.update(entry_id, attrs)
      end
    end
  end
end
