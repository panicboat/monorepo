# frozen_string_literal: true

module Portfolio
  module Adapters
    # Anti-Corruption Layer for accessing Relationship data from Portfolio slice.
    #
    # This adapter abstracts the dependency on Relationship slice,
    # providing a clean interface for Portfolio slice to access
    # block and follow information.
    #
    # @example
    #   adapter = Portfolio::Adapters::SocialAdapter.new
    #   adapter.blocked?(guest_user_id: "guest-123", cast_user_id: "cast-456")
    #
    class SocialAdapter
      # Check if guest has blocked the cast.
      #
      # @param guest_user_id [String, nil] the guest user ID
      # @param cast_user_id [String] the cast user ID
      # @return [Boolean] true if blocked
      def blocked?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        block_repo.blocked?(blocker_id: guest_user_id, blocked_id: cast_user_id)
      end

      # Check if guest is an approved follower of the cast.
      #
      # @param guest_user_id [String, nil] the guest user ID
      # @param cast_user_id [String] the cast user ID
      # @return [Boolean] true if approved follower
      def approved_follower?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        follow_repo.following?(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      # Get follow status for a guest and cast.
      #
      # @param guest_user_id [String, nil] the guest user ID
      # @param cast_user_id [String] the cast user ID
      # @return [String, nil] "approved", "pending", or nil
      def follow_status(guest_user_id:, cast_user_id:)
        return nil if guest_user_id.nil?

        follow_repo.follow_status(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      # Get follow detail for a guest and cast.
      #
      # @param guest_user_id [String] the guest user ID
      # @param cast_user_id [String] the cast user ID
      # @return [Hash] { is_following: Boolean, followed_at: Time|nil }
      def get_follow_detail(guest_user_id:, cast_user_id:)
        return { is_following: false, followed_at: nil } if guest_user_id.nil?

        follow_repo.get_follow_detail(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
      end

      # Check if cast has blocked the guest.
      #
      # @param cast_user_id [String] the cast user ID
      # @param guest_user_id [String] the guest user ID
      # @return [Boolean] true if blocked
      def cast_blocked_guest?(cast_user_id:, guest_user_id:)
        return false if guest_user_id.nil? || cast_user_id.nil?

        block_repo.blocked?(blocker_id: cast_user_id, blocked_id: guest_user_id)
      end

      private

      def block_repo
        @block_repo ||= Relationship::Slice["repositories.block_repository"]
      end

      def follow_repo
        @follow_repo ||= Relationship::Slice["repositories.follow_repository"]
      end
    end
  end
end
