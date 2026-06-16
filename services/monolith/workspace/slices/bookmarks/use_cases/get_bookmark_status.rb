# frozen_string_literal: true

module Bookmarks
  module UseCases
    class GetBookmarkStatus
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(account_id:, post_ids:)
        post_ids = (post_ids || []).compact.uniq
        bookmark_repo.status_batch(account_id: account_id, post_ids: post_ids)
      end
    end
  end
end
