# frozen_string_literal: true

require "concerns/visible_page"

module Review
  module UseCases
    class PageReviews
      DEFAULT_LIMIT = 20
      MAX_LIMIT = 50

      include Review::Deps[
        review_repo: "repositories.review_repository",
        present_reviews: "use_cases.present_reviews"
      ]

      def limit_for(raw)
        limit = raw.to_i
        limit <= 0 ? DEFAULT_LIMIT : [limit, MAX_LIMIT].min
      end

      def call(fetch:, cursor:, limit:, viewer_account_id:, viewer_profile_id: nil, order: :activity, visible: ->(page) { page })
        page = ::Concerns::VisiblePage.fill(
          limit: limit,
          cursor: cursor,
          fetch: fetch,
          keep: visible,
          cursor_of: ->(row) { review_repo.cursor_for(row, order: order) }
        )
        reviews = page[:items]
        {
          reviews: present_reviews.call(reviews: reviews, viewer_account_id: viewer_account_id, viewer_profile_id: viewer_profile_id),
          next_cursor: page[:has_more] && reviews.any? ? review_repo.cursor_for(reviews.last, order: order) : nil,
          has_more: page[:has_more]
        }
      end
    end
  end
end
