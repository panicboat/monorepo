# frozen_string_literal: true

module Review
  module UseCases
    class GetReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        filter_visible_reviews: "use_cases.filter_visible_reviews",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, viewer_profile_id:, review_id:)
        review = Ids.valid?(review_id) ? review_repo.find(review_id) : nil
        raise Errors::Invalid, "Review not found" unless review && visible?(review, viewer_account_id, viewer_profile_id)

        present_reviews.call(reviews: [review], viewer_account_id: viewer_account_id).first
      end

      private

      def visible?(review, viewer_account_id, viewer_profile_id)
        if review.author_account_id == viewer_account_id || viewer_profile_id == review.target_profile_id
          return filter_visible_reviews.parties_visible?(review)
        end

        filter_visible_reviews.recent(viewer_profile_id: viewer_profile_id, reviews: [review]).any?
      end
    end
  end
end
