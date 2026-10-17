# frozen_string_literal: true

module Review
  module UseCases
    class ReopenReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        load_own_review: "use_cases.load_own_review",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, review_id:)
        reopened = review_repo.transaction do
          review = load_own_review.call(viewer_account_id: viewer_account_id, review_id: review_id, lock: true)
          raise Errors::Invalid, "Review is open" unless review.status == "closed"

          review_repo.reopen(review.id)
        end
        present_reviews.call(reviews: [reopened], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
