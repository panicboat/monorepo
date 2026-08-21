# frozen_string_literal: true

module Karte
  module Adapters
    class MediaAdapter
      def find_url(media_id)
        return "" if media_id.nil? || media_id.to_s.empty?
        files = get_media_batch.call(ids: [media_id])
        files.first&.url || ""
      end

      private

      def get_media_batch
        @get_media_batch ||= ::Media::Slice["use_cases.get_media_batch"]
      end
    end
  end
end
