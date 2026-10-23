# frozen_string_literal: true

module Review
  module UseCases
    class ListMyReviews
      NO_COUNTS = { total: 0, unrated: 0 }.freeze

      include Review::Deps[
        review_repo: "repositories.review_repository",
        authorize_guest: "use_cases.authorize_guest",
        page_reviews: "use_cases.page_reviews"
      ]

      def call(viewer_account_id:, limit:, cursor:)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)

        limit = page_reviews.limit_for(limit)
        rows = review_repo.list_by_account(author_account_id: viewer_account_id, limit: limit, cursor: cursor)
        counts = cursor.nil? ? counts_for(viewer_account_id) : NO_COUNTS
        page_reviews.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id).merge(counts: counts)
      end

      private

      def counts_for(account_id)
        rows = review_repo.parties_and_ratings_by_account(author_account_id: account_id)
        { total: rows.size, unrated: rows.count { |row| row.rating.nil? } }
      end
    end
  end
end
