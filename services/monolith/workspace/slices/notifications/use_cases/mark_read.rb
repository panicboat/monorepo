# frozen_string_literal: true

module Notifications
  module UseCases
    class MarkRead
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      # @return [Boolean] true if the row was updated, false if not found or not recipient
      def call(id:, recipient_id:)
        notification_repo.mark_read(id: id, recipient_id: recipient_id)
      end
    end
  end
end
