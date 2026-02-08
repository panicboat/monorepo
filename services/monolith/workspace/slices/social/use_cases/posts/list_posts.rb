# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Posts
      class ListPosts
        include Social::Deps[repo: "repositories.post_repository"]
        include Concerns::CursorPagination

        MAX_LIMIT = 50

        def call(cast_id:, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          posts = repo.list_by_cast_id(cast_id: cast_id, limit: limit, cursor: decoded_cursor)
          result = build_pagination_result(items: posts, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          { posts: result[:items], next_cursor: result[:next_cursor], has_more: result[:has_more] }
        end
      end
    end
  end
end
