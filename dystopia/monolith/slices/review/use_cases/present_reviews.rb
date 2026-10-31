# frozen_string_literal: true

require "set"

module Review
  module UseCases
    class PresentReviews
      include Review::Deps[event_repo: "repositories.event_repository"]

      def initialize(summarize_profiles: nil, list_lock_passable_profile_ids: nil, **deps)
        super(**deps)
        @summarize_profiles = summarize_profiles
        @list_lock_passable_profile_ids = list_lock_passable_profile_ids
      end

      def call(reviews:, viewer_account_id:, viewer_profile_id: nil)
        events = event_repo.list_for(reviews.map(&:id))
        summaries = summarize_profiles.call(profile_ids: reviews.flat_map { |review| [review.author_profile_id, review.target_profile_id] })
        masked = masked_review_ids(reviews, summaries, viewer_account_id, viewer_profile_id)
        reviews.map do |review|
          present(review, events.fetch(review.id, []), summaries, viewer_account_id, viewer_profile_id, masked.include?(review.id))
        end
      end

      private

      def masked_review_ids(reviews, summaries, viewer_account_id, viewer_profile_id)
        locked = reviews.select { |review| locked_author?(review, summaries, viewer_account_id, viewer_profile_id) }
        return Set.new if locked.empty?

        passable = list_lock_passable_profile_ids.call(viewer_profile_id: viewer_profile_id, profile_ids: locked.map(&:author_profile_id))
        locked.reject { |review| passable.include?(review.author_profile_id.to_s.downcase) }.to_set(&:id)
      end

      def locked_author?(review, summaries, viewer_account_id, viewer_profile_id)
        summaries[review.author_profile_id.to_s]&.is_private && !author_known_to?(review, viewer_account_id, viewer_profile_id)
      end

      def author_known_to?(review, viewer_account_id, viewer_profile_id)
        review.author_account_id == viewer_account_id || review.target_profile_id == viewer_profile_id
      end

      def present(review, events, summaries, viewer_account_id, viewer_profile_id, author_hidden)
        author = author_hidden ? nil : summaries[review.author_profile_id.to_s]
        show_author_id = !author.nil? || author_known_to?(review, viewer_account_id, viewer_profile_id)
        {
          id: review.id,
          author_profile_id: show_author_id ? review.author_profile_id : "",
          author: author,
          author_hidden: author_hidden,
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

      def list_lock_passable_profile_ids
        @list_lock_passable_profile_ids ||= ::Social::Slice["use_cases.list_lock_passable_profile_ids"]
      end
    end
  end
end
