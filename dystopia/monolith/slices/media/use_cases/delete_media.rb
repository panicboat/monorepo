# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class DeleteMedia
      include Media::Deps[repo: "repositories.media_repository"]

      def call(id:, profile_id:)
        media = repo.find_by_id(id)
        return false unless media && media.uploader_profile_id && media.uploader_profile_id.to_s == profile_id.to_s

        keys = [media.media_key, media.thumbnail_key].reject { |key| key.nil? || key.empty? }
        # Keep the row when a file is left behind, so the uploader can retry and the profile purge can still find the file.
        return false unless keys.map { |key| Storage.delete(key: key) }.all?

        repo.delete(id)
        true
      end
    end
  end
end
