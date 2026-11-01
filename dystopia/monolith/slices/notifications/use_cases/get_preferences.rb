# frozen_string_literal: true

module Notifications
  module UseCases
    class GetPreferences
      DEFAULT_PREFERENCES = {
        comment: true,
        like: true,
        reply: true,
        follow: true,
        mention: true,
        quote: true,
        message: true,
        footprint_unread_badge: true,
        footprints_record_my_visits: true
      }.freeze

      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(profile_id:)
        row = notification_repo.get_preferences(profile_id: profile_id)
        return DEFAULT_PREFERENCES.dup unless row

        DEFAULT_PREFERENCES.keys.each_with_object({}) do |key, acc|
          acc[key] = row[key]
        end
      end
    end
  end
end
