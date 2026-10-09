# frozen_string_literal: true

module Bookmarks
  module UseCases
    class Unbookmark
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(profile_id:, post_id:)
        bookmark_repo.unbookmark(profile_id: profile_id, post_id: post_id)
        {}
      end
    end
  end
end
