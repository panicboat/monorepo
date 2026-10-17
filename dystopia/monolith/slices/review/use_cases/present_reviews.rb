# frozen_string_literal: true

module Review
  module UseCases
    class PresentReviews
      include Review::Deps[event_repo: "repositories.event_repository"]

      def initialize(get_profile: nil, media_adapter: nil, **deps)
        super(**deps)
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(reviews:, viewer_account_id:)
        events = event_repo.list_for(reviews.map(&:id))
        profiles = {}
        reviews.map { |review| present(review, events.fetch(review.id, []), profiles, viewer_account_id) }
      end

      private

      def present(review, events, profiles, viewer_account_id)
        author = profile(profiles, review.author_profile_id)
        target = profile(profiles, review.target_profile_id)
        {
          id: review.id,
          author_profile_id: review.author_profile_id,
          author_username: author&.username || "",
          author_display_name: author&.display_name || "",
          author_avatar_url: avatar_url(author),
          target_profile_id: review.target_profile_id,
          target_username: target&.username || "",
          target_display_name: target&.display_name || "",
          target_avatar_url: avatar_url(target),
          is_mine: review.author_account_id == viewer_account_id,
          rating: review.rating,
          status: review.status,
          events: events.map { |event| present_event(event) },
          created_at: review.created_at,
          updated_at: review.updated_at,
          closed_at: review.closed_at,
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

      def profile(profiles, profile_id)
        profiles.fetch(profile_id) { profiles[profile_id] = get_profile.call(profile_id: profile_id) }
      end

      def avatar_url(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?

        media_adapter.find_url(profile.avatar_media_id)
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Review::Adapters::MediaAdapter.new
      end
    end
  end
end
