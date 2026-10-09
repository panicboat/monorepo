# frozen_string_literal: true

require "concerns/cursor_pagination"

module Post
  module UseCases
    module Comments
      class ListComments
        include Post::Deps[comment_repo: "repositories.comment_repository"]
        include ::Concerns::CursorPagination
        include Post::Concerns::ProfileAuthorResolvable

        MAX_LIMIT = 50

        def call(post_id:, limit: DEFAULT_LIMIT, cursor: nil, exclude_author_profile_ids: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          comments = comment_repo.list_by_post_id(
            post_id: post_id,
            limit: limit,
            cursor: decoded_cursor,
            exclude_author_profile_ids: exclude_author_profile_ids
          )
          has_more = comments.length > limit
          comments = comments.first(limit) if has_more

          next_cursor = if has_more && comments.any?
            last = comments.last
            encode_cursor(created_at: last.created_at.iso8601, id: last.id)
          end

          author_profile_ids = comments.map(&:author_profile_id).uniq
          authors = build_authors(author_profile_ids)
          comments = comments.select { |comment| authors.key?(comment.author_profile_id) }
          mentioned_usernames = build_mentioned_usernames(comments)

          { comments: comments, next_cursor: next_cursor, has_more: has_more, authors: authors, mentioned_usernames: mentioned_usernames }
        end

        private

        def build_mentioned_usernames(comments)
          ids = comments.flat_map { |comment| comment.comment_mentions.map(&:profile_id) }.uniq
          return {} if ids.empty?

          profile_author_adapter.load(ids).transform_keys(&:to_s).transform_values(&:username)
        end

        def build_authors(author_profile_ids)
          return {} if author_profile_ids.empty?

          infos = profile_author_adapter.load(author_profile_ids).transform_keys(&:to_s)
          author_profile_ids.each_with_object({}) do |author_profile_id, hash|
            info = infos[author_profile_id.to_s]
            next unless info

            hash[author_profile_id] = {
              id: author_profile_id.to_s,
              name: info.display_name,
              image_url: info.avatar_url,
              user_type: "",
              username: info.username
            }
          end
        end
      end
    end
  end
end
