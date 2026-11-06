# frozen_string_literal: true

module Review
  module UseCases
    class UpdateReviewEvent
      include Review::Deps[
        review_repo: "repositories.review_repository",
        event_repo: "repositories.event_repository",
        authorize_guest: "use_cases.authorize_guest",
        load_own_review: "use_cases.load_own_review",
        validate_event: "use_cases.validate_event",
        check_media_ownership: "use_cases.check_media_ownership",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, viewer_profile_id:, event_id:, event:)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)

        attrs = validate_event.call(**event)

        review = review_repo.transaction do
          record = find_event(event_id)
          locked = load_own_review.call(viewer_account_id: viewer_account_id, review_id: record.review_id, lock: true)
          check_media_ownership.call(profile_id: viewer_profile_id, media: attrs[:media], attached_ids: event_repo.media_ids_for_event(record.id))
          updated = event_repo.update(find_event(event_id).id, **attrs.except(:media))
          event_repo.replace_media(updated.id, attrs[:media])
          review_repo.touch(locked.id)
          review_repo.refresh_last_occurred_on(locked.id)
          locked
        end
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
