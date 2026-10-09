# frozen_string_literal: true

module Messaging
  module UseCases
    class SendMessage
      include Messaging::Deps[
        messaging_repo: "repositories.messaging_repository",
        authorize_message: "use_cases.authorize_message"
      ]

      SelfMessageError = Class.new(StandardError)
      FollowRequiredError = Class.new(StandardError)
      BlockedError = Class.new(StandardError)
      ThreadNotFoundError = Class.new(StandardError)
      ThreadMembershipError = Class.new(StandardError)
      EmptyContentError = Class.new(StandardError)
      RecipientUnresolvedError = Class.new(StandardError)

      def initialize(get_profile: nil, **kwargs)
        super(**kwargs)
        @get_profile = get_profile
      end

      def call(sender_profile_id:, content:, thread_id: nil, recipient_profile_id: nil)
        raise EmptyContentError, "content is required" if content.nil? || content.to_s.strip.empty?

        resolved_recipient_profile_id = resolve_recipient(
          sender_profile_id: sender_profile_id,
          thread_id: thread_id,
          recipient_profile_id: recipient_profile_id
        )

        raise SelfMessageError, "sender == recipient" if sender_profile_id.to_s == resolved_recipient_profile_id.to_s
        raise RecipientUnresolvedError, "recipient not found" unless get_profile.call(profile_id: resolved_recipient_profile_id)
        raise BlockedError, "blocked" if bidirectionally_blocked?(sender_profile_id, resolved_recipient_profile_id)
        unless authorize_message.call(sender_profile_id: sender_profile_id, recipient_profile_id: resolved_recipient_profile_id)
          raise FollowRequiredError, "follow required"
        end

        profile_a, profile_b = [sender_profile_id.to_s, resolved_recipient_profile_id.to_s].minmax
        thread = messaging_repo.upsert_thread(profile_a: profile_a, profile_b: profile_b)

        message = messaging_repo.insert_message(
          thread_id: thread[:id] || thread.id,
          sender_profile_id: sender_profile_id,
          content: content
        )

        { message: message, thread_id: thread[:id] || thread.id }
      end

      private

      def resolve_recipient(sender_profile_id:, thread_id:, recipient_profile_id:)
        if thread_id && !thread_id.to_s.empty?
          thread = messaging_repo.find_thread(id: thread_id)
          raise ThreadNotFoundError, "thread not found" unless thread

          a = thread.profile_a.to_s
          b = thread.profile_b.to_s
          s = sender_profile_id.to_s
          if s == a
            b
          elsif s == b
            a
          else
            raise ThreadMembershipError, "sender is not a thread participant"
          end
        elsif recipient_profile_id && !recipient_profile_id.to_s.empty?
          recipient_profile_id.to_s
        else
          raise RecipientUnresolvedError, "thread_id or recipient_profile_id required"
        end
      end

      def social_block_repo
        @social_block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def get_profile
        @get_profile ||= Profile::Slice["use_cases.get_profile"]
      end

      def bidirectionally_blocked?(a, b)
        social_block_repo.blocked?(blocker_profile_id: a, blocked_profile_id: b) ||
          social_block_repo.blocked?(blocker_profile_id: b, blocked_profile_id: a)
      end
    end
  end
end
