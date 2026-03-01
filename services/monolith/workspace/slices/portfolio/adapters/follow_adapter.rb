# frozen_string_literal: true

module Portfolio
  module Adapters
    class FollowAdapter
      def approved_follower?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        follow_repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def follow_status(guest_user_id:, cast_user_id:)
        return nil if guest_user_id.nil?

        follow_repo.follow_status(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def get_follow_detail(guest_user_id:, cast_user_id:)
        return { is_following: false, followed_at: nil } if guest_user_id.nil?

        follow_repo.get_follow_detail(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      def approve_all_pending(cast_user_id:)
        follow_repo.approve_all_pending(cast_user_id: cast_user_id)
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end
    end
  end
end
