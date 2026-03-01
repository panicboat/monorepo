# frozen_string_literal: true

module Portfolio
  module Adapters
    class BlockAdapter
      def blocked?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        block_repo.blocked?(blocker_id: guest_user_id, blocked_id: cast_user_id)
      end

      def cast_blocked_guest?(cast_user_id:, guest_user_id:)
        return false if guest_user_id.nil? || cast_user_id.nil?

        block_repo.blocked?(blocker_id: cast_user_id, blocked_id: guest_user_id)
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
