# frozen_string_literal: true

require "json"

module Messaging
  module UseCases
    # Ephemeral typing indicator. No DB writes — the typing state is published
    # via NOTIFY only and expires on the client (3s timer in the UI layer).
    class SendTyping
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      ThreadNotFoundError = Class.new(StandardError)
      ForbiddenError = Class.new(StandardError)

      def call(thread_id:, viewer_id:)
        thread = messaging_repo.find_thread(id: thread_id)
        raise ThreadNotFoundError, "thread not found" unless thread

        viewer = viewer_id.to_s
        a = thread.account_a.to_s
        b = thread.account_b.to_s
        unless [a, b].include?(viewer)
          raise ForbiddenError, "viewer is not a thread participant"
        end

        counterpart = viewer == a ? b : a
        publish_typing_event(thread_id: thread_id, account_id: viewer, recipient_id: counterpart)
        {}
      end

      private

      def publish_typing_event(thread_id:, account_id:, recipient_id:)
        payload = {
          type: "typing",
          data: {
            thread_id: thread_id.to_s,
            account_id: account_id.to_s
          }
        }.to_json
        notify("messaging_user_#{recipient_id}", payload)
      end

      def notify(channel, payload)
        db = messaging_repo.send(:thread_records).dataset.db
        db.notify(channel, payload: payload)
      rescue StandardError => e
        Hanami.logger.warn("Messaging::SendTyping notify failed on #{channel}: #{e.class}: #{e.message}")
        nil
      end
    end
  end
end
