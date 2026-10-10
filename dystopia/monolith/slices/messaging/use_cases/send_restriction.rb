# frozen_string_literal: true

module Messaging
  module UseCases
    class SendRestriction
      include Messaging::Deps[authorize_message: "use_cases.authorize_message"]

      def initialize(block_repo: nil, **kwargs)
        super(**kwargs)
        @block_repo = block_repo
      end

      def call(sender_profile_id:, recipient_profile_id:)
        return :blocked if blocked_either_way?(sender_profile_id, recipient_profile_id)
        return :follow_required unless authorize_message.call(sender_profile_id: sender_profile_id, recipient_profile_id: recipient_profile_id)

        nil
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def blocked_either_way?(a, b)
        block_repo.blocked?(blocker_profile_id: a, blocked_profile_id: b) ||
          block_repo.blocked?(blocker_profile_id: b, blocked_profile_id: a)
      end
    end
  end
end
