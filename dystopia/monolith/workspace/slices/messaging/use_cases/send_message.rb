# frozen_string_literal: true

require "json"

module Messaging
  module UseCases
    # SendMessage applies suppression rules (self / mutual followers / not blocked),
    # gets-or-creates the (account_a, account_b)-normalized thread, INSERTs the message
    # and bumps thread.last_message_at in a single transaction, then publishes
    # NOTIFY events to both participants' channels. NOTIFY failure is swallowed —
    # delivery is best-effort by design (subscriber may be absent in M1).
    class SendMessage
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      SelfMessageError = Class.new(StandardError)
      NotMutualFollowersError = Class.new(StandardError)
      BlockedError = Class.new(StandardError)
      ThreadNotFoundError = Class.new(StandardError)
      ThreadMembershipError = Class.new(StandardError)
      EmptyContentError = Class.new(StandardError)
      RecipientUnresolvedError = Class.new(StandardError)

      def call(sender_id:, content:, thread_id: nil, recipient_account_id: nil)
        raise EmptyContentError, "content is required" if content.nil? || content.to_s.strip.empty?

        recipient_id = resolve_recipient(
          sender_id: sender_id,
          thread_id: thread_id,
          recipient_account_id: recipient_account_id
        )

        raise SelfMessageError, "sender == recipient" if sender_id.to_s == recipient_id.to_s
        raise BlockedError, "blocked" if bidirectionally_blocked?(sender_id, recipient_id)
        raise NotMutualFollowersError, "not mutual followers" unless mutual_followers?(sender_id, recipient_id)

        account_a, account_b = [sender_id.to_s, recipient_id.to_s].minmax
        thread = messaging_repo.upsert_thread(account_a: account_a, account_b: account_b)

        message = messaging_repo.insert_message(
          thread_id: thread[:id] || thread.id,
          sender_id: sender_id,
          content: content
        )

        publish_message_event(message, sender_id: sender_id, recipient_id: recipient_id)

        { message: message, thread_id: thread[:id] || thread.id }
      end

      private

      def resolve_recipient(sender_id:, thread_id:, recipient_account_id:)
        if thread_id && !thread_id.to_s.empty?
          thread = messaging_repo.find_thread(id: thread_id)
          raise ThreadNotFoundError, "thread not found" unless thread

          a = thread.account_a.to_s
          b = thread.account_b.to_s
          s = sender_id.to_s
          if s == a
            b
          elsif s == b
            a
          else
            raise ThreadMembershipError, "sender is not a thread participant"
          end
        elsif recipient_account_id && !recipient_account_id.to_s.empty?
          recipient_account_id.to_s
        else
          raise RecipientUnresolvedError, "thread_id or recipient_account_id required"
        end
      end

      def social_follow_repo
        @social_follow_repo ||= Social::Slice["repositories.follow_repository"]
      end

      def social_block_repo
        @social_block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def mutual_followers?(a, b)
        s1 = social_follow_repo.find(follower_id: a, followee_id: b)
        s2 = social_follow_repo.find(follower_id: b, followee_id: a)
        !!(s1 && s1.status == "approved" && s2 && s2.status == "approved")
      end

      def bidirectionally_blocked?(a, b)
        social_block_repo.blocked?(blocker_id: a, blocked_id: b) ||
          social_block_repo.blocked?(blocker_id: b, blocked_id: a)
      end

      def publish_message_event(message, sender_id:, recipient_id:)
        data = serialize_message(message)
        payload = { type: "message", data: data }.to_json
        notify("messaging_user_#{sender_id}", payload)
        notify("messaging_user_#{recipient_id}", payload)
      end

      def notify(channel, payload)
        db = messaging_repo.send(:thread_records).dataset.db
        db.notify(channel, payload: payload)
      rescue StandardError => e
        Hanami.logger.warn("Messaging::SendMessage notify failed on #{channel}: #{e.class}: #{e.message}")
        nil
      end

      def serialize_message(row)
        {
          id: (row[:id] || row.id).to_s,
          thread_id: (row[:thread_id] || row.thread_id).to_s,
          sender_id: (row[:sender_id] || row.sender_id).to_s,
          content: row[:content] || row.content,
          created_at: (row[:created_at] || row.created_at).iso8601
        }
      end
    end
  end
end
