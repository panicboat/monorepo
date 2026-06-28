# frozen_string_literal: true

module Notifications
  module UseCases
    class PurgeAccount
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(account_id:)
        notification_repo.delete_notifications_by_account(account_id)
        notification_repo.delete_preferences_by_account(account_id)
        nil
      end
    end
  end
end
