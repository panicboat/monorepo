# frozen_string_literal: true

require "base64"
require "json"

module Social
  module UseCases
    module Follows
      class ListFollowing
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        DEFAULT_LIMIT = 100
        MAX_LIMIT = 500

        def call(guest_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          follows = follow_repo.list_following(
            guest_id: guest_id,
            limit: limit,
            cursor: decoded_cursor
          )

          has_more = follows.length > limit
          follows = follows.first(limit) if has_more

          next_cursor = if has_more && follows.any?
            last = follows.last
            encode_cursor(created_at: last.created_at.iso8601)
          end

          cast_ids = follows.map(&:cast_id)

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
