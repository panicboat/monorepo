# frozen_string_literal: true

module Review
  module UseCases
    class CreateReview
      ROLE_CAST = 2

      include Review::Deps[
        review_repo: "repositories.review_repository",
        event_repo: "repositories.event_repository",
        authorize_guest: "use_cases.authorize_guest",
        validate_event: "use_cases.validate_event",
        present_reviews: "use_cases.present_reviews"
      ]

      def initialize(get_role: nil, same_account: nil, **deps)
        super(**deps)
        @get_role = get_role
        @same_account = same_account
      end

      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating:, event:)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)
        raise Errors::Invalid, "Rating must be 1..5" unless rating.nil? || (1..5).cover?(rating)
        raise Errors::Invalid, "Target must be a cast" unless cast?(target_profile_id)
        if same_account.call(profile_id: viewer_profile_id, other_profile_id: target_profile_id)
          raise Errors::Invalid, "Cannot review a profile of your own account"
        end

        attrs = validate_event.call(**event)
        review = nil
        review_repo.transaction do
          review = review_repo.create(
            author_account_id: viewer_account_id,
            author_profile_id: viewer_profile_id,
            target_profile_id: target_profile_id,
            rating: rating,
            occurred_on: attrs[:occurred_on]
          )
          event_repo.create(review_id: review.id, **attrs)
        end
        present_reviews.call(reviews: [review], viewer_account_id: viewer_account_id).first
      end

      private

      def cast?(profile_id)
        Ids.valid?(profile_id) && get_role.call(profile_id: profile_id) == ROLE_CAST
      end

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end

      def same_account
        @same_account ||= ::Profile::Slice["use_cases.same_account"]
      end
    end
  end
end
