# frozen_string_literal: true

module Feed
  module Adapters
    # Anti-Corruption Layer for accessing Relationship slice data.
    class RelationshipAdapter
      def following_cast_ids(guest_id:)
        follow_repo.following_cast_ids(guest_id: guest_id)
      end

      def favorite_cast_ids(guest_id:)
        favorite_repo.favorite_cast_ids(guest_id: guest_id)
      end

      def blocked_cast_ids(blocker_id:)
        block_repo.blocked_cast_ids(blocker_id: blocker_id)
      end

      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end

      def favorite_repo
        @favorite_repo ||= Relationship::Slice["repositories.favorite_repository"]
      end

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end
    end
  end
end
