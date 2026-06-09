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

          # Load authors for all comments via the unified Profile slice (symmetric).
          # Profiles that cannot be resolved (e.g. account sync lag) are omitted from the hash;
          # the presenter renders `author: nil` for those comments, matching AddComment behavior.
          user_ids = comments.map(&:user_id).uniq
          authors = build_authors(user_ids)

          { comments: comments, next_cursor: next_cursor, has_more: has_more, authors: authors }
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

        def profile_author_adapter
          @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
        end
      end
    end
  end
end
