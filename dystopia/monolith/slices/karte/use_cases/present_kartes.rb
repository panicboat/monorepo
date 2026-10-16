# frozen_string_literal: true

module Karte
  module UseCases
    class PresentKartes
      include Karte::Deps[event_repo: "repositories.event_repository"]

      def initialize(get_profile: nil, media_adapter: nil, **deps)
        super(**deps)
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(kartes:, viewer_account_id:)
        events = event_repo.list_for(kartes.map(&:id))
        profiles = {}
        kartes.map { |karte| present(karte, events.fetch(karte.id, []), profiles, viewer_account_id) }
      end

      private

      def present(karte, events, profiles, viewer_account_id)
        author = profile(profiles, karte.author_profile_id)
        target = profile(profiles, karte.target_profile_id)
        {
          id: karte.id,
          author_profile_id: karte.author_profile_id,
          author_username: author&.username || "",
          author_avatar_url: avatar_url(author),
          target_profile_id: karte.target_profile_id,
          target_username: target&.username || "",
          target_avatar_url: avatar_url(target),
          is_mine: karte.author_account_id == viewer_account_id,
          rating: karte.rating,
          status: karte.status,
          events: events.map { |event| present_event(event) },
          created_at: karte.created_at,
          updated_at: karte.updated_at,
          closed_at: karte.closed_at
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
        @media_adapter ||= Karte::Adapters::MediaAdapter.new
      end
    end
  end
end
