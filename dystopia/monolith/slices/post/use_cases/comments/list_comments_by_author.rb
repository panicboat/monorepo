# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      # Lists comments authored by `author_id` (newest first) for the "返信" tab on /u/[username].
      # Hydrates parent posts via the shared `list_posts_by_ids` use_case so the UI can render
      # quoted parent posts; visibility filtering for parent posts is applied transitively
      # via `Social::FilterVisiblePosts` inside `ListPostsByIds`.
      class ListCommentsByAuthor
        include ::Concerns::CursorPagination
        include Post::Deps[comment_repo: "repositories.comment_repository"]

        MAX_LIMIT = 50

        def call(author_id:, viewer_account_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          rows = comment_repo.list_by_author(
            author_id: author_id,
            limit: limit,
            cursor: decoded_cursor
          )

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Hydrate parent posts, keyed by post_id string. Frontend joins by comment.post_id.
          post_ids = result[:items].map(&:post_id).uniq
          posts_by_id = list_posts_uc.call(post_ids: post_ids, viewer_account_id: viewer_account_id)

          {
            comments: result[:items],
            posts_by_id: posts_by_id,
            next_cursor: result[:next_cursor],
            has_more: result[:has_more]
          }
        end

        private

        def list_posts_uc
          @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
        end
      end
    end
  end
end
