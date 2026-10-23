# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class PurgeProfile
      FileDeletionError = Class.new(StandardError)

      include Media::Deps[repo: "repositories.media_repository"]

      def call(profile_id:)
        # Adapters return false instead of raising, so check it; the rows must outlive a failed delete to retry from.
        keys = repo.keys_by_uploader(profile_id)
        raise FileDeletionError, "failed to delete #{keys.size} files of profile #{profile_id}" unless Storage.delete_many(keys: keys)

        repo.delete_by_uploader(profile_id)
        nil
      end
    end
  end
end
