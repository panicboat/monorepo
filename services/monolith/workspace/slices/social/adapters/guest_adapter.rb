# frozen_string_literal: true

module Social
  module Adapters
    # Anti-Corruption Layer for accessing Guest data from Portfolio slice.
    #
    # This adapter abstracts the dependency on Portfolio slice,
    # providing a clean interface for Social slice to access guest information.
    #
    # @example
    #   adapter = Social::Adapters::GuestAdapter.new
    #   guest_info = adapter.find_by_user_id("user-123")
    #
    class GuestAdapter
      # Immutable value object representing guest information needed by Social slice.
      GuestInfo = Data.define(:id, :user_id, :name, :avatar_path)

      # Find guest by user ID.
      #
      # @param user_id [String] the user ID to look up
      # @return [GuestInfo, nil] guest information or nil if not found
      def find_by_user_id(user_id)
        guest = portfolio_guest_repository.find_by_user_id(user_id)
        return nil unless guest

        GuestInfo.new(
          id: guest.id,
          user_id: guest.user_id,
          name: guest.name,
          avatar_path: guest.avatar_path
        )
      end

      private

      def portfolio_guest_repository
        @portfolio_guest_repository ||= Portfolio::Slice["repositories.guest_repository"]
      end
    end
  end
end
