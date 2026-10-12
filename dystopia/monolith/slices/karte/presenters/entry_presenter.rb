# frozen_string_literal: true

module Karte
  module Presenters
    class EntryPresenter
      MIN_FLAG_REPORTS = 3

      include Karte::Deps[event_repo: "repositories.event_repository"]

      def initialize(get_profiles: nil, media_adapter: nil, **kwargs)
        super(**kwargs)
        @get_profiles = get_profiles
        @media_adapter = media_adapter
      end

      def call(entries:, viewer_account_id:, include_events: false)
        return [] if entries.empty?

        ids = entries.flat_map { |entry| [entry.author_profile_id, entry.target_profile_id] }.uniq
        profiles = get_profiles.call(profile_ids: ids).to_h { |profile| [profile.id, profile] }
        avatars = media_adapter.find_urls(media_ids: profiles.values.map(&:avatar_media_id))
        summaries = include_events ? {} : event_repo.summaries(entry_ids: entries.map(&:id))
        entries.map do |entry|
          author = profiles[entry.author_profile_id]
          target = profiles[entry.target_profile_id]
          events = include_events ? event_repo.list_by_entry(entry_id: entry.id) : []
          summary = include_events ? {event_count: events.length, latest_event: events.max_by { |event| [event.created_at, event.id] }&.to_h} : summaries.fetch(entry.id)
          {
            id: entry.id, author_profile_id: entry.author_profile_id, target_profile_id: entry.target_profile_id,
            is_mine: entry.author_account_id == viewer_account_id,
            author_username: author&.username.to_s, author_avatar_url: avatars.fetch(author&.avatar_media_id, ""),
            target_username: target&.username.to_s, target_avatar_url: avatars.fetch(target&.avatar_media_id, ""),
            rating: entry.rating, body: entry.body, flagged: entry.reported_count >= MIN_FLAG_REPORTS,
            status: entry.status, closed_at: entry.closed_at, created_at: entry.created_at, updated_at: entry.updated_at,
            events: events.map(&:to_h), latest_event: summary[:latest_event], event_count: summary[:event_count]
          }
        end
      end

      private

      def get_profiles
        @get_profiles ||= ::Profile::Slice["use_cases.get_profiles"]
      end

      def media_adapter
        @media_adapter ||= Karte::Adapters::MediaAdapter.new
      end
    end
  end
end
