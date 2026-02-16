# frozen_string_literal: true

module Media
  module Repositories
    class MediaRepository < Media::DB::Repo
      def find_by_id(id)
        files.by_pk(id).one
      end

      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        files.where(id: ids).to_a
      end

      def find_by_media_key(media_key)
        files.where(media_key: media_key).one
      end

      def create(id:, media_type:, url:, thumbnail_url: nil, filename: nil, content_type: nil, size_bytes: nil, media_key: nil, thumbnail_key: nil)
        files.command(:create).call(
          id: id,
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

      def delete(id)
        files.by_pk(id).command(:delete).call
      end
    end
  end
end
