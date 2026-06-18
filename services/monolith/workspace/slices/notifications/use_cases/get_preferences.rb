# frozen_string_literal: true

module Notifications
  module UseCases
    # Returns the per-account notification preferences row.
    # New accounts have no row yet; we return a default-all-true hash so the
    # UI can render toggles without an eager insert at signup time.
    class GetPreferences
      DEFAULT_PREFERENCES = {
        push_enabled: true,
        post: true,
        like: true,
        repost: true,
        quote: true,
        reply: true,
        follow: true,
        mention: true,
        message: true,
        oshi: true,
        footprint_unread_badge: true
      }.freeze

      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(account_id:)
        row = notification_repo.get_preferences(account_id: account_id)
        return DEFAULT_PREFERENCES.dup unless row

        DEFAULT_PREFERENCES.keys.each_with_object({}) do |key, acc|
          acc[key] = row[key]
        end
      end
    end
  end
end
