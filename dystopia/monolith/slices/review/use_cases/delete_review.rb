# frozen_string_literal: true

module Review
  module UseCases
    class DeleteReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        load_own_review: "use_cases.load_own_review"
      ]

      def call(viewer_account_id:, review_id:)
        review = load_own_review.call(viewer_account_id: viewer_account_id, review_id: review_id)
        review_repo.delete(review.id)
        nil
      end
    end
  end
end
