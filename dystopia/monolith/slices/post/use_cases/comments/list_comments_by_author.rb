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

        def call(author_profile_id:, viewer_profile_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
          if summarize_profiles.call(profile_ids: [author_profile_id]).empty?
            return { comments: [], posts_by_id: {}, authors: {}, mentioned_usernames: {}, next_cursor: nil, has_more: false }
          end

          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          rows = comment_repo.list_by_author(
            author_profile_id: author_profile_id,
            limit: limit,
            cursor: decoded_cursor
          )

          result = build_pagination_result(items: rows, limit: limit) do |last|
            encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
          end

          post_ids = result[:items].map(&:post_id).uniq
          posts_by_id = list_posts_uc.call(post_ids: post_ids, viewer_profile_id: viewer_profile_id)
          comments = result[:items].select { |comment| posts_by_id.key?(comment.post_id.to_s) && parent_readable?(comment) }

          author_profile_ids = comments.map(&:author_profile_id).uniq
          authors = build_authors(author_profile_ids)
          mentioned_usernames = build_mentioned_usernames(comments)

          {
            comments: comments,
            posts_by_id: posts_by_id,
            authors: authors,
            mentioned_usernames: mentioned_usernames,
            next_cursor: result[:next_cursor],
            has_more: result[:has_more]
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
