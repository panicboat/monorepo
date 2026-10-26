# frozen_string_literal: true

module Notifications
  module UseCases
    class Emit
      include Notifications::Deps[
        notification_repo: "repositories.notification_repository",
        send_push: "use_cases.send_push"
      ]

      def call(recipient_profile_id:, type:, target_resource_id:, actor_profile_id:, target_post_id: nil, excerpt: nil)
        return nil if recipient_profile_id.nil? || actor_profile_id.nil?
        return nil if recipient_profile_id.to_s == actor_profile_id.to_s

        return nil if block_repo.blocked?(blocker_profile_id: recipient_profile_id, blocked_profile_id: actor_profile_id)

        notification = notification_repo.emit(
          recipient_profile_id: recipient_profile_id,
          type: type,
          target_resource_id: target_resource_id,
          actor_profile_id: actor_profile_id,
          target_post_id: target_post_id
        )
        return nil if notification.nil?

        send_push.call(
          recipient_profile_id: recipient_profile_id,
          kind: type.to_s,
          actor_profile_id: actor_profile_id,
          post_id: target_post_id || target_resource_id,
          excerpt: excerpt
        )
        notification
      rescue StandardError => e
        Hanami.logger.warn("Notifications::Emit failed: #{e.class}: #{e.message}")
        # SILENT: Notification delivery failure must not fail the triggering action.
        nil
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
