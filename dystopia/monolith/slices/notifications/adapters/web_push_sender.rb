# frozen_string_literal: true

require "web_push"

module Notifications
  module Adapters
    class WebPushSender
      TTL_SECONDS = 86_400
      TIMEOUT_SECONDS = 3

      def initialize(private_key_pem: Hanami.app["settings"].vapid_private_key, subject: Hanami.app["settings"].vapid_subject)
        @private_key_pem = private_key_pem.to_s.strip.empty? ? nil : private_key_pem
        @subject = subject.to_s.strip.empty? ? nil : subject
      end

      def enabled?
        !@private_key_pem.nil? && !@subject.nil?
      end

      def public_key
        return nil unless enabled?

        @public_key ||= WebPush::VapidKey.from_pem(@private_key_pem).public_key_for_push_header
      end

      def deliver(endpoint:, p256dh:, auth:, payload:, urgency:)
        WebPush.payload_send(
          message: payload,
          endpoint: endpoint,
          p256dh: p256dh,
          auth: auth,
          vapid: { subject: @subject, pem: @private_key_pem },
          ttl: TTL_SECONDS,
          urgency: urgency,
          open_timeout: TIMEOUT_SECONDS,
          read_timeout: TIMEOUT_SECONDS,
          ssl_timeout: TIMEOUT_SECONDS
        )
        :delivered
      rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
        :gone
      rescue StandardError => e
        Hanami.logger.warn("Notifications::WebPushSender failed: #{e.class}: #{e.message}")
        # SILENT: An unreachable device must not fail the action that triggered the push.
        :failed
      end
    end
  end
end
