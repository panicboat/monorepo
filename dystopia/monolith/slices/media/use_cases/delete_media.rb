# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class DeleteMedia
      include Media::Deps[repo: "repositories.media_repository"]

      def call(id:, profile_id:)
        media = repo.find_by_id(id)
        return false unless media && media.uploader_profile_id && media.uploader_profile_id.to_s == profile_id.to_s

        Storage.delete(key: media.media_key) if media.media_key
        Storage.delete(key: media.thumbnail_key) if media.thumbnail_key

        repo.delete(id)
        true
      end
    end
  end
end
