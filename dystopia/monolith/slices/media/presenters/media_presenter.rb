# frozen_string_literal: true

module Media
  module Presenters
    class MediaPresenter
      class << self
        def to_proto(media)
          return nil unless media

          ::Media::V1::Media.new(
            id: media.id,
            media_type: media_type_to_enum(media.media_type),
            url: media.url,
            # FALLBACK: Use empty values for optional fields that are nil in the database.
            thumbnail_url: media.thumbnail_url || "",
            filename: media.filename || "",
            content_type: media.content_type || "",
            size_bytes: media.size_bytes || 0,
            created_at: media.created_at&.iso8601 || ""
          )
        end

        def to_proto_list(media_list)
          return [] if media_list.nil? || media_list.empty?

          media_list.map { |m| to_proto(m) }.compact
        end

        private

        def media_type_to_enum(type)
          case type&.downcase
          when "image"
            ::Media::V1::MediaType::MEDIA_TYPE_IMAGE
          when "video"
            ::Media::V1::MediaType::MEDIA_TYPE_VIDEO
          else
            # FALLBACK: Map unknown or nil media types to UNSPECIFIED.
            ::Media::V1::MediaType::MEDIA_TYPE_UNSPECIFIED
          end
        end
      end
    end
  end
end
