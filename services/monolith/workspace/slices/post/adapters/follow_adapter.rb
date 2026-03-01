# frozen_string_literal: true

module Post
  module Adapters
    class FollowAdapter
      def following?(cast_user_id:, guest_user_id:)
        follow_repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def following_status_batch(cast_user_ids:, guest_user_id:)
        follow_repo.following_status_batch(cast_user_ids: cast_user_ids, guest_user_id: guest_user_id)
      end

      def following_cast_user_ids(guest_user_id:)
        follow_repo.following_cast_user_ids(guest_user_id: guest_user_id)
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end
    end
  end
end
