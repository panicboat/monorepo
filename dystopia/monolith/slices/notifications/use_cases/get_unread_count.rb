# frozen_string_literal: true

module Notifications
  module UseCases
    class GetUnreadCount
      include Notifications::Deps[notification_repo: "repositories.notification_repository"]

      def call(recipient_profile_id:)
        actor_ids = notification_repo.unread_actor_profile_ids(recipient_profile_id: recipient_profile_id)
        visible_actor_ids = list_visible_profile_ids.call(profile_ids: actor_ids)
        notification_repo.count_unread(recipient_profile_id: recipient_profile_id, actor_profile_ids: visible_actor_ids)
      end

      private

      def list_visible_profile_ids
        @list_visible_profile_ids ||= Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
