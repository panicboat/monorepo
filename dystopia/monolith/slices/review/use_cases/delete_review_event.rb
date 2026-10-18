# frozen_string_literal: true

module Review
  module UseCases
    class DeleteReviewEvent
      include Review::Deps[
        review_repo: "repositories.review_repository",
        event_repo: "repositories.event_repository",
        authorize_guest: "use_cases.authorize_guest",
        load_own_review: "use_cases.load_own_review",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, event_id:)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)

        review = review_repo.transaction do
          record = find_event(event_id)
          locked = load_own_review.call(viewer_account_id: viewer_account_id, review_id: record.review_id, lock: true)
          find_event(event_id)
          if event_repo.count_for(locked.id) <= 1
            review_repo.delete(locked.id)
            next nil
          end

          event_repo.delete(record.id)
          review_repo.touch(locked.id)
          review_repo.refresh_last_occurred_on(locked.id)
          locked
        end
        return nil unless review

        present_reviews.call(reviews: [review_repo.find(review.id)], viewer_account_id: viewer_account_id).first
      end

      private

      def find_event(event_id)
        record = Ids.valid?(event_id) ? event_repo.find(event_id) : nil
        raise Errors::Invalid, "Event not found" unless record

        record
      end
    end
  end
end
