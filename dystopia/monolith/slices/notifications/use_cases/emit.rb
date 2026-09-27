# frozen_string_literal: true

module Notifications
  module UseCases
    class Emit
      include Notifications::Deps[
        notification_repo: "repositories.notification_repository",
        get_preferences: "use_cases.get_preferences"
      ]

      PREFERENCE_FIELD_BY_TYPE = {
        "like" => :like,
        "comment" => :post,
        "reply" => :reply,
        "follow_request" => :follow,
        "follow_approved" => :follow
      }.freeze

      def call(recipient_id:, type:, target_resource_id:, actor_id:, target_post_id: nil)
        return nil if recipient_id.nil? || actor_id.nil?
        return nil if recipient_id.to_s == actor_id.to_s

        return nil if block_repo.blocked?(blocker_id: recipient_id, blocked_id: actor_id)
        return nil unless type_enabled_for?(recipient_id, type)

        notification_repo.emit(
          recipient_id: recipient_id,
          type: type,
          target_resource_id: target_resource_id,
          actor_id: actor_id,
          target_post_id: target_post_id
        )
      rescue StandardError => e
        Hanami.logger.warn("Notifications::Emit failed: #{e.class}: #{e.message}")
        # SILENT: Notification delivery failure must not fail the triggering action.
        nil
      end

      private

      def type_enabled_for?(recipient_id, type)
        field = PREFERENCE_FIELD_BY_TYPE[type.to_s]
        return true unless field # FALLBACK: Keep unknown notification fields visible.

        prefs = get_preferences.call(account_id: recipient_id)
        prefs[field] != false
      end

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
