# frozen_string_literal: true

require "concerns/cursor_pagination"
require "concerns/visible_page"

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

          authors = {}
          page = ::Concerns::VisiblePage.fill(
            limit: limit,
            cursor: decoded_cursor,
            fetch: ->(after) { comment_repo.list_by_post_id(post_id: post_id, limit: limit, cursor: after, exclude_author_profile_ids: exclude_author_profile_ids) },
            keep: ->(rows) {
              authors.merge!(build_authors(rows.map(&:author_profile_id).uniq))
              rows.select { |comment| authors.key?(comment.author_profile_id) }
            },
            cursor_of: ->(row) { { created_at: row.created_at, id: row.id } }
          )
          comments = page[:items]

          next_cursor = if page[:has_more] && comments.any?
            last = comments.last
            encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
          end

          authors = authors.slice(*comments.map(&:author_profile_id))
          mentioned_usernames = build_mentioned_usernames(comments)

          { comments: comments, next_cursor: next_cursor, has_more: page[:has_more], authors: authors, mentioned_usernames: mentioned_usernames }
        end

        private

        def build_mentioned_usernames(comments)
          ids = comments.flat_map { |comment| comment.comment_mentions.map(&:profile_id) }.uniq
          return {} if ids.empty?

          summarize_profiles.call(profile_ids: ids).transform_values(&:username)
        end

        def build_authors(author_profile_ids)
          return {} if author_profile_ids.empty?

          summaries = summarize_profiles.call(profile_ids: author_profile_ids)
          author_profile_ids.each_with_object({}) do |author_profile_id, hash|
            summary = summaries[author_profile_id.to_s]
            next unless summary

            hash[author_profile_id] = summary
          end
        end
      end
    end
  end
end
