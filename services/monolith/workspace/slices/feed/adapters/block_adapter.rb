# frozen_string_literal: true

module Feed
  module Adapters
    class BlockAdapter
      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      def blocker_cast_ids_for_guest(guest_user_id:)
        block_repo.blocker_ids_for_blocked(blocked_id: guest_user_id, blocker_type: "cast")
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
