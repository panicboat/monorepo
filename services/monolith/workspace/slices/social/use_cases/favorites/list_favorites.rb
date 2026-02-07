# frozen_string_literal: true

require "base64"
require "json"

module Social
  module UseCases
    module Favorites
      class ListFavorites
        include Social::Deps[favorite_repo: "repositories.favorite_repository"]

        DEFAULT_LIMIT = 100
        MAX_LIMIT = 200

        def call(guest_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          result = favorite_repo.list_favorites(
            guest_id: guest_id,
            limit: limit,
            cursor: decoded_cursor
          )

          cast_ids = result[:cast_ids]
          has_more = result[:has_more]

          next_cursor = nil

          { cast_ids: cast_ids, next_cursor: next_cursor, has_more: has_more }
        end

        private

        def decode_cursor(cursor)
          return nil if cursor.nil? || cursor.empty?

          parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
          { created_at: Time.parse(parsed["created_at"]) }
        rescue StandardError
          nil
        end

        def encode_cursor(data)
          Base64.urlsafe_encode64(JSON.generate(data), padding: false)
        end
      end
    end
  end
end
