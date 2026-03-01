# frozen_string_literal: true

module Post
  module Adapters
    class BlockAdapter
      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      def cast_blocked_guest?(cast_user_id:, guest_user_id:)
        block_repo.blocked?(blocker_id: cast_user_id, blocked_id: guest_user_id)
      end

      def blocked_by_cast_ids(guest_user_id:)
        block_repo.blocker_ids_for_blocked(blocked_id: guest_user_id, blocker_type: "cast")
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
