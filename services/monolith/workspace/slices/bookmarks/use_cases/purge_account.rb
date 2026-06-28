# frozen_string_literal: true

module Bookmarks
  module UseCases
    class PurgeAccount
      include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

      def call(account_id:)
        bookmark_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
