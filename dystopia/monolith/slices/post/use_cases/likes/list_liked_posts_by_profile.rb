# frozen_string_literal: true

require "concerns/cursor_pagination"
require "concerns/visible_page"

module Post
  module UseCases
    module Likes
      class ListLikedPostsByProfile
        include ::Concerns::CursorPagination
        include Post::Deps[like_repo: "repositories.like_repository"]

        MAX_LIMIT = 50

        ForbiddenError = Class.new(StandardError)

        def call(profile_id:, viewer_profile_id: nil, limit: DEFAULT_LIMIT, cursor: nil)
          unless viewer_profile_id && viewer_profile_id.to_s == profile_id.to_s
            raise ForbiddenError, "viewer cannot see another profile's likes"
          end

          limit = normalize_limit(limit)
          decoded_cursor = decode_cursor(cursor)

          posts_map = {}
          page = ::Concerns::VisiblePage.fill(
            limit: limit,
            cursor: decoded_cursor,
            fetch: ->(after) { like_repo.liked_post_ids_by_profile(profile_id: profile_id, limit: limit, cursor: after) },
            keep: ->(rows) {
              posts_map.merge!(list_posts_uc.call(post_ids: rows.map(&:post_id), viewer_profile_id: viewer_profile_id))
              rows.select { |row| posts_map.key?(row.post_id.to_s) }
            },
            cursor_of: ->(row) { { created_at: row.created_at, id: row.id } }
          )
          likes = page[:items]
          next_cursor = if page[:has_more] && likes.any?
            encode_cursor(created_at: likes.last.created_at.iso8601(6), id: likes.last.id)
          end

          {
            posts: likes.map { |row| posts_map[row.post_id.to_s] },
            next_cursor: next_cursor,
            has_more: page[:has_more]
          }
        end

        private

        def list_posts_uc
          @list_posts_uc ||= Post::Slice["use_cases.posts.list_posts_by_ids"]
        end
      end
    end
  end
end
