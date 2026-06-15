# frozen_string_literal: true

module Post
  module Adapters
    # Cross-slice follow view from Post slice. Backed by the new social schema.
    # Legacy cast/guest naming is preserved at the public API (callers in
    # access_policy still use those terms) but internally maps to symmetric
    # follower/followee account ids.
    class FollowAdapter
      def following?(cast_user_id:, guest_user_id:)
        row = follow_repo.find(follower_id: guest_user_id, followee_id: cast_user_id)
        !!(row && row.status == "approved")
      end

      def following_status_batch(cast_user_ids:, guest_user_id:)
        return {} if cast_user_ids.nil? || cast_user_ids.empty? || guest_user_id.nil?

        present = follow_repo.status_batch(follower_id: guest_user_id, followee_ids: cast_user_ids)
        cast_user_ids.each_with_object({}) do |id, h|
          h[id] = present[id.to_s] || "none"
        end
      end

      private

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
