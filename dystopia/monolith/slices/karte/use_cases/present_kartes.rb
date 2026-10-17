# frozen_string_literal: true

module Karte
  module UseCases
    class PresentKartes
      include Karte::Deps[event_repo: "repositories.event_repository"]

      def initialize(summarize_profiles: nil, **deps)
        super(**deps)
        @summarize_profiles = summarize_profiles
      end

      def call(kartes:, viewer_account_id:)
        events = event_repo.list_for(kartes.map(&:id))
        summaries = summarize_profiles.call(profile_ids: kartes.flat_map { |karte| [karte.author_profile_id, karte.target_profile_id] })
        kartes.map { |karte| present(karte, events.fetch(karte.id, []), summaries, viewer_account_id) }
      end

      private

      def present(karte, events, summaries, viewer_account_id)
        {
          id: karte.id,
          author_profile_id: karte.author_profile_id,
          author: summaries[karte.author_profile_id.to_s],
          target_profile_id: karte.target_profile_id,
          target: summaries[karte.target_profile_id.to_s],
          is_mine: karte.author_account_id == viewer_account_id,
          rating: karte.rating,
          status: karte.status,
          events: events.map { |event| present_event(event) },
          created_at: karte.created_at,
          updated_at: karte.updated_at,
          closed_at: karte.closed_at,
          last_activity_at: karte.last_activity_at
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
