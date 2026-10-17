# frozen_string_literal: true

module Review
  module UseCases
    class ListRecentReviews
      include Review::Deps[
        review_repo: "repositories.review_repository",
        page_reviews: "use_cases.page_reviews",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def call(viewer_account_id:, viewer_profile_id:, limit:, cursor:)
        limit = page_reviews.limit_for(limit)
        rows = review_repo.list_recent(limit: limit, cursor: cursor)
        page_reviews.call(
          rows: rows, limit: limit, viewer_account_id: viewer_account_id, order: :occurred,
          visible: ->(page) { filter_visible_reviews.recent(viewer_profile_id: viewer_profile_id, reviews: page) }
        )
      end
    end
  end
end
