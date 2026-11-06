# frozen_string_literal: true

module Review
  module UseCases
    class AddReviewEvent
      include Review::Deps[
        review_repo: "repositories.review_repository",
        event_repo: "repositories.event_repository",
        load_own_review: "use_cases.load_own_review",
        validate_event: "use_cases.validate_event",
        check_media_ownership: "use_cases.check_media_ownership",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, viewer_profile_id:, review_id:, event:)
        attrs = validate_event.call(**event)

        review = review_repo.transaction do
          locked = load_own_review.call(viewer_account_id: viewer_account_id, review_id: review_id, lock: true)
          check_media_ownership.call(profile_id: viewer_profile_id, media: attrs[:media], author_profile_id: locked.author_profile_id)
          created = event_repo.create(review_id: locked.id, **attrs.except(:media))
          event_repo.replace_media(created.id, attrs[:media])
          review_repo.record_activity(locked.id)
          review_repo.refresh_last_occurred_on(locked.id)
          locked
        end
        present_reviews.call(reviews: [review_repo.find(review.id)], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
