# frozen_string_literal: true

module Post
  module Adapters
    class ReviewAdapter
      def media_ids_in_use(ids)
        list_media_ids_in_use.call(ids: ids)
      end

      private

      def list_media_ids_in_use
        @list_media_ids_in_use ||= Review::Slice["use_cases.list_media_ids_in_use"]
      end
    end
  end
end
