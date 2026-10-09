# frozen_string_literal: true

module Notifications
  module UseCases
    class MarkRead
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(id:, recipient_profile_id:)
        notification_repo.mark_read(id: id, recipient_profile_id: recipient_profile_id)
      end
    end
  end
end
