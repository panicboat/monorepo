# frozen_string_literal: true

module Bookmarks
  module UseCases
    class GetBookmarkStatus
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(profile_id:, post_ids:)
        post_ids = (post_ids || []).compact.uniq
        statuses = bookmark_repo.status_batch(profile_id: profile_id, post_ids: post_ids)
        bookmarked_ids = statuses.select { |_, value| value }.keys
        return statuses if bookmarked_ids.empty?

        readable_ids = list_readable_post_ids.call(post_ids: bookmarked_ids, viewer_profile_id: profile_id)
        statuses.to_h { |post_id, value| [post_id, value && readable_ids.include?(post_id.to_s)] }
      end

      private

      def list_readable_post_ids
        @list_readable_post_ids ||= Post::Slice["use_cases.posts.list_readable_post_ids"]
      end
    end
  end
end
