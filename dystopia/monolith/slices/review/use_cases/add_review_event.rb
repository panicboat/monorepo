# frozen_string_literal: true

module Review
  module UseCases
    class AddReviewEvent
      include Review::Deps[
        review_repo: "repositories.review_repository",
        event_repo: "repositories.event_repository",
        load_own_review: "use_cases.load_own_review",
        validate_event: "use_cases.validate_event",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, review_id:, event:)
        review = review_repo.transaction do
          locked = load_own_review.call(viewer_account_id: viewer_account_id, review_id: review_id, require_open: true, lock: true)
          event_repo.create(review_id: locked.id, **validate_event.call(**event))
          review_repo.record_activity(locked.id)
          review_repo.refresh_last_occurred_on(locked.id)
          locked
        end
        present_reviews.call(reviews: [review_repo.find(review.id)], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
