# frozen_string_literal: true

require "concerns/cursor_pagination"

module Social
  module UseCases
    module Comments
      class ListReplies
        include Social::Deps[comment_repo: "repositories.comment_repository"]
        include Concerns::CursorPagination

        MAX_LIMIT = 50

        def call(comment_id:, limit: DEFAULT_LIMIT, cursor: nil, exclude_user_ids: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          replies = comment_repo.list_replies(
            parent_id: comment_id,
            limit: limit,
            cursor: decoded_cursor,
            exclude_user_ids: exclude_user_ids
          )
          has_more = replies.length > limit
          replies = replies.first(limit) if has_more

          next_cursor = if has_more && replies.any?
            last = replies.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          # Load authors for all replies
          user_ids = replies.map(&:user_id).uniq
          authors = author_loader.load_authors(user_ids)

          { replies: replies, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def author_loader
          @author_loader ||= Social::Adapters::AuthorLoader.new
        end
      end
    end
  end
end
