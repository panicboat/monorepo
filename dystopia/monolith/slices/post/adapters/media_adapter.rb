# frozen_string_literal: true

module Post
  module Adapters
    class MediaAdapter
      MediaFile = Data.define(:id, :url, :thumbnail_url, :media_type, :media_key, :thumbnail_key)

      def find_by_ids(ids)
        # FALLBACK: Skip the cross-slice call when no media IDs are provided.
        return {} if ids.nil? || ids.empty?

        files = get_media_batch.call(ids: ids)
        files.each_with_object({}) do |file, hash|
          hash[file.id] = build_media_file(file)
        end
      end

      def owned_all?(profile_id:, ids:)
        ids = ids.map(&:to_s).uniq
        return true if ids.empty?

        select_owned_media_ids.call(profile_id: profile_id, ids: ids).map(&:to_s).sort == ids.sort
      end

      private

      def build_media_file(file)
        MediaFile.new(
          id: file.id,
          url: file.url,
          thumbnail_url: file.thumbnail_url,
          media_type: file.media_type,
          media_key: file.media_key,
          thumbnail_key: file.thumbnail_key
        )
      end

      def get_media_batch
        @get_media_batch ||= Media::Slice["use_cases.get_media_batch"]
      end

      def select_owned_media_ids
        @select_owned_media_ids ||= Media::Slice["use_cases.select_owned_media_ids"]
      end
    end
  end
end
