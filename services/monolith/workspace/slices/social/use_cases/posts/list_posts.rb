# frozen_string_literal: true

require "base64"
require "json"

module Social
  module UseCases
    module Posts
      class ListPosts
        include Social::Deps[repo: "repositories.post_repository"]

        DEFAULT_LIMIT = 20
        MAX_LIMIT = 50

        def call(cast_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          posts = repo.list_by_cast_id(cast_id: cast_id, limit: limit, cursor: decoded_cursor)
          has_more = posts.length > limit
          posts = posts.first(limit) if has_more

          next_cursor = if has_more && posts.any?
            last = posts.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          { posts: posts, next_cursor: next_cursor, has_more: has_more }
        end

        private

        def decode_cursor(cursor)
          return nil if cursor.nil? || cursor.empty?

          parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
          { created_at: Time.parse(parsed["created_at"]), id: parsed["id"] }
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
