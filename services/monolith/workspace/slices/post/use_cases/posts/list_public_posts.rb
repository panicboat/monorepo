# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Posts
      class ListPublicPosts
        include Post::Deps[repo: "repositories.post_repository"]
        include Concerns::CursorPagination

        MAX_LIMIT = 50

        def call(limit: DEFAULT_LIMIT, cursor: nil, cast_id: nil, cast_ids: nil, exclude_cast_ids: nil)
          limit = normalize_limit(limit)
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
          pagination = build_pagination_result(items: posts, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all posts
          author_cast_ids = pagination[:items].map(&:cast_id).uniq
          authors = load_authors(author_cast_ids)

          { posts: pagination[:items], next_cursor: pagination[:next_cursor], has_more: pagination[:has_more], authors: authors }
        end

        private

        def load_authors(cast_ids)
          return {} if cast_ids.empty?

          adapter = Post::Adapters::CastAdapter.new
          adapter.find_by_cast_ids(cast_ids)
        end

      end
    end
  end
end
