# frozen_string_literal: true

require "uri"

module Notifications
  module UseCases
    class RegisterPushSubscription
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      InvalidSubscriptionError = Class.new(StandardError)

      # The server POSTs to the endpoint, so only known push services are accepted to keep requests away from internal hosts.
      ALLOWED_HOSTS = %w[fcm.googleapis.com web.push.apple.com updates.push.services.mozilla.com].freeze
      ALLOWED_HOST_SUFFIXES = %w[.push.apple.com .push.services.mozilla.com .notify.windows.com].freeze
      MAX_ENDPOINT_LENGTH = 2048
      KEY_FORMAT = /\A[A-Za-z0-9_-]{1,256}={0,2}\z/

      def call(account_id:, profile_id:, endpoint:, p256dh:, auth:)
        raise InvalidSubscriptionError, "endpoint is not a known push service" unless allowed_endpoint?(endpoint.to_s)
        raise InvalidSubscriptionError, "subscription keys are malformed" unless KEY_FORMAT.match?(p256dh.to_s) && KEY_FORMAT.match?(auth.to_s)

        push_subscription_repo.upsert(account_id: account_id, profile_id: profile_id, endpoint: endpoint, p256dh: p256dh, auth: auth)
        nil
      end

      private

      def allowed_endpoint?(endpoint)
        return false if endpoint.length > MAX_ENDPOINT_LENGTH

        uri = URI.parse(endpoint)
        host = uri.host.to_s.downcase
        uri.is_a?(URI::HTTPS) && uri.port == 443 && uri.userinfo.nil? &&
          (ALLOWED_HOSTS.include?(host) || ALLOWED_HOST_SUFFIXES.any? { |suffix| host.end_with?(suffix) })
      rescue URI::InvalidURIError
        false
      end
    end
  end
end
