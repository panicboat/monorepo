# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      class ListComments
        include Post::Deps[comment_repo: "repositories.comment_repository"]
        include Concerns::CursorPagination

        MAX_LIMIT = 50

        def call(post_id:, limit: DEFAULT_LIMIT, cursor: nil, exclude_user_ids: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          comments = comment_repo.list_by_post_id(
            post_id: post_id,
            limit: limit,
            cursor: decoded_cursor,
            exclude_user_ids: exclude_user_ids
          )
          has_more = comments.length > limit
          comments = comments.first(limit) if has_more

          next_cursor = if has_more && comments.any?
            last = comments.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all comments
          user_ids = comments.map(&:user_id).uniq
          authors = author_loader.load_authors(user_ids)

          { comments: comments, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def author_loader
          @author_loader ||= Post::Adapters::AuthorLoader.new
        end
      end
    end
  end
end
