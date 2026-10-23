# frozen_string_literal: true

module Notifications
  module UseCases
    class PurgeProfile
      include Notifications::Deps[
        notification_repo: "repositories.notification_repository",
        push_subscription_repo: "repositories.push_subscription_repository"
      ]

      def call(profile_id:)
        notification_repo.delete_notifications_by_profile(profile_id)
        notification_repo.delete_preferences_by_profile(profile_id)
        push_subscription_repo.delete_by_profile(profile_id)
        nil
      end
    end
  end
end
