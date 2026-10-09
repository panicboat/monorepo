# frozen_string_literal: true

module Notifications
  module UseCases
    class UpdatePreferences
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(profile_id:, preferences:)
        row = notification_repo.upsert_preferences(profile_id: profile_id, attrs: preferences)
        GetPreferences::DEFAULT_PREFERENCES.keys.each_with_object({}) do |key, acc|
          acc[key] = row[key]
        end
      end
    end
  end
end
