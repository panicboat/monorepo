# frozen_string_literal: true

require "storage"
require "securerandom"

module Media
  module UseCases
    class GetUploadUrl
      def call(filename:, content_type:, media_type:)
        return nil if filename.to_s.empty? || content_type.to_s.empty?

        media_id = SecureRandom.uuid
        ext = File.extname(filename)
        key = "media/#{media_type}/#{media_id}#{ext}"

        url = Storage.upload_url(key: key, content_type: content_type)

        { upload_url: url, media_key: key, media_id: media_id }
      end
    end
  end
end
