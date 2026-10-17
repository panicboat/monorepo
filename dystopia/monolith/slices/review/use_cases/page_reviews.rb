# frozen_string_literal: true

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

      def call(rows:, limit:, viewer_account_id:, order: :activity, visible: ->(page) { page })
        has_more = rows.length > limit
        page = rows.first(limit)
        {
          reviews: present_reviews.call(reviews: visible.call(page), viewer_account_id: viewer_account_id),
          next_cursor: has_more ? review_repo.cursor_for(page.last, order: order) : nil,
          has_more: has_more
        }
      end
    end
  end
end
