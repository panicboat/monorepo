# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      class ListReplies
        include Post::Deps[comment_repo: "repositories.comment_repository"]
        include ::Concerns::CursorPagination
        include Post::Concerns::ProfileAuthorResolvable

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

          # Load authors for all replies via the unified Profile slice (symmetric).
          # Profiles that cannot be resolved are omitted; the presenter renders `author: nil`.
          user_ids = replies.map(&:user_id).uniq
          authors = build_authors(user_ids)

          { replies: replies, next_cursor: next_cursor, has_more: has_more, authors: authors }
        end

        private

        def build_authors(user_ids)
          return {} if user_ids.empty?

          infos = profile_author_adapter.load(user_ids).transform_keys(&:to_s)
          user_ids.each_with_object({}) do |user_id, hash|
            info = infos[user_id.to_s]
            next unless info

            hash[user_id] = {
              id: user_id.to_s,
              name: info.display_name,
              image_url: info.avatar_url,
              user_type: ""
            }
          end
        end
      end
    end
  end
end
