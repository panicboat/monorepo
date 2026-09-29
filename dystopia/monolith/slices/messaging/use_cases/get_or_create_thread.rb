# frozen_string_literal: true

module Messaging
  module UseCases
    class GetOrCreateThread
      include Messaging::Deps[
        messaging_repo: "repositories.messaging_repository",
        authorize_message: "use_cases.authorize_message"
      ]

      SelfMessageError = Class.new(StandardError)
      FollowRequiredError = Class.new(StandardError)
      BlockedError = Class.new(StandardError)
      RecipientUnresolvedError = Class.new(StandardError)

      def call(viewer_id:, recipient_account_id:)
        if recipient_account_id.nil? || recipient_account_id.to_s.empty?
          raise RecipientUnresolvedError, "recipient_account_id required"
        end
        raise SelfMessageError, "viewer == recipient" if viewer_id.to_s == recipient_account_id.to_s
        raise BlockedError, "blocked" if bidirectionally_blocked?(viewer_id, recipient_account_id)
        unless authorize_message.call(sender_id: viewer_id, recipient_id: recipient_account_id)
          raise FollowRequiredError, "follow required"
        end

        account_a, account_b = [viewer_id.to_s, recipient_account_id.to_s].minmax
        row = messaging_repo.upsert_thread(account_a: account_a, account_b: account_b)
        thread_id = row[:id] || row.id

        {
          row: row,
          counterpart: get_profile.call(account_id: recipient_account_id),
          last_message: messaging_repo.last_message(thread_id: thread_id),
          unread_count: messaging_repo.unread_count(thread_id: thread_id, account_id: viewer_id)
        }
      end

      private

      def social_block_repo
        @social_block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end

      def bidirectionally_blocked?(a, b)
        social_block_repo.blocked?(blocker_id: a, blocked_id: b) ||
          social_block_repo.blocked?(blocker_id: b, blocked_id: a)
      end
    end
  end
end
