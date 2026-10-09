# frozen_string_literal: true

require "storage"
require "securerandom"

module Media
  module UseCases
    class GetUploadUrl
      EXTENSION = /\A\.[a-z0-9]{1,10}\z/

      def call(filename:, content_type:, profile_id:)
        return nil if filename.to_s.empty? || content_type.to_s.empty?

        media_id = SecureRandom.uuid_v7
        # Keep the account out of the key: the key is part of every download URL, and an account id there would tie its profiles together.
        key = MediaKey.for(profile_id: profile_id, media_id: media_id, extension: extension_of(filename))

        url = Storage.upload_url(key: key, content_type: content_type)

        { upload_url: url, media_key: key, media_id: media_id }
      end

      private

      def extension_of(filename)
        extension = File.extname(filename).downcase
        EXTENSION.match?(extension) ? extension : ""
      end
    end
  end
end
