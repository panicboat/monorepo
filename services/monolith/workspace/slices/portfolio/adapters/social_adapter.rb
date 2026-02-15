# frozen_string_literal: true

module Portfolio
  module Adapters
    # Anti-Corruption Layer for accessing Social data from Portfolio slice.
    #
    # This adapter abstracts the dependency on Social slice,
    # providing a clean interface for Portfolio slice to access
    # block and follow information.
    #
    # @example
    #   adapter = Portfolio::Adapters::SocialAdapter.new
    #   adapter.blocked?(guest_id: "guest-123", cast_id: "cast-456")
    #
    class SocialAdapter
      # Check if guest has blocked the cast.
      #
      # @param guest_id [String, nil] the guest ID
      # @param cast_id [String] the cast ID
      # @return [Boolean] true if blocked
      def blocked?(guest_id:, cast_id:)
        return false if guest_id.nil?

        block_repo.blocked?(blocker_id: guest_id, blocked_id: cast_id)
      end

      # Check if guest is an approved follower of the cast.
      #
      # @param guest_id [String, nil] the guest ID
      # @param cast_id [String] the cast ID
      # @return [Boolean] true if approved follower
      def approved_follower?(guest_id:, cast_id:)
        return false if guest_id.nil?

        follow_repo.following?(cast_id: cast_id, guest_id: guest_id)
      end

      # Get follow status for a guest and cast.
      #
      # @param guest_id [String, nil] the guest ID
      # @param cast_id [String] the cast ID
      # @return [String, nil] "approved", "pending", or nil
      def follow_status(guest_id:, cast_id:)
        return nil if guest_id.nil?

        follow_repo.follow_status(cast_id: cast_id, guest_id: guest_id)
      end

      # Get follow detail for a guest and cast.
      #
      # @param guest_id [String] the guest ID
      # @param cast_id [String] the cast ID
      # @return [Hash] { is_following: Boolean, followed_at: Time|nil }
      def get_follow_detail(guest_id:, cast_id:)
        return { is_following: false, followed_at: nil } if guest_id.nil?

        follow_repo.get_follow_detail(cast_id: cast_id, guest_id: guest_id)
      end

      # Check if cast has blocked the guest.
      #
      # @param cast_id [String] the cast ID
      # @param guest_id [String] the guest ID
      # @return [Boolean] true if blocked
      def cast_blocked_guest?(cast_id:, guest_id:)
        return false if guest_id.nil? || cast_id.nil?

        block_repo.blocked?(blocker_id: cast_id, blocked_id: guest_id)
      end

      private

      def block_repo
        @block_repo ||= Social::Slice["repositories.block_repository"]
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
