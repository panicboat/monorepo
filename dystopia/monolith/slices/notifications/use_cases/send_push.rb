# frozen_string_literal: true

require "json"

module Notifications
  module UseCases
    class SendPush
      include Notifications::Deps[
        push_subscription_repo: "repositories.push_subscription_repository",
        get_preferences: "use_cases.get_preferences",
        build_push_message: "use_cases.build_push_message",
        profile_adapter: "adapters.profile_adapter",
        web_push_sender: "adapters.web_push_sender"
      ]

      PREFERENCE_FIELD_BY_KIND = {
        "like" => :like,
        "comment" => :comment,
        "reply" => :reply,
        "mention" => :mention,
        "follow_request" => :follow,
        "follow" => :follow,
        "message" => :message
      }.freeze

      def call(recipient_profile_id:, kind:, actor_profile_id:, post_id: nil, thread_id: nil, excerpt: nil)
        # FALLBACK: An environment without a VAPID key sends nothing.
        return nil unless web_push_sender.enabled?

        preferences = get_preferences.call(profile_id: recipient_profile_id)
        return nil unless preferences[:push_enabled] && preferences[PREFERENCE_FIELD_BY_KIND.fetch(kind)]

        recipient = profile_adapter.find(recipient_profile_id)
        actor = profile_adapter.find(actor_profile_id)
        return nil unless recipient && actor

        subscriptions = push_subscription_repo.list_by_account(recipient.account_id)
        return nil if subscriptions.empty?

        payload = JSON.generate(
          build_push_message.call(
            kind: kind, actor: actor, recipient: recipient,
            shared_device: profile_adapter.visible_count(recipient.account_id) > 1,
            post_id: post_id, thread_id: thread_id, excerpt: excerpt
          )
        )
        deliver_all(subscriptions, payload, kind == "message" ? "high" : "normal")
        nil
      rescue StandardError => e
        Hanami.logger.warn("Notifications::SendPush failed: #{e.class}: #{e.message}")
        # SILENT: A push that cannot be sent must not fail the action that triggered it.
        nil
      end

      private

      # Database work stays on this thread; the worker threads only wait on the push services.
      def deliver_all(subscriptions, payload, urgency)
        outcomes = subscriptions.map do |subscription|
          Thread.new do
            web_push_sender.deliver(endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth, payload: payload, urgency: urgency)
          end
        end.map(&:value)

        subscriptions.zip(outcomes).each do |subscription, outcome|
          push_subscription_repo.delete_by_endpoint(subscription.endpoint) if outcome == :gone
        end
      end
    end
  end
end
