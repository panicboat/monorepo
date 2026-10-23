# frozen_string_literal: true

module Review
  module UseCases
    class LoadOwnReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        authorize_guest: "use_cases.authorize_guest"
      ]

      def call(viewer_account_id:, review_id:, lock: false)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)

        review = Ids.valid?(review_id) ? (lock ? review_repo.lock(review_id) : review_repo.find(review_id)) : nil
        raise Errors::Invalid, "Review not found" unless review
        raise Errors::Forbidden, "Not the author" unless review.author_account_id == viewer_account_id

        review
      end
    end
  end
end
