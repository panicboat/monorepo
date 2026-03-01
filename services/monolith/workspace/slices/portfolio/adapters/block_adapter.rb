# frozen_string_literal: true

module Portfolio
  module Adapters
    # Anti-Corruption Layer for accessing Block data from Relationship slice.
    #
    # This adapter abstracts the dependency on Relationship slice,
    # providing a clean interface for Portfolio slice to access
    # block information.
    #
    # @example
    #   adapter = Portfolio::Adapters::BlockAdapter.new
    #   adapter.blocked?(guest_user_id: "guest-123", cast_user_id: "cast-456")
    #
    class BlockAdapter
      # Check if guest has blocked the cast.
      #
      # @param guest_user_id [String, nil] the guest user ID
      # @param cast_user_id [String] the cast user ID
      # @return [Boolean] true if blocked
      def blocked?(guest_user_id:, cast_user_id:)
        return false if guest_user_id.nil?

        block_repo.blocked?(blocker_id: guest_user_id, blocked_id: cast_user_id)
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
    end
  end
end
