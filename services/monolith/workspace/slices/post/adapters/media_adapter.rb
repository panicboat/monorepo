# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Media data from Media slice.
    class MediaAdapter
      MediaFile = Data.define(:id, :url, :thumbnail_url, :media_type, :media_key, :thumbnail_key)

      def find_by_ids(ids)
        # FALLBACK: Skip cross-slice call when no media ids are given
        return {} if ids.nil? || ids.empty?

        files = get_media_batch.call(ids: ids)
        files.each_with_object({}) do |file, hash|
          hash[file.id] = build_media_file(file)
        end
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
    end
  end
end
