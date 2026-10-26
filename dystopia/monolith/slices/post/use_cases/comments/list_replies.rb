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

        def call(comment_id:, limit: DEFAULT_LIMIT, cursor: nil, exclude_author_profile_ids: nil)
          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          replies = comment_repo.list_replies(
            parent_id: comment_id,
            limit: limit,
            cursor: decoded_cursor,
            exclude_author_profile_ids: exclude_author_profile_ids
          )
          has_more = replies.length > limit
          replies = replies.first(limit) if has_more

          next_cursor = if has_more && replies.any?
            last = replies.last
            encode_cursor(created_at: last.created_at.iso8601(6), id: last.id)
          end

          author_profile_ids = replies.map(&:author_profile_id).uniq
          authors = build_authors(author_profile_ids)
          replies = replies.select { |reply| authors.key?(reply.author_profile_id) }
          mentioned_usernames = build_mentioned_usernames(replies)

          { replies: replies, next_cursor: next_cursor, has_more: has_more, authors: authors, mentioned_usernames: mentioned_usernames }
        end

        private

        def build_mentioned_usernames(replies)
          ids = replies.flat_map { |reply| reply.comment_mentions.map(&:profile_id) }.uniq
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
