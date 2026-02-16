# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class RegisterMedia
      include Media::Deps[repo: "repositories.media_repository"]

      def call(media_id:, media_key:, media_type:, filename: nil, content_type: nil, size_bytes: nil, thumbnail_key: nil)
        return nil if media_id.to_s.empty? || media_key.to_s.empty?

        url = Storage.download_url(key: media_key)
        thumbnail_url = thumbnail_key ? Storage.download_url(key: thumbnail_key) : nil

        repo.create(
          id: media_id,
          media_type: media_type,
          url: url,
          thumbnail_url: thumbnail_url,
          filename: filename,
          content_type: content_type,
          size_bytes: size_bytes,
          media_key: media_key,
          thumbnail_key: thumbnail_key
        )
      end
    end
  end
end
