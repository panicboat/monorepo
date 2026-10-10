# frozen_string_literal: true

module Messaging
  module UseCases
    class GetThread
      include Messaging::Deps[
        messaging_repo: "repositories.messaging_repository",
        send_restriction: "use_cases.send_restriction"
      ]

      ThreadNotFoundError = Class.new(StandardError)
      ForbiddenError = Class.new(StandardError)

      def initialize(get_profile: nil, **kwargs)
        super(**kwargs)
        @get_profile = get_profile
      end

      def call(thread_id:, viewer_profile_id:)
        thread = messaging_repo.find_thread(id: thread_id)
        raise ThreadNotFoundError, "thread not found" unless thread

        viewer = viewer_profile_id.to_s
        unless [thread.profile_a.to_s, thread.profile_b.to_s].include?(viewer)
          raise ForbiddenError, "viewer is not a thread participant"
        end

        counterpart_id = thread.profile_a.to_s == viewer ? thread.profile_b : thread.profile_a
        counterpart = get_profile.call(profile_id: counterpart_id)

        {
          row: thread,
          counterpart: counterpart,
          hidden_sender_profile_id: counterpart ? nil : counterpart_id,
          last_message: messaging_repo.last_message(thread_id: thread.id),
          unread_count: messaging_repo.unread_count(thread_id: thread.id, profile_id: viewer_profile_id),
          send_restriction: restriction_for(viewer_profile_id, counterpart, counterpart_id)
        }
      end

      private

      def restriction_for(viewer_profile_id, counterpart, counterpart_id)
        return :counterpart_unavailable unless counterpart

        send_restriction.call(sender_profile_id: viewer_profile_id, recipient_profile_id: counterpart_id)
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
