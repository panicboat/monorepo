# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class PurgeProfile
      FileDeletionError = Class.new(StandardError)

      include Media::Deps[repo: "repositories.media_repository"]

      def call(profile_id:)
        # Adapters return false instead of raising, so check it; the rows must outlive a failed delete to retry from.
        repo.keys_by_uploader(profile_id).each do |key|
          raise FileDeletionError, "failed to delete #{key}" unless Storage.delete(key: key)
        end
        repo.delete_by_uploader(profile_id)
        nil
      end
    end
  end
end
