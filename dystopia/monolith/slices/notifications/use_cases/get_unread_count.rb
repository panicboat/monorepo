# frozen_string_literal: true

module Notifications
  module UseCases
    class GetUnreadCount
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(recipient_profile_id:)
        notification_repo.count_unread(recipient_profile_id: recipient_profile_id)
      end
    end
  end
end
