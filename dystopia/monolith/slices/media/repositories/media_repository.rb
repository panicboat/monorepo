# frozen_string_literal: true

require "storage"

module Media
  module Repositories
    class MediaRepository < Media::DB::Repo
      MediaRecord = Data.define(
        :id, :media_type, :url, :thumbnail_url, :filename, :content_type,
        :size_bytes, :media_key, :thumbnail_key, :created_at, :uploader_profile_id
      )

      def find_by_id(id)
        resolve_urls(files.by_pk(id).one)
      end

      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        files.where(id: ids).to_a.map { |file| resolve_urls(file) }
      end

      def create(id:, media_type:, filename: nil, content_type: nil, size_bytes: nil, media_key: nil, thumbnail_key: nil, uploader_profile_id: nil, owner_account_id: nil)
        resolve_urls(files.command(:create).call(
          id: id,
          media_type: media_type,
          filename: filename,
          content_type: content_type,
          size_bytes: size_bytes,
          media_key: media_key,
          thumbnail_key: thumbnail_key,
          uploader_profile_id: uploader_profile_id,
          owner_account_id: owner_account_id
        ))
      end

      def delete(id)
        files.by_pk(id).command(:delete).call
      end

      def delete_by_uploader(profile_id)
        files.where(uploader_profile_id: profile_id).command(:delete).call
      end

      private

      def resolve_urls(media)
        return nil unless media

        MediaRecord.new(
          id: media.id,
          media_type: media.media_type,
          url: Storage.download_url(key: media.media_key),
          thumbnail_url: Storage.download_url(key: media.thumbnail_key),
          filename: media.filename,
          content_type: media.content_type,
          size_bytes: media.size_bytes,
          media_key: media.media_key,
          thumbnail_key: media.thumbnail_key,
          created_at: media.created_at,
          uploader_profile_id: media.uploader_profile_id
        )
      end
    end
  end
end
