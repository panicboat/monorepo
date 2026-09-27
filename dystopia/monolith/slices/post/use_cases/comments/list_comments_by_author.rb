# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      class ListCommentsByAuthor
        include ::Concerns::CursorPagination
        include Post::Deps[comment_repo: "repositories.comment_repository"]
        include Post::Concerns::ProfileAuthorResolvable

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

          post_ids = result[:items].map(&:post_id).uniq
          posts_by_id = list_posts_uc.call(post_ids: post_ids, viewer_account_id: viewer_account_id)

          user_ids = result[:items].map(&:user_id).uniq
          authors = build_authors(user_ids)

          {
            comments: result[:items],
            posts_by_id: posts_by_id,
            authors: authors,
            next_cursor: result[:next_cursor],
            has_more: result[:has_more]
          }
        end

        private

        def list_posts_uc
          @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
        end

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
