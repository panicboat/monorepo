# frozen_string_literal: true

module Review
  module UseCases
    class GetReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        filter_visible_reviews: "use_cases.filter_visible_reviews",
        present_reviews: "use_cases.present_reviews"
      ]

      def initialize(list_visible_profile_ids: nil, **deps)
        super(**deps)
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_account_id:, viewer_profile_id:, review_id:)
        review = Ids.valid?(review_id) ? review_repo.find(review_id) : nil
        raise Errors::Invalid, "Review not found" unless review && visible?(review, viewer_account_id, viewer_profile_id)

        present_reviews.call(reviews: [review], viewer_account_id: viewer_account_id).first
      end

      private

      def visible?(review, viewer_account_id, viewer_profile_id)
        return true if review.author_account_id == viewer_account_id
        return list_visible_profile_ids.call(profile_ids: [review.target_profile_id]).any? if viewer_profile_id == review.target_profile_id

        filter_visible_reviews.readable?(viewer_profile_id: viewer_profile_id, review: review)
      end

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
