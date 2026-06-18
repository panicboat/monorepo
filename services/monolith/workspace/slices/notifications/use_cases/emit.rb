# frozen_string_literal: true

module Notifications
  module UseCases
    # Fire-and-forget notification emit. Applies suppression (self-action skip,
    # block-aware skip) then idempotently upserts via NotificationRepository#emit.
    #
    # Returns the resulting row on success, nil on suppression or failure.
    # Callers (cross-slice from Post / Social use_cases) should NOT rescue or branch
    # on the return value -- emit must never disrupt the source action.
    class Emit
      include Notifications::Deps[
        notification_repo: "repositories.notification_repository",
        get_preferences: "use_cases.get_preferences"
      ]

      # Mapping notification type → preferences toggle field.
      # COMMENT maps to `post` because rx-sns lacks a dedicated comment-on-post
      # toggle; ポスト is the closest equivalent. FOLLOW_REQUEST + FOLLOW_APPROVED
      # share the single `follow` toggle.
      PREFERENCE_FIELD_BY_TYPE = {
        "like" => :like,
        "comment" => :post,
        "reply" => :reply,
        "follow_request" => :follow,
        "follow_approved" => :follow
      }.freeze

      # @param recipient_id [String] account_id receiving the notification
      # @param type [String] one of: 'like' | 'comment' | 'reply' | 'follow_request' | 'follow_approved'
      # @param target_resource_id [String] post_id | comment_id | actor_account_id (per type)
      # @param actor_id [String] account_id who triggered the event
      # @return [Object, nil] row or nil
      def call(recipient_id:, type:, target_resource_id:, actor_id:)
        return nil if recipient_id.nil? || actor_id.nil?
        return nil if recipient_id.to_s == actor_id.to_s

        return nil if block_repo.blocked?(blocker_id: recipient_id, blocked_id: actor_id)
        return nil unless type_enabled_for?(recipient_id, type)

        notification_repo.emit(
          recipient_id: recipient_id,
          type: type,
          target_resource_id: target_resource_id,
          actor_id: actor_id
        )
      rescue StandardError => e
        Hanami.logger.warn("Notifications::Emit failed: #{e.class}: #{e.message}")
        nil
      end

      private

      def type_enabled_for?(recipient_id, type)
        field = PREFERENCE_FIELD_BY_TYPE[type.to_s]
        return true unless field  # unknown type → fail open (don't suppress)

        prefs = get_preferences.call(account_id: recipient_id)
        prefs[field] != false
      end

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end
    end
  end
end
