# frozen_string_literal: true

module Notifications
  module UseCases
    # Marks every unread notification for recipient_id as read.
    # Returns the number of rows affected (useful for telemetry / UI feedback).
    class MarkAllRead
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(recipient_id:)
        notification_repo.mark_all_read(recipient_id: recipient_id)
      end
    end
  end
end
