# frozen_string_literal: true

module Review
  module UseCases
    class PresentReviews
      include Review::Deps[event_repo: "repositories.event_repository"]

      def initialize(summarize_profiles: nil, **deps)
        super(**deps)
        @summarize_profiles = summarize_profiles
      end

      def call(reviews:, viewer_account_id:)
        events = event_repo.list_for(reviews.map(&:id))
        summaries = summarize_profiles.call(profile_ids: reviews.flat_map { |review| [review.author_profile_id, review.target_profile_id] })
        reviews.map { |review| present(review, events.fetch(review.id, []), summaries, viewer_account_id) }
      end

      private

      def present(review, events, summaries, viewer_account_id)
        {
          id: review.id,
          author_profile_id: review.author_profile_id,
          author: summaries[review.author_profile_id.to_s],
          target_profile_id: review.target_profile_id,
          target: summaries[review.target_profile_id.to_s],
          is_mine: review.author_account_id == viewer_account_id,
          rating: review.rating,
          events: events.map { |event| present_event(event) },
          created_at: review.created_at,
          updated_at: review.updated_at,
          last_activity_at: review.last_activity_at
        }
      end

      def present_event(event)
        {
          id: event.id,
          stage: event.stage,
          outcome: event.outcome,
          tags: event.tags.to_a,
          note: event.note,
          occurred_on: event.occurred_on,
          created_at: event.created_at,
          updated_at: event.updated_at
        }
      end

      def summarize_profiles
        @summarize_profiles ||= ::Profile::Slice["use_cases.summarize_profiles"]
      end
    end
  end
end
