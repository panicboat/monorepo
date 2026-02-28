# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Relationship slice data.
    class RelationshipAdapter
      def following_cast_user_ids(guest_user_id:)
        follow_repo.following_cast_user_ids(guest_user_id: guest_user_id)
      end

      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      def blocker_cast_ids_for_guest(guest_user_id:)
        block_repo.blocker_ids_for_blocked(blocked_id: guest_user_id, blocker_type: "cast")
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
