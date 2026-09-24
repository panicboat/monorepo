# frozen_string_literal: true

module Media
  module UseCases
    class RegisterMedia
      include Media::Deps[repo: "repositories.media_repository"]

      def call(media_id:, media_key:, media_type:, filename: nil, content_type: nil, size_bytes: nil, thumbnail_key: nil, uploader_account_id: nil)
        return nil if media_id.to_s.empty? || media_key.to_s.empty?

        repo.create(
          id: media_id,
          media_type: media_type,
          filename: filename,
          content_type: content_type,
          size_bytes: size_bytes,
          media_key: media_key,
          thumbnail_key: thumbnail_key,
          uploader_account_id: uploader_account_id
        )
      end
    end
  end
end
