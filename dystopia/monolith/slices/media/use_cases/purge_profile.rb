# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class PurgeProfile
      include Media::Deps[repo: "repositories.media_repository"]

      def call(profile_id:)
        # Objects go before rows so a failed delete leaves the rows to retry from.
        repo.keys_by_uploader(profile_id).each { |key| Storage.delete(key: key) }
        repo.delete_by_uploader(profile_id)
        nil
      end
    end
  end
end
