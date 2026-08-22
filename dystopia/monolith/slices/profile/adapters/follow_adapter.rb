# frozen_string_literal: true

module Profile
  module Adapters
    # Cross-slice follow view from Profile slice. Backed by the new social schema.
    # Legacy cast/guest naming preserved at the public API; internally maps to
    # symmetric follower(guest_user_id) / followee(cast_user_id) account ids.
    class FollowAdapter
      def approved_follower?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        row = follow_repo.find(follower_id: guest_user_id, followee_id: cast_user_id)
        !!(row && row.status == "approved")
      end

      def follow_status(guest_user_id:, cast_user_id:)
        return nil if guest_user_id.nil?

        follow_repo.find(follower_id: guest_user_id, followee_id: cast_user_id)&.status
      end

      def get_follow_detail(guest_user_id:, cast_user_id:)
        return { is_following: false, followed_at: nil } if guest_user_id.nil?

        row = follow_repo.find(follower_id: guest_user_id, followee_id: cast_user_id)
        if row && row.status == "approved"
          { is_following: true, followed_at: row.created_at }
        else
          { is_following: false, followed_at: nil }
        end
      end

      def approve_all_pending(cast_user_id:)
        follow_repo.approve_all_pending(account_id: cast_user_id)
      end

      private

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
