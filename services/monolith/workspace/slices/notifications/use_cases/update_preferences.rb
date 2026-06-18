# frozen_string_literal: true

module Notifications
  module UseCases
    # Upserts the per-account notification preferences. Caller passes all 11
    # bool fields; first-time updates create the row.
    class UpdatePreferences
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(account_id:, preferences:)
        row = notification_repo.upsert_preferences(account_id: account_id, attrs: preferences)
        GetPreferences::DEFAULT_PREFERENCES.keys.each_with_object({}) do |key, acc|
          acc[key] = row[key]
        end
      end
    end
  end
end
