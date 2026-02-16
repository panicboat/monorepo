# frozen_string_literal: true

require "base64"
require "json"

module Post
  module UseCases
    module Posts
      class ListPublicPosts
        include Post::Deps[repo: "repositories.post_repository"]

        DEFAULT_LIMIT = 20
        MAX_LIMIT = 50

        def call(limit: DEFAULT_LIMIT, cursor: nil, cast_id: nil, cast_ids: nil, exclude_cast_ids: nil)
          limit = [[limit, 1].max, MAX_LIMIT].min
          decoded_cursor = decode_cursor(cursor)

          # Combined Visibility Rule:
          # Only show posts where both cast.visibility == 'public' AND post.visibility == 'public'
          adapter = Post::Adapters::CastAdapter.new
          public_cast_ids = adapter.public_cast_ids

          # If filtering by specific cast_id, check if it's a public cast
          if cast_id && !public_cast_ids.include?(cast_id)
            return { posts: [], next_cursor: nil, has_more: false, authors: {} }
          end

          # Merge filters: only include posts from public casts
          effective_cast_ids = if cast_ids && !cast_ids.empty?
            cast_ids & public_cast_ids
          elsif cast_id
            [cast_id]
          else
            public_cast_ids
          end

          return { posts: [], next_cursor: nil, has_more: false, authors: {} } if effective_cast_ids.empty?

          posts = repo.list_all_visible(
            limit: limit,
            cursor: decoded_cursor,
            cast_ids: effective_cast_ids,
            exclude_cast_ids: exclude_cast_ids
          )
          has_more = posts.length > limit
          posts = posts.first(limit) if has_more

          next_cursor = if has_more && posts.any?
            last = posts.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all posts
          author_cast_ids = posts.map(&:cast_id).uniq
          authors = load_authors(author_cast_ids)

          { posts: posts, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def load_authors(cast_ids)
          return {} if cast_ids.empty?

          adapter = Post::Adapters::CastAdapter.new
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
