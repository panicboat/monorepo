# frozen_string_literal: true

require "concerns/cursor_pagination"
require "concerns/visible_page"

module Post
  module UseCases
    module Comments
      class ListCommentsByAuthor
        include ::Concerns::CursorPagination
        include Post::Deps[comment_repo: "repositories.comment_repository"]
        include Post::Concerns::ProfileAuthorResolvable

        MAX_LIMIT = 50

        def call(author_profile_id:, viewer_profile_id: nil, limit: DEFAULT_LIMIT, cursor: nil, exclude_author_profile_ids: [])
          if exclude_author_profile_ids.map(&:to_s).include?(author_profile_id.to_s) || summarize_profiles.call(profile_ids: [author_profile_id]).empty?
            return { comments: [], posts_by_id: {}, authors: {}, mentioned_usernames: {}, next_cursor: nil, has_more: false }
          end

          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          posts_by_id = {}
          page = ::Concerns::VisiblePage.fill(
            limit: limit,
            cursor: decoded_cursor,
            fetch: ->(after) { comment_repo.list_by_author(author_profile_id: author_profile_id, limit: limit, cursor: after) },
            keep: ->(rows) {
              posts_by_id.merge!(list_posts_uc.call(post_ids: rows.map(&:post_id).uniq, viewer_profile_id: viewer_profile_id))
              rows.select { |comment| posts_by_id.key?(comment.post_id.to_s) && parent_readable?(comment) }
            },
            cursor_of: ->(row) { { created_at: row.created_at, id: row.id } }
          )
          comments = page[:items]
          next_cursor = if page[:has_more] && comments.any?
            encode_cursor(created_at: comments.last.created_at.iso8601(6), id: comments.last.id)
          end
          posts_by_id = posts_by_id.slice(*comments.map { |comment| comment.post_id.to_s })

          author_profile_ids = comments.map(&:author_profile_id).uniq
          authors = build_authors(author_profile_ids)
          mentioned_usernames = build_mentioned_usernames(comments)

          {
            comments: comments,
            posts_by_id: posts_by_id,
            authors: authors,
            mentioned_usernames: mentioned_usernames,
            next_cursor: next_cursor,
            has_more: page[:has_more]
          }
        end

        private

        def parent_readable?(comment)
          return true unless comment.parent_id

          parent = comment_repo.find_by_id(comment.parent_id)
          !parent.nil? && summarize_profiles.call(profile_ids: [parent.author_profile_id]).any?
        end

        def build_mentioned_usernames(comments)
          ids = comments.flat_map { |comment| comment.comment_mentions.map(&:profile_id) }.uniq
          return {} if ids.empty?

          summarize_profiles.call(profile_ids: ids).transform_values(&:username)
        end

        def list_posts_uc
          @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
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
