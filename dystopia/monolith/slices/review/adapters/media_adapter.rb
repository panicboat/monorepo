# frozen_string_literal: true

module Review
  module Adapters
    class MediaAdapter
      MediaFile = Data.define(:id, :url, :thumbnail_url)

      def owned_all?(profile_id:, ids:)
        ids = ids.map(&:to_s).uniq
        return true if ids.empty?

        select_owned_media_ids.call(profile_id: profile_id, ids: ids).map(&:to_s).sort == ids.sort
      end

      def find_by_ids(ids)
        get_media_batch.call(ids: ids).to_h do |file|
          [file.id.to_s, MediaFile.new(id: file.id.to_s, url: file.url, thumbnail_url: file.thumbnail_url)]
        end
      end

      def discard_detached(ids)
        discard_detached_media.call(ids: ids)
      end

      private

      def select_owned_media_ids
        @select_owned_media_ids ||= ::Media::Slice["use_cases.select_owned_media_ids"]
      end

      def get_media_batch
        @get_media_batch ||= ::Media::Slice["use_cases.get_media_batch"]
      end

      def discard_detached_media
        @discard_detached_media ||= ::Post::Slice["use_cases.discard_detached_media"]
      end
    end
  end
end
