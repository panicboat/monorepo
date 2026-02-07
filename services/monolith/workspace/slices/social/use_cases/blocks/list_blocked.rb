# frozen_string_literal: true

require "base64"
require "json"
require "storage"

module Social
  module UseCases
    module Blocks
      class ListBlocked
        include Social::Deps[
          block_repo: "repositories.block_repository",
          cast_adapter: "adapters.cast_adapter",
          guest_adapter: "adapters.guest_adapter"
        ]

        DEFAULT_LIMIT = 50
        MAX_LIMIT = 100

        def call(blocker_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          result = block_repo.list_blocked(
            blocker_id: blocker_id,
            limit: limit,
            cursor: decoded_cursor
          )

          records = result[:records]
          has_more = result[:has_more]

          # Fetch user details for blocked users
          users = records.map do |record|
            user_info = fetch_user_info(record.blocked_id, record.blocked_type)
            {
              id: record.blocked_id,
              user_type: record.blocked_type,
              name: user_info[:name],
              image_url: user_info[:image_url],
              blocked_at: record.created_at.iso8601
            }
          end

          next_cursor = nil
          if has_more && records.any?
            last = records.last
            next_cursor = encode_cursor({ created_at: last.created_at.iso8601 })
          end

          { users: users, next_cursor: next_cursor, has_more: has_more }
        end

        private

        def fetch_user_info(user_id, user_type)
          if user_type == "cast"
            cast = cast_adapter.find_by_id(user_id)
            if cast
              # Use avatar_path if available, otherwise fall back to image_path
              image_key = cast.avatar_path.to_s.empty? ? cast.image_path : cast.avatar_path
              return { name: cast.name || "Unknown", image_url: Storage.download_url(key: image_key) }
            end
          elsif user_type == "guest"
            guest = guest_adapter.find_by_id(user_id)
            if guest
              return { name: guest.name || "Unknown", image_url: Storage.download_url(key: guest.avatar_path) }
            end
          end
          { name: "Unknown", image_url: nil }
        end

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
