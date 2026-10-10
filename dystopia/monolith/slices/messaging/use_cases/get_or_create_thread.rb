# frozen_string_literal: true

module Messaging
  module UseCases
    class GetOrCreateThread
      include Messaging::Deps[
        messaging_repo: "repositories.messaging_repository",
        send_restriction: "use_cases.send_restriction"
      ]

      SelfMessageError = Class.new(StandardError)
      FollowRequiredError = Class.new(StandardError)
      BlockedError = Class.new(StandardError)
      RecipientUnresolvedError = Class.new(StandardError)

      def initialize(get_profile: nil, **kwargs)
        super(**kwargs)
        @get_profile = get_profile
      end

      def call(viewer_profile_id:, recipient_profile_id:)
        if recipient_profile_id.nil? || recipient_profile_id.to_s.empty?
          raise RecipientUnresolvedError, "recipient_profile_id required"
        end
        raise SelfMessageError, "viewer == recipient" if viewer_profile_id.to_s == recipient_profile_id.to_s

        counterpart = get_profile.call(profile_id: recipient_profile_id)
        raise RecipientUnresolvedError, "recipient not found" unless counterpart

        case send_restriction.call(sender_profile_id: viewer_profile_id, recipient_profile_id: recipient_profile_id)
        when :blocked then raise BlockedError, "blocked"
        when :follow_required then raise FollowRequiredError, "follow required"
        end

        profile_a, profile_b = [viewer_profile_id.to_s, recipient_profile_id.to_s].minmax
        row = messaging_repo.upsert_thread(profile_a: profile_a, profile_b: profile_b)
        thread_id = row[:id] || row.id

        {
          row: row,
          counterpart: counterpart,
          last_message: messaging_repo.last_message(thread_id: thread_id),
          unread_count: messaging_repo.unread_count(thread_id: thread_id, profile_id: viewer_profile_id)
        }
      end

      private

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end
    end
  end
end
