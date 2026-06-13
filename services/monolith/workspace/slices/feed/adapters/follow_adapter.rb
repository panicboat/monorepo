# frozen_string_literal: true

module Feed
  module Adapters
    class FollowAdapter
      def following_cast_user_ids(guest_user_id:)
        follow_repo.following_cast_user_ids(guest_user_id: guest_user_id)
      end

      # Symmetric: returns account ids followed by this account.
      def following_account_ids(account_id:)
        return [] if account_id.nil? || account_id.to_s.empty?

        follow_repo.following_account_ids(account_id: account_id)
      end

      private

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end
    end
  end
end
