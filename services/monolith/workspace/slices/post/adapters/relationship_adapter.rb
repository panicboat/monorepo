# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Relationship slice data.
    class RelationshipAdapter
      def following?(cast_user_id:, guest_user_id:)
        follow_repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def following_status_batch(cast_user_ids:, guest_user_id:)
        follow_repo.following_status_batch(cast_user_ids: cast_user_ids, guest_user_id: guest_user_id)
      end

      def following_cast_user_ids(guest_user_id:)
        follow_repo.following_cast_user_ids(guest_user_id: guest_user_id)
      end

      def blocked?(blocker_id:, blocked_id:)
        block_repo.blocked?(blocker_id: blocker_id, blocked_id: blocked_id)
      end

      def blocked_cast_ids(blocker_id:)
        block_repo.blocked_cast_ids(blocker_id: blocker_id)
      end

      def blocked_guest_ids(blocker_id:)
        block_repo.blocked_guest_ids(blocker_id: blocker_id)
      end

      def favorite_cast_user_ids(guest_user_id:)
        favorite_repo.favorite_cast_user_ids(guest_user_id: guest_user_id)
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end

      def favorite_repo
        @favorite_repo ||= Relationship::Slice["repositories.favorite_repository"]
      end
    end
  end
end
