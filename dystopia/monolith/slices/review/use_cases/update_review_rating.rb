# frozen_string_literal: true

module Review
  module UseCases
    class UpdateReviewRating
      include Review::Deps[
        review_repo: "repositories.review_repository",
        load_own_review: "use_cases.load_own_review",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, review_id:, rating:)
        updated = review_repo.transaction do
          review = load_own_review.call(viewer_account_id: viewer_account_id, review_id: review_id, require_open: true, lock: true)
          raise Errors::Invalid, "Rating must be 1..5" unless rating.nil? || (1..5).cover?(rating)

          review_repo.update_rating(review.id, rating)
        end
        present_reviews.call(reviews: [updated], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
