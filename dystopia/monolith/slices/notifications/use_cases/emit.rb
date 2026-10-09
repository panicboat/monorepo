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
        "follow_approved" => :follow,
        "mention" => :mention
      }.freeze

      def call(recipient_profile_id:, type:, target_resource_id:, actor_profile_id:, target_post_id: nil)
        return nil if recipient_profile_id.nil? || actor_profile_id.nil?
        return nil if recipient_profile_id.to_s == actor_profile_id.to_s

        return nil if block_repo.blocked?(blocker_profile_id: recipient_profile_id, blocked_profile_id: actor_profile_id)
        return nil unless type_enabled_for?(recipient_profile_id, type)

        notification_repo.emit(
          recipient_profile_id: recipient_profile_id,
          type: type,
          target_resource_id: target_resource_id,
          actor_profile_id: actor_profile_id,
          target_post_id: target_post_id
        )
      rescue StandardError => e
        Hanami.logger.warn("Notifications::Emit failed: #{e.class}: #{e.message}")
        # SILENT: Notification delivery failure must not fail the triggering action.
        nil
      end

      private

      def type_enabled_for?(recipient_profile_id, type)
        field = PREFERENCE_FIELD_BY_TYPE[type.to_s]
        return true unless field # FALLBACK: Keep unknown notification fields visible.

        prefs = get_preferences.call(profile_id: recipient_profile_id)
        prefs[field] != false
      end

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
