# frozen_string_literal: true

module Review
  module UseCases
    class CloseReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        load_own_review: "use_cases.load_own_review",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, review_id:)
        closed = review_repo.transaction do
          review = load_own_review.call(viewer_account_id: viewer_account_id, review_id: review_id, require_open: true, lock: true)
          raise Errors::Invalid, "Rating required to close" if review.rating.nil?

          review_repo.close(review.id)
        end
        present_reviews.call(reviews: [closed], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
