# frozen_string_literal: true

module Review
  module UseCases
    class LoadOwnReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        authorize_guest: "use_cases.authorize_guest",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def call(viewer_account_id:, review_id:, require_open: false, lock: false)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)

        review = Ids.valid?(review_id) ? (lock ? review_repo.lock(review_id) : review_repo.find(review_id)) : nil
        raise Errors::Invalid, "Review not found" unless review && filter_visible_reviews.parties_visible?(review)
        raise Errors::Forbidden, "Not the author" unless review.author_account_id == viewer_account_id
        raise Errors::Invalid, "Review is closed" if require_open && review.status != "open"

        review
      end
    end
  end
end
