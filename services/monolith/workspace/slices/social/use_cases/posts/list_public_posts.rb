# frozen_string_literal: true

require "base64"
require "json"

module Social
  module UseCases
    module Posts
      class ListPublicPosts
        include Social::Deps[repo: "repositories.post_repository"]

        DEFAULT_LIMIT = 20
        MAX_LIMIT = 50

        def call(limit: DEFAULT_LIMIT, cursor: nil, cast_id: nil, cast_ids: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          posts = repo.list_all_visible(
            limit: limit,
            cursor: decoded_cursor,
            cast_id: cast_id,
            cast_ids: cast_ids
          )
          has_more = posts.length > limit
          posts = posts.first(limit) if has_more

          next_cursor = if has_more && posts.any?
            last = posts.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all posts
          cast_ids = posts.map(&:cast_id).uniq
          authors = load_authors(cast_ids)

          { posts: posts, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def load_authors(cast_ids)
          return {} if cast_ids.empty?

          # Batch load all casts in a single query
          adapter = Social::Adapters::CastAdapter.new
          adapter.find_by_cast_ids(cast_ids)
        end

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
