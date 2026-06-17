# frozen_string_literal: true

require "json"

module Messaging
  module UseCases
    # Persists the viewer's last_read_message_id for the given thread and notifies
    # the counterpart so their read-receipt UI updates immediately.
    class MarkRead
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      ThreadNotFoundError = Class.new(StandardError)
      ForbiddenError = Class.new(StandardError)

      def call(thread_id:, viewer_id:, message_id:)
        thread = messaging_repo.find_thread(id: thread_id)
        raise ThreadNotFoundError, "thread not found" unless thread

        viewer = viewer_id.to_s
        a = thread.account_a.to_s
        b = thread.account_b.to_s
        unless [a, b].include?(viewer)
          raise ForbiddenError, "viewer is not a thread participant"
        end

        counterpart = viewer == a ? b : a
        last_id = (message_id && !message_id.to_s.empty?) ? message_id.to_s : nil

        messaging_repo.upsert_read_state(
          thread_id: thread_id,
          account_id: viewer,
          last_read_message_id: last_id
        )

        publish_read_state_event(
          thread_id: thread_id,
          account_id: viewer,
          last_read_message_id: last_id,
          recipient_id: counterpart
        )

        {}
      end

      private

      def publish_read_state_event(thread_id:, account_id:, last_read_message_id:, recipient_id:)
        payload = {
          type: "read_state",
          data: {
            thread_id: thread_id.to_s,
            account_id: account_id.to_s,
            last_read_message_id: last_read_message_id.to_s
          }
        }.to_json
        notify("messaging_user_#{recipient_id}", payload)
      end

      def notify(channel, payload)
        db = messaging_repo.send(:thread_records).dataset.db
        db.notify(channel, payload: payload)
      rescue StandardError => e
        Hanami.logger.warn("Messaging::MarkRead notify failed on #{channel}: #{e.class}: #{e.message}")
        nil
      end
    end
  end
end
