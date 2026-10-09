# frozen_string_literal: true

module Bookmarks
  module UseCases
    class PurgeProfile
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(profile_id:)
        bookmark_repo.delete_by_profile(profile_id)
        nil
      end
    end
  end
end
