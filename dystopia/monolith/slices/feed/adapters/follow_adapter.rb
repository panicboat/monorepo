# frozen_string_literal: true

module Feed
  module Adapters
    class FollowAdapter
      def following_profile_ids(profile_id:)
        return [] if profile_id.nil? || profile_id.to_s.empty?

        follow_repo.following_profile_ids(profile_id: profile_id)
      end

      private

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
