# frozen_string_literal: true

module Feed
  module Adapters
    class FollowAdapter
      def following_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        follow_repo.following_profile_ids(profile_id: account_id)
      end

      private

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
