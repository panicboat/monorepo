# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class RegisterMedia
      include Media::Deps[repo: "repositories.media_repository"]

      KeyNotIssuedError = Class.new(StandardError)
      UploadMissingError = Class.new(StandardError)

      OWNER_TAG = "owner-account-id"

      def call(media_id:, media_key:, media_type:, uploader_profile_id:, owner_account_id:, filename: nil, content_type: nil, size_bytes: nil, thumbnail_key: nil)
        raise KeyNotIssuedError unless MediaKey.issued_to?(media_key, profile_id: uploader_profile_id, media_id: media_id)
        # Deleting a file removes its thumbnail object too, so a thumbnail key outside the uploader's own keys would let it remove another profile's object.
        raise KeyNotIssuedError unless thumbnail_key.nil? || MediaKey.owned_by?(thumbnail_key, profile_id: uploader_profile_id)
        # Tag before the row exists: the tag outlives the row, and an object that cannot be tagged was never uploaded.
        raise UploadMissingError unless Storage.tag(key: media_key, tags: { OWNER_TAG => owner_account_id })

        repo.create(
          id: media_id,
          media_type: media_type,
          filename: filename,
          content_type: content_type,
          size_bytes: size_bytes,
          media_key: media_key,
          thumbnail_key: thumbnail_key,
          uploader_profile_id: uploader_profile_id,
          owner_account_id: owner_account_id
        )
      end
    end
  end
end
