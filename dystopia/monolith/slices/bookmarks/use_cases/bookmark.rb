# frozen_string_literal: true

module Bookmarks
  module UseCases
    class Bookmark
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      PostNotFoundError = Class.new(StandardError)

      def call(profile_id:, post_id:)
        raise PostNotFoundError if list_readable_post_ids.call(post_ids: [post_id], viewer_profile_id: profile_id).empty?

        bookmark_repo.bookmark(profile_id: profile_id, post_id: post_id)
        {}
      end

      private

      def list_readable_post_ids
        @list_readable_post_ids ||= Post::Slice["use_cases.posts.list_readable_post_ids"]
      end
    end
  end
end
