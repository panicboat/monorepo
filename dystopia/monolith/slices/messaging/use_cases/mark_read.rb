# frozen_string_literal: true

module Messaging
  module UseCases
    class MarkRead
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      ThreadNotFoundError = Class.new(StandardError)
      ForbiddenError = Class.new(StandardError)

      def call(thread_id:, viewer_profile_id:, message_id:)
        thread = messaging_repo.find_thread(id: thread_id)
        raise ThreadNotFoundError, "thread not found" unless thread

        viewer = viewer_profile_id.to_s
        a = thread.profile_a.to_s
        b = thread.profile_b.to_s
        unless [a, b].include?(viewer)
          raise ForbiddenError, "viewer is not a thread participant"
        end

        last_id = (message_id && !message_id.to_s.empty?) ? message_id.to_s : nil

        messaging_repo.upsert_read_state(
          thread_id: thread_id,
          profile_id: viewer,
          last_read_message_id: last_id
        )

        {}
      end
    end
  end
end
