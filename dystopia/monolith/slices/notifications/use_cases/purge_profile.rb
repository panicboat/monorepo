# frozen_string_literal: true

module Notifications
  module UseCases
    class PurgeProfile
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(profile_id:)
        notification_repo.delete_notifications_by_profile(profile_id)
        notification_repo.delete_preferences_by_profile(profile_id)
        nil
      end
    end
  end
end
