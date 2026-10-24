# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class PurgeProfile
      FileDeletionError = Class.new(StandardError)

      include Media::Deps[repo: "repositories.media_repository"]

      def call(profile_id:)
        prefix = MediaKey.prefix_for(profile_id: profile_id)
        # The prefix also covers uploads that were never registered; rows can still hold keys of the older layout outside it.
        keys = repo.keys_by_uploader(profile_id).reject { |key| key.start_with?(prefix) }
        # Adapters return false instead of raising, so check it; the rows must outlive a failed delete to retry from.
        under_prefix = Storage.delete_prefix(prefix: prefix)
        outside_prefix = Storage.delete_many(keys: keys)
        raise FileDeletionError, "failed to delete the files of profile #{profile_id}" unless under_prefix && outside_prefix

        repo.delete_by_uploader(profile_id)
        nil
      end
    end
  end
end
