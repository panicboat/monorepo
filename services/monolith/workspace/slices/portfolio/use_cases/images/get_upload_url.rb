# frozen_string_literal: true

require "storage"
require "securerandom"

module Portfolio
  module UseCases
    module Images
      class GetUploadUrl
        include Dry::Monads[:result]

        # @param user_id [String] User ID
        # @param filename [String] Original filename
        # @param content_type [String] MIME type
        # @param prefix [String] Storage prefix ('casts' or 'guests')
        def call(user_id:, filename:, content_type:, prefix: "casts")
          return Failure(:invalid_input) if filename.to_s.empty? || content_type.to_s.empty?

          ext = File.extname(filename)
          key = "#{prefix}/#{user_id}/uploads/#{SecureRandom.uuid}#{ext}"

          url = Storage.upload_url(key: key, content_type: content_type)

          Success(url: url, key: key)
        end
      end
    end
  end
end
